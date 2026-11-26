import { getLiveShopPrices } from '@/server/services/shop-service';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq, asc, inArray, and } from 'drizzle-orm';
import { db } from '@/db';
import { gameSessions, levelQuestions, playerAnswers, questionOptions, questions, roomPlayers, rooms } from '@/db/schema';
import { requireUser } from '@/server/auth/session';
import { getRoom, updateRoomStatus, removePlayer, assertHost, leaveRoom, ensureSession } from '@/server/services/room-service';
import { stripCorrectAnswer } from '@/server/services/question-service';
import { publishToRoom } from '@/server/services/realtime-service';
import { ensureWsServer } from '@/server/services/ws-hub';
import { getEphemeralChatSince } from '@/server/services/chat-store';
import {
  addRejoinRequest,
  getLiveRoomPositions,
  getRejoinRequests,
  invalidateRoomSyncCache,
  isPlayerKicked,
  isRoomDeleted,
  markPlayerKicked,
  markRoomDeleted,
  removePresence,
  setLiveRoomStatus,
  touchPresence,
} from '@/server/services/presence-store';
import { generateId } from '@/server/auth/crypto';
import { ok, fail, handleError } from '@/server/middleware/http';

const statusSchema = z.object({
  status: z.enum(['waiting', 'starting', 'in_progress', 'paused', 'completed']),
});

async function loadSafeLevelQuestions(levelId: string, isAdmin = false) {
  const links = await db
    .select()
    .from(levelQuestions)
    .where(eq(levelQuestions.levelId, levelId))
    .orderBy(asc(levelQuestions.position));

  if (links.length === 0) return [];
  const qIds = links.map((l) => l.questionId);
  const [qRows, opts] = await Promise.all([
    db.select().from(questions).where(inArray(questions.id, qIds)),
    db.select().from(questionOptions).where(inArray(questionOptions.questionId, qIds)),
  ]);

  return qIds
    .map((qid) => qRows.find((q) => q.id === qid))
    .filter((q): q is NonNullable<typeof q> => Boolean(q))
    .map((q) => ({
      ...(isAdmin ? q : stripCorrectAnswer(q)),
      options: opts.filter((o) => o.questionId === q.id),
    }));
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    ensureWsServer();
    const user = await requireUser();
    const { id } = await ctx.params;
    const bootstrap = req.nextUrl.searchParams.get('bootstrap') === '1';

    if (isRoomDeleted(id)) {
      return fail('Room game telah dihapus oleh guru', 404);
    }

    if (!bootstrap) {
      return ok({ room: await getRoom(id) });
    }

    let room = await getRoom(id);
    setLiveRoomStatus(id, room.status);
    const isStaff = user.role === 'teacher' || user.role === 'admin';
    const kicked = !isStaff && isPlayerKicked(id, user.id);
    if (kicked) {
      addRejoinRequest(id, { userId: user.id, username: user.username });
      void publishToRoom(id, 'rejoin-request', {
        requests: getRejoinRequests(id),
      });
    }
    const isAllowedInArena =
      !kicked &&
      room.status !== 'completed' &&
      (isStaff || room.status === 'in_progress' || room.status === 'paused');

    if (isAllowedInArena) {
      touchPresence(id, user.id, true);
      const inRoom = (room.players ?? []).some((pl) => pl.userId === user.id);
      if (!inRoom && (user.role === 'admin' || user.role !== 'teacher' || room.hostId === user.id)) {
        await db
          .insert(roomPlayers)
          .values({
            id: generateId('rpl'),
            roomId: id,
            userId: user.id,
            avatar: user.avatar,
          })
          .catch(() => {});
        room = await getRoom(id);
      }
    }

    const liveMap = getLiveRoomPositions(id);
    const enrichedPlayers = (room.players ?? []).map((pl) => {
      const live = liveMap.get(pl.userId);
      return {
        ...pl,
        stage: live?.stage ?? 1,
        lastX: live?.x ?? pl.lastX,
        lastY: live?.y ?? pl.lastY,
        lastFacing: live?.facing ?? pl.lastFacing,
      };
    });
    room = { ...room, players: enrichedPlayers };

    const levelId = room.level?.id;
    const [levelQs, session] = await Promise.all([
      levelId ? loadSafeLevelQuestions(levelId, user.role === 'admin') : Promise.resolve([]),
      levelId && isAllowedInArena
        ? ensureSession(id, user.id, levelId).catch(() => null)
        : Promise.resolve(null),
    ]);

    const chatSync = getEphemeralChatSince(id, -1);

    const mySessions = await db
      .select({ id: gameSessions.id })
      .from(gameSessions)
      .where(and(eq(gameSessions.roomId, id), eq(gameSessions.userId, user.id)));
    const sessionIds = mySessions.map((s) => s.id);
    if (session?.id && !sessionIds.includes(session.id)) {
      sessionIds.push(session.id);
    }
    const myAnswers =
      sessionIds.length > 0
        ? await db
            .select({ questionId: playerAnswers.questionId, isCorrect: playerAnswers.isCorrect })
            .from(playerAnswers)
            .where(inArray(playerAnswers.sessionId, sessionIds))
        : [];
    const answerResults: Record<string, boolean> = {};
    for (const a of myAnswers) {
      answerResults[a.questionId] = Boolean(a.isCorrect);
    }
    const answeredQuestionIds = Object.keys(answerResults);

    const effectiveEquipped = user.equippedBody ?? 'cat';
    const effectiveAvatar = effectiveEquipped === 'cat'
      ? (user.avatar?.startsWith('cat') ? user.avatar : 'cat-blue')
      : (user.equippedBody || user.avatar || 'cat-blue');

    return ok({
      profile: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        avatar: effectiveAvatar,
        totalPoints: user.totalPoints,
        totalStars: user.totalStars,
        unlockedBodies: user.unlockedBodies ? JSON.parse(user.unlockedBodies) : ['cat'],
        equippedBody: effectiveEquipped,
      },
      shopPrices: await getLiveShopPrices(),
      room,
      questions: levelQs,
      chatCursor: chatSync.chatCursor,
      sessionId: session?.id ?? mySessions[0]?.id ?? null,
      answeredQuestionIds,
      answerResults,
      correctCount: answeredQuestionIds.length,
      kicked,
      rejoinRequests: isStaff ? getRejoinRequests(id) : [],
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();

    if (body.action === 'leave') {
      removePresence(id, user.id);
      await leaveRoom(id, user.id);
      return ok({ success: true });
    }

    if (user.role === 'student') {
      return fail('Aksi tidak diizinkan', 403);
    }

    if (user.role !== 'teacher' && user.role !== 'admin') {
      return fail('Hanya guru atau administrator yang dapat melakukan aksi ini', 403);
    }

    if (body.action === 'remove-player') {
      const schema = z.object({ playerId: z.string().min(1) });
      const { playerId } = schema.parse(body);
      markPlayerKicked(id, playerId);
      await removePlayer(id, user.id, playerId);
      invalidateRoomSyncCache(id);
      await publishToRoom(id, 'kicked', { playerId, left: false });
      return ok({ room: await getRoom(id) });
    }

    if (body.action === 'change-map') {
      const schema = z.object({
        selectedStages: z.array(z.number().int().min(1).max(20)).min(1),
      });
      const { selectedStages } = schema.parse(body);
      const roomRow = await getRoom(id);
      const parsedSettings = (typeof roomRow.settings === 'object' && roomRow.settings !== null) ? roomRow.settings : {};
      const updatedSettings = {
        ...parsedSettings,
        selectedStages,
        stageCount: selectedStages.length,
      };
      await db
        .update(rooms)
        .set({ settings: JSON.stringify(updatedSettings) })
        .where(eq(rooms.id, id));
      invalidateRoomSyncCache(id);
      return ok({ ok: true, selectedStages });
    }

    const { status } = statusSchema.parse(body);
    const existing = await getRoom(id);
    if (existing.status === 'completed' && status !== 'completed' && user.role !== 'admin') {
      return fail('Hanya administrator yang dapat mengaktifkan kembali ruang game yang sudah selesai', 403);
    }
    const room = await updateRoomStatus(id, user.id, status);
    setLiveRoomStatus(id, status);
    invalidateRoomSyncCache(id);
    await publishToRoom(id, 'room-status', { status });
    return ok({ room });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== 'teacher' && user.role !== 'admin') {
      return fail('Hanya guru atau administrator yang dapat menghapus ruang', 403);
    }
    const { id } = await ctx.params;
    await assertHost(id, user.id);
    markRoomDeleted(id);
    await db.delete(rooms).where(eq(rooms.id, id));
    await publishToRoom(id, 'room-status', { status: 'deleted' });
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
