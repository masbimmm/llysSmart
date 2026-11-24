import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { gameSessions, playerAnswers, questions, questionOptions, users, roomPlayers, rooms } from '@/db/schema';
import { invalidateUserSessionCache, requireUser } from '@/server/auth/session';
import { generateId } from '@/server/auth/crypto';
import { answerSchema, chatSchema } from '@/server/middleware/validation';
import { ok, fail, handleError } from '@/server/middleware/http';
import { publishToRoom } from '@/server/services/realtime-service';
import { addEphemeralChat, getEphemeralChatSince } from '@/server/services/chat-store';
import {
  addRejoinRequest,
  approvePlayerRejoin,
  getCachedRoomDbState,
  getLiveRoomPositions,
  getLiveRoomStatus,
  getRejoinRequests,
  getStaleUserIds,
  invalidateRoomSyncCache,
  isPlayerKicked,
  isRoomDeleted,
  markPlayerKicked,
  markRoomDeleted,
  rejectPlayerRejoin,
  removePresence,
  setCachedRoomDbState,
  setLiveRoomStatus,
  shouldWritePosToDb,
  touchPresence,
  updateLivePlayerPosition,
} from '@/server/services/presence-store';
import { assertHost } from '@/server/services/room-service';

// Cache per-user session & answered questions in RAM for 2s (invalidated immediately on answer)
const globalForUserGameCache = globalThis as unknown as {
  __llysUserAnswerCache?: Map<
    string,
    {
      cachedAt: number;
      sessionId: string | null;
      answeredQuestionIds: string[];
      answerResults: Record<string, boolean | 'assisted'>;
      chosenAnswers?: Record<string, string>;
      correctCount: number;
    }
  >;
};

function getUserAnswerCache() {
  if (!globalForUserGameCache.__llysUserAnswerCache) {
    globalForUserGameCache.__llysUserAnswerCache = new Map();
  }
  return globalForUserGameCache.__llysUserAnswerCache;
}

// Clear stale cache entries on module reload so updated progress counts take effect immediately
globalForUserGameCache.__llysUserAnswerCache?.clear();

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  try {
    const { action } = await ctx.params;
    const body = await req.json();

    // Ultra-fast zero-DB, zero-cookie in-memory position exchange (< 0.2ms server time)
    if (action === 'pos') {
      const roomId = typeof body?.r === 'string' ? body.r : '';
      const userId = typeof body?.u === 'string' ? body.u : '';
      if (!roomId || !userId) return fail('Parameter tidak lengkap', 400);

      if (isRoomDeleted(roomId)) {
        return ok({ roomDeleted: true, rs: 'deleted', p: [] });
      }
      if (isPlayerKicked(roomId, userId)) {
        return ok({ kicked: true, p: [] });
      }

      if (typeof body.x === 'number' && typeof body.y === 'number') {
        const stage = typeof body.stg === 'number' ? body.stg : typeof body.stage === 'number' ? body.stage : 1;
        updateLivePlayerPosition(roomId, {
          userId,
          username: typeof body.un === 'string' ? body.un : 'Player',
          fullName: typeof body.fn === 'string' ? body.fn : undefined,
          avatar: typeof body.av === 'string' ? body.av : 'cat-orange',
          role: typeof body.rl === 'string' ? body.rl : 'student',
          stage,
          x: body.x,
          y: body.y,
          vx: typeof body.vx === 'number' ? body.vx : 0,
          vy: typeof body.vy === 'number' ? body.vy : 0,
          facing: body.f === -1 ? -1 : 1,
          onGround: Boolean(body.g ?? true),
          isDying: Boolean(body.d),
          deathStartedAt: typeof body.ds === 'number' ? body.ds : undefined,
          burnUntil: typeof body.b === 'number' ? body.b : undefined,
        });

        if (shouldWritePosToDb(roomId, userId, 3500)) {
          void db
            .update(roomPlayers)
            .set({ lastX: body.x, lastY: body.y, lastFacing: body.f === -1 ? -1 : 1 })
            .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, userId)))
            .catch(() => {});
        }
      } else {
        touchPresence(roomId, userId);
      }

      const liveMap = getLiveRoomPositions(roomId);
      const peers: Record<string, unknown>[] = [];
      const now = Date.now();
      for (const p of liveMap.values()) {
        if (p.userId === userId) continue;
        if (now - p.updatedAt > 6000) continue;
        peers.push({
          u: p.userId,
          un: p.username,
          fn: p.fullName,
          av: p.avatar,
          rl: p.role,
          stg: p.stage ?? 1,
          x: p.x,
          y: p.y,
          vx: p.vx,
          vy: p.vy,
          f: p.facing,
          g: p.onGround ? 1 : 0,
          d: p.isDying ? 1 : 0,
          ds: p.deathStartedAt,
          b: p.burnUntil,
        });
      }

      return ok({ p: peers });
    }

    const user = await requireUser();
    const isStaff = user.role === 'teacher' || user.role === 'admin';

    if (action === 'answer') {
      const input = answerSchema.parse(body);
      const metaSchema = z.object({
        sessionId: z.string().optional(),
        roomId: z.string().optional(),
        levelId: z.string().optional(),
      });
      const meta = metaSchema.parse(body);

      let activeSession: typeof gameSessions.$inferSelect | undefined;

      if (meta.sessionId) {
        const rows = await db
          .select()
          .from(gameSessions)
          .where(and(eq(gameSessions.id, meta.sessionId), eq(gameSessions.userId, user.id)))
          .limit(1);
        activeSession = rows[0];
      }

      if (!activeSession && meta.roomId) {
        const existing = await db
          .select()
          .from(gameSessions)
          .where(and(eq(gameSessions.roomId, meta.roomId), eq(gameSessions.userId, user.id)))
          .limit(1);
        if (existing[0]) {
          activeSession = existing[0];
        } else {
          let resolvedLevelId = meta.levelId;
          if (!resolvedLevelId) {
            const roomRow = await db
              .select({ levelId: rooms.levelId })
              .from(rooms)
              .where(eq(rooms.id, meta.roomId))
              .limit(1);
            resolvedLevelId = roomRow[0]?.levelId;
          }
          if (resolvedLevelId) {
            const newId = generateId('gsn');
            await db.insert(gameSessions).values({
              id: newId,
              roomId: meta.roomId,
              userId: user.id,
              levelId: resolvedLevelId,
            });
            const created = await db.select().from(gameSessions).where(eq(gameSessions.id, newId)).limit(1);
            activeSession = created[0];
          }
        }
      }

      if (!activeSession) return fail('Sesi permainan tidak ditemukan', 404);
      const sessionId = activeSession.id;

      const [dup, qRows] = await Promise.all([
        db
          .select({ id: playerAnswers.id })
          .from(playerAnswers)
          .where(and(eq(playerAnswers.sessionId, sessionId), eq(playerAnswers.questionId, input.questionId)))
          .limit(1),
        db.select().from(questions).where(eq(questions.id, input.questionId)).limit(1),
      ]);

      if (dup[0]) return fail('Soal ini sudah dijawab', 409);

      const question = qRows[0];
      if (!question) return fail('Soal tidak ditemukan', 404);

      const isCorrect = question.correctAnswer === input.answer;
      const pointsEarned = isCorrect ? question.points : 0;

      const writeOps: Promise<unknown>[] = [
        db.insert(playerAnswers).values({
          id: generateId('ans'),
          sessionId,
          questionId: input.questionId,
          answer: input.answer,
          isCorrect,
          pointsEarned,
          timeSpent: input.timeSpent,
        }),
      ];

      if (isCorrect) {
        writeOps.push(
          db
            .update(gameSessions)
            .set({ score: activeSession.score + pointsEarned, updatedAt: new Date() })
            .where(eq(gameSessions.id, sessionId)),
          db
            .update(users)
            .set({ totalPoints: user.totalPoints + pointsEarned, updatedAt: new Date() })
            .where(eq(users.id, user.id)),
        );
      }

      await Promise.all(writeOps);
      invalidateRoomSyncCache(activeSession.roomId);
      getUserAnswerCache().delete(`${activeSession.roomId}:${user.id}`);
      if (isCorrect) {
        invalidateUserSessionCache(user.id);
      }

      void publishToRoom(activeSession.roomId, 'score', {
        userId: user.id,
        username: user.username,
        score: activeSession.score + pointsEarned,
        stars: activeSession.stars,
        isCorrect,
      });

      return ok({
        sessionId,
        result: {
          isCorrect,
          pointsEarned,
        },
      });
    }

    if (action === 'assist-answer') {
      if (!isStaff) return fail('Hanya Guru/Admin yang bisa membantu jawab soal', 403);
      const schema = z.object({
        roomId: z.string().min(1),
        targetId: z.string().min(1), // userId atau 'all'
        questionId: z.string().min(1),
        answer: z.string().min(1),
      });
      const input = schema.parse(body);

      // Kunci jawaban (validasi guru/admin boleh tahu)
      const qRows = await db.select().from(questions).where(eq(questions.id, input.questionId)).limit(1);
      const question = qRows[0];
      if (!question) return fail('Soal tidak ditemukan', 404);
      if (question.correctAnswer !== input.answer) return fail('Jawaban salah', 400);

      // Cari semua session target dalam room ini (bisa lebih dari 1 kalau rejoin)
      let targetUserIds: string[];
      if (input.targetId === 'all') {
        const rows = await db
          .select({ userId: roomPlayers.userId })
          .from(roomPlayers)
          .where(eq(roomPlayers.roomId, input.roomId));
        targetUserIds = rows.map((r) => r.userId);
      } else {
        targetUserIds = [input.targetId];
      }
      if (targetUserIds.length === 0) return ok({ success: true, count: 0 });

      const sessions = await db
        .select()
        .from(gameSessions)
        .where(and(eq(gameSessions.roomId, input.roomId), inArray(gameSessions.userId, targetUserIds)));

      let count = 0;
      for (const sess of sessions) {
        const dup = await db
          .select({ id: playerAnswers.id })
          .from(playerAnswers)
          .where(and(eq(playerAnswers.sessionId, sess.id), eq(playerAnswers.questionId, input.questionId)))
          .limit(1);
        if (dup.length > 0) continue;
        await db.insert(playerAnswers).values({
          id: generateId('ans'),
          sessionId: sess.id,
          questionId: input.questionId,
          answer: input.answer,
          isCorrect: true,
          pointsEarned: 0,
          assisted: true,
          timeSpent: 0,
        });
        count += 1;
        getUserAnswerCache().delete(`${input.roomId}:${sess.userId}`);
      }

      invalidateRoomSyncCache(input.roomId);
      return ok({ success: true, count });
    }

    if (action === 'skip-stage') {
      if (!isStaff) return fail('Hanya Guru/Admin yang bisa skip stage', 403);
      const schema = z.object({
        roomId: z.string().min(1),
        targetId: z.string().min(1),
        stage: z.number().int().min(1),
        questionIds: z.array(z.string().min(1)).min(1),
      });
      const input = schema.parse(body);

      const qRows = await db
        .select({ id: questions.id, correctAnswer: questions.correctAnswer })
        .from(questions)
        .where(inArray(questions.id, input.questionIds));
      const answerById = new Map(qRows.map((q) => [q.id, q.correctAnswer]));

      const sessions = await db
        .select()
        .from(gameSessions)
        .where(and(eq(gameSessions.roomId, input.roomId), eq(gameSessions.userId, input.targetId)));

      let count = 0;
      for (const sess of sessions) {
        for (const qid of input.questionIds) {
          const dup = await db
            .select({ id: playerAnswers.id })
            .from(playerAnswers)
            .where(and(eq(playerAnswers.sessionId, sess.id), eq(playerAnswers.questionId, qid)))
            .limit(1);
          if (dup.length > 0) continue;
          await db.insert(playerAnswers).values({
            id: generateId('ans'),
            sessionId: sess.id,
            questionId: qid,
            answer: answerById.get(qid) ?? 'skipped',
            isCorrect: true,
            pointsEarned: 0,
            assisted: true,
            timeSpent: 0,
          });
          count += 1;
        }
        getUserAnswerCache().delete(`${input.roomId}:${sess.userId}`);
      }

      invalidateRoomSyncCache(input.roomId);
      return ok({ success: true, count });
    }

    if (action === 'leave') {
      const schema = z.object({ roomId: z.string().min(1) });
      const { roomId } = schema.parse(body);
      removePresence(roomId, user.id);
      await db.delete(roomPlayers).where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, user.id)));
      void publishToRoom(roomId, 'kicked', { playerId: user.id, left: true });
      return ok({ success: true });
    }

    if (action === 'chat') {
      const input = chatSchema.parse(body);
      const schema = z.object({ roomId: z.string().min(1) });
      const { roomId } = schema.parse(body);

      const message = addEphemeralChat(roomId, {
        id: generateId('msg'),
        roomId,
        userId: user.id,
        senderName: user.username,
        senderFullName: user.fullName,
        role: user.role,
        text: input.text,
        createdAt: new Date().toISOString(),
      });
      await publishToRoom(roomId, 'chat', message);

      return ok({ message }, 201);
    }

    if (action === 'push-question') {
      if (!isStaff) return fail('Hanya guru yang dapat mengirim soal', 403);
      const schema = z.object({
        roomId: z.string().min(1),
        questionId: z.string().nullable(),
      });
      const { roomId, questionId } = schema.parse(body);
      await assertHost(roomId, user.id);
      await db.update(rooms).set({ activeQuestionId: questionId, updatedAt: new Date() }).where(eq(rooms.id, roomId));
      invalidateRoomSyncCache(roomId);

      if (!questionId) {
        await publishToRoom(roomId, 'question', { question: null });
        return ok({ pushed: null });
      }

      const qRows = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
      if (!qRows[0]) return fail('Soal tidak ditemukan', 404);
      const options = await db
        .select({ label: questionOptions.label, content: questionOptions.content })
        .from(questionOptions)
        .where(eq(questionOptions.questionId, questionId));
      const { correctAnswer: _omit, ...safe } = qRows[0];
      void _omit;
      await publishToRoom(roomId, 'question', { question: { ...safe, options } });
      return ok({ pushed: { ...safe, options } });
    }

    if (action === 'kick') {
      if (!isStaff) return fail('Hanya guru yang dapat mengeluarkan pemain', 403);
      const schema = z.object({ roomId: z.string().min(1), playerId: z.string().min(1) });
      const { roomId, playerId } = schema.parse(body);
      await assertHost(roomId, user.id);
      const targetUserRows = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, playerId))
        .limit(1);
      if (targetUserRows[0]?.role === 'admin') {
        return fail('Administrator tidak dapat di-kick', 403);
      }
      markPlayerKicked(roomId, playerId);
      await db.delete(roomPlayers).where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, playerId)));
      invalidateRoomSyncCache(roomId);
      await publishToRoom(roomId, 'kicked', { playerId, left: false });
      return ok({ success: true });
    }

    if (action === 'kick-all') {
      if (!isStaff) return fail('Hanya guru atau administrator yang dapat mengeluarkan semua pemain', 403);
      const schema = z.object({ roomId: z.string().min(1) });
      const { roomId } = schema.parse(body);
      await assertHost(roomId, user.id);

      const currentPlayers = await db
        .select({ userId: roomPlayers.userId, role: users.role })
        .from(roomPlayers)
        .innerJoin(users, eq(roomPlayers.userId, users.id))
        .where(eq(roomPlayers.roomId, roomId));

      const liveMap = getLiveRoomPositions(roomId);
      const targetIds = new Set<string>();
      for (const p of currentPlayers) {
        if (p.userId === user.id || p.role === 'admin' || p.role === 'teacher') continue;
        targetIds.add(p.userId);
      }
      for (const p of liveMap.values()) {
        if (p.userId === user.id || p.role === 'admin' || p.role === 'teacher') continue;
        targetIds.add(p.userId);
      }

      const kickedIds = Array.from(targetIds);
      for (const pid of kickedIds) {
        markPlayerKicked(roomId, pid);
      }
      if (kickedIds.length > 0) {
        await db
          .delete(roomPlayers)
          .where(and(eq(roomPlayers.roomId, roomId), inArray(roomPlayers.userId, kickedIds)));
      }
      invalidateRoomSyncCache(roomId);
      await Promise.all(
        kickedIds.map((pid) => publishToRoom(roomId, 'kicked', { playerId: pid, left: false })),
      );
      return ok({ success: true, kickedCount: kickedIds.length, kickedIds });
    }

    if (action === 'approve-rejoin') {
      if (!isStaff) return fail('Hanya guru yang dapat menyetujui pemain', 403);
      const schema = z.object({ roomId: z.string().min(1), playerId: z.string().min(1) });
      const { roomId, playerId } = schema.parse(body);
      await assertHost(roomId, user.id);

      // 1. Cari semua sesi game siswa di room ini untuk menghitung poin yang sudah didapat & mereset jawaban
      const playerSessions = await db
        .select({ id: gameSessions.id, score: gameSessions.score })
        .from(gameSessions)
        .where(and(eq(gameSessions.roomId, roomId), eq(gameSessions.userId, playerId)));

      const sessionIds = playerSessions.map((s) => s.id);
      let pointsToDeduct = playerSessions.reduce((acc, s) => acc + (s.score || 0), 0);

      if (sessionIds.length > 0) {
        const answers = await db
          .select({ pointsEarned: playerAnswers.pointsEarned })
          .from(playerAnswers)
          .where(inArray(playerAnswers.sessionId, sessionIds));
        const answerPointsSum = answers.reduce((acc, a) => acc + (a.pointsEarned || 0), 0);
        pointsToDeduct = Math.max(pointsToDeduct, answerPointsSum);

        // Hapus semua jawaban soal siswa di room ini & reset skor sesi ke 0
        await Promise.all([
          db.delete(playerAnswers).where(inArray(playerAnswers.sessionId, sessionIds)),
          db
            .update(gameSessions)
            .set({ score: 0, stars: 0, completedAt: null, updatedAt: new Date() })
            .where(inArray(gameSessions.id, sessionIds)),
        ]);
      }

      // 2. Ambil data user untuk kurangi totalPoints & pastikan masuk kembali ke roomPlayers
      const targetUsers = await db
        .select({ totalPoints: users.totalPoints, avatar: users.avatar })
        .from(users)
        .where(eq(users.id, playerId))
        .limit(1);

      if (pointsToDeduct > 0 && targetUsers[0]) {
        const nextPoints = Math.max(0, (targetUsers[0].totalPoints || 0) - pointsToDeduct);
        await db
          .update(users)
          .set({ totalPoints: nextPoints, updatedAt: new Date() })
          .where(eq(users.id, playerId));
        invalidateUserSessionCache(playerId);
      }

      const existingRoomPlayer = await db
        .select({ id: roomPlayers.id })
        .from(roomPlayers)
        .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, playerId)))
        .limit(1);
      if (existingRoomPlayer.length === 0) {
        await db.insert(roomPlayers).values({
          id: generateId('rpl'),
          roomId,
          userId: playerId,
          avatar: targetUsers[0]?.avatar ?? 'cat-orange',
        });
      }

      // 3. Bersihkan cache jawaban, buka blokir kick, dan broadcast skor = 0 + event rejoin-approved
      getUserAnswerCache().delete(`${roomId}:${playerId}`);
      approvePlayerRejoin(roomId, playerId);
      invalidateRoomSyncCache(roomId);

      await Promise.all([
        publishToRoom(roomId, 'score', {
          userId: playerId,
          username: '',
          score: 0,
          stars: 0,
          isCorrect: false,
        }),
        publishToRoom(roomId, 'rejoin-approved', {
          playerId,
          requests: getRejoinRequests(roomId),
        }),
      ]);

      return ok({
        success: true,
        pointsDeducted: pointsToDeduct,
        rejoinRequests: getRejoinRequests(roomId),
      });
    }

    if (action === 'reject-rejoin') {
      if (!isStaff) return fail('Hanya guru yang dapat menolak pemain', 403);
      const schema = z.object({ roomId: z.string().min(1), playerId: z.string().min(1) });
      const { roomId, playerId } = schema.parse(body);
      await assertHost(roomId, user.id);
      rejectPlayerRejoin(roomId, playerId);
      return ok({
        success: true,
        rejoinRequests: getRejoinRequests(roomId),
      });
    }

    if (action === 'reset-progress') {
      if (!isStaff) return fail('Hanya guru dan admin yang dapat me-reset progres', 403);
      const schema = z.object({
        roomId: z.string().min(1),
        targetId: z.string().min(1),
      });
      const { roomId, targetId } = schema.parse(body);

      if (targetId === 'all') {
        if (user.role !== 'admin') {
          return fail('Hanya administrator yang dapat me-reset seluruh siswa sekaligus', 403);
        }
        const allSessions = await db
          .select({ id: gameSessions.id, userId: gameSessions.userId, score: gameSessions.score })
          .from(gameSessions)
          .where(eq(gameSessions.roomId, roomId));
        const allSessionIds = allSessions.map((s) => s.id);

        if (allSessionIds.length > 0) {
          const answers = await db
            .select({ sessionId: playerAnswers.sessionId, pointsEarned: playerAnswers.pointsEarned })
            .from(playerAnswers)
            .where(inArray(playerAnswers.sessionId, allSessionIds));

          const userPointsDeduct: Record<string, number> = {};
          const sessionUserMap = new Map(allSessions.map((s) => [s.id, s.userId]));
          for (const a of answers) {
            const uId = sessionUserMap.get(a.sessionId);
            if (uId) {
              userPointsDeduct[uId] = (userPointsDeduct[uId] || 0) + (a.pointsEarned || 0);
            }
          }

          for (const [uId, deduct] of Object.entries(userPointsDeduct)) {
            if (deduct > 0) {
              const uRow = await db.select({ totalPoints: users.totalPoints }).from(users).where(eq(users.id, uId)).limit(1);
              if (uRow[0]) {
                const nextPts = Math.max(0, (uRow[0].totalPoints || 0) - deduct);
                await db.update(users).set({ totalPoints: nextPts }).where(eq(users.id, uId)).catch(() => {});
              }
            }
          }

          await Promise.all([
            db.delete(playerAnswers).where(inArray(playerAnswers.sessionId, allSessionIds)),
            db
              .update(gameSessions)
              .set({ score: 0, stars: 0, completedAt: null, updatedAt: new Date() })
              .where(inArray(gameSessions.id, allSessionIds)),
          ]);
        }

        await db.update(roomPlayers).set({ lastX: 120, lastY: 650 }).where(eq(roomPlayers.roomId, roomId));

        const ansCache = getUserAnswerCache();
        for (const key of Array.from(ansCache.keys())) {
          if (key.startsWith(`${roomId}:`)) {
            ansCache.delete(key);
          }
        }
        invalidateRoomSyncCache(roomId);

        void publishToRoom(roomId, 'cmd', { op: 'reset', targetId: 'all' });
        void publishToRoom(roomId, 'score', {
          userId: 'all',
          username: '',
          score: 0,
          stars: 0,
          isCorrect: false,
        });

        return ok({ success: true, targetId: 'all' });
      }

      // Single student reset
      const playerSessions = await db
        .select({ id: gameSessions.id, score: gameSessions.score })
        .from(gameSessions)
        .where(and(eq(gameSessions.roomId, roomId), eq(gameSessions.userId, targetId)));
      const sessionIds = playerSessions.map((s) => s.id);

      if (sessionIds.length > 0) {
        const answers = await db
          .select({ pointsEarned: playerAnswers.pointsEarned })
          .from(playerAnswers)
          .where(inArray(playerAnswers.sessionId, sessionIds));
        const answerPointsSum = answers.reduce((acc, a) => acc + (a.pointsEarned || 0), 0);
        const pointsToDeduct = Math.max(playerSessions.reduce((acc, s) => acc + (s.score || 0), 0), answerPointsSum);

        if (pointsToDeduct > 0) {
          const uRow = await db.select({ totalPoints: users.totalPoints }).from(users).where(eq(users.id, targetId)).limit(1);
          if (uRow[0]) {
            const nextPts = Math.max(0, (uRow[0].totalPoints || 0) - pointsToDeduct);
            await db.update(users).set({ totalPoints: nextPts }).where(eq(users.id, targetId)).catch(() => {});
          }
        }

        await Promise.all([
          db.delete(playerAnswers).where(inArray(playerAnswers.sessionId, sessionIds)),
          db
            .update(gameSessions)
            .set({ score: 0, stars: 0, completedAt: null, updatedAt: new Date() })
            .where(inArray(gameSessions.id, sessionIds)),
        ]);
      }

      await db
        .update(roomPlayers)
        .set({ lastX: 120, lastY: 650 })
        .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, targetId)));

      getUserAnswerCache().delete(`${roomId}:${targetId}`);
      invalidateRoomSyncCache(roomId);

      void publishToRoom(roomId, 'cmd', { op: 'reset', targetId });
      void publishToRoom(roomId, 'score', {
        userId: targetId,
        username: '',
        score: 0,
        stars: 0,
        isCorrect: false,
      });

      return ok({ success: true, targetId });
    }

    if (action === 'room-sync') {
      const schema = z.object({
        roomId: z.string().min(1),
        x: z.number().min(-10000).max(10000).optional(),
        y: z.number().min(-10000).max(10000).optional(),
        vx: z.number().min(-200).max(200).optional(),
        vy: z.number().min(-200).max(200).optional(),
        onGround: z.boolean().optional(),
        isDying: z.boolean().optional(),
        deathStartedAt: z.number().optional(),
        burnUntil: z.number().optional(),
        facing: z.number().int().min(-1).max(1).optional(),
        chatCursor: z.number().int().optional(),
        justKicked: z.boolean().optional(),
        targetId: z.string().min(1).optional(),
      });
      const { roomId, x, y, vx, vy, onGround, isDying, deathStartedAt, burnUntil, facing, chatCursor, justKicked, targetId } =
        schema.parse(body);

      if (isRoomDeleted(roomId)) {
        return ok({ roomDeleted: true, room: null, players: [], messages: [] });
      }
      if (!isStaff && isPlayerKicked(roomId, user.id)) {
        if (!justKicked) {
          const existingReqs = getRejoinRequests(roomId);
          if (!existingReqs.some((r) => r.userId === user.id)) {
            addRejoinRequest(roomId, { userId: user.id, username: user.username });
            void publishToRoom(roomId, 'rejoin-request', {
              requests: getRejoinRequests(roomId),
            });
          }
        }
        return ok({ kicked: true });
      }

      const allowedPresence = touchPresence(roomId, user.id);
      const liveMap = getLiveRoomPositions(roomId);

      // 1. Update position immediately in RAM (0ms, no DB lock!)
      if (allowedPresence && x !== undefined && y !== undefined) {
        const existingLive = liveMap.get(user.id);
        updateLivePlayerPosition(roomId, {
          userId: user.id,
          username: user.username,
          avatar: user.avatar,
          role: user.role,
          x,
          y,
          vx: vx ?? existingLive?.vx ?? 0,
          vy: vy ?? existingLive?.vy ?? 0,
          facing: facing === -1 ? -1 : 1,
          onGround: onGround ?? existingLive?.onGround ?? true,
          isDying: isDying ?? existingLive?.isDying,
          deathStartedAt: deathStartedAt ?? existingLive?.deathStartedAt,
          burnUntil: burnUntil ?? existingLive?.burnUntil,
        });

        // Checkpoint to SQLite asynchronously at most once every 3 seconds per player
        if (shouldWritePosToDb(roomId, user.id, 3000)) {
          void db
            .update(roomPlayers)
            .set({ lastX: x, lastY: y, lastFacing: facing ?? 1 })
            .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, user.id)))
            .catch(() => {});
        }
      }

      // 2. Get room & roster state (from 2500ms RAM cache or DB, invalidated immediately on mutations)
      let dbState = getCachedRoomDbState(roomId, 2500);
      if (!dbState) {
        const [scores, players, rows] = await Promise.all([
          db
            .select({ userId: gameSessions.userId, score: gameSessions.score, stars: gameSessions.stars })
            .from(gameSessions)
            .where(eq(gameSessions.roomId, roomId)),
          db
            .select({
              userId: roomPlayers.userId,
              username: users.username,
              fullName: users.fullName,
              avatar: roomPlayers.avatar,
              role: users.role,
              lastX: roomPlayers.lastX,
              lastY: roomPlayers.lastY,
              lastFacing: roomPlayers.lastFacing,
            })
            .from(roomPlayers)
            .innerJoin(users, eq(roomPlayers.userId, users.id))
            .where(eq(roomPlayers.roomId, roomId)),
          db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1),
        ]);

        let activePlayers = players;
        const roomRow = rows[0] ?? null;

        if (
          allowedPresence &&
          !activePlayers.some((p) => p.userId === user.id) &&
          roomRow &&
          roomRow.status !== 'completed'
        ) {
          await db
            .insert(roomPlayers)
            .values({
              id: generateId('rpl'),
              roomId,
              userId: user.id,
              avatar: user.avatar,
              lastX: x ?? 120,
              lastY: y ?? 600,
              lastFacing: facing ?? 1,
            })
            .catch(() => {});
          activePlayers = [
            ...activePlayers,
            {
              userId: user.id,
              username: user.username,
              fullName: user.fullName,
              avatar: user.avatar,
              role: user.role,
              lastX: x ?? 120,
              lastY: y ?? 600,
              lastFacing: facing ?? 1,
            },
          ];
        }

        const staleIds = getStaleUserIds(
          roomId,
          activePlayers.map((p) => p.userId),
        );
        if (staleIds.length > 0) {
          const staleSet = new Set(staleIds);
          activePlayers = activePlayers.filter((p) => !staleSet.has(p.userId));
          void db
            .delete(roomPlayers)
            .where(and(eq(roomPlayers.roomId, roomId), inArray(roomPlayers.userId, staleIds)))
            .catch(() => {});
        }

        const nextState = {
          room: roomRow
            ? {
                id: roomRow.id,
                status: roomRow.status,
                name: roomRow.name,
                levelId: roomRow.levelId,
                activeQuestionId: roomRow.activeQuestionId,
              }
            : null,
          players: activePlayers,
          scores,
        };
        setCachedRoomDbState(roomId, nextState);
        dbState = { ...nextState, CachedAt: Date.now() };
      }

      if (!dbState.room) {
        markRoomDeleted(roomId);
        return ok({ roomDeleted: true, room: null, players: [], messages: [] });
      }
      setLiveRoomStatus(roomId, dbState.room.status);
      if (!isStaff && isPlayerKicked(roomId, user.id)) {
        return ok({ kicked: true });
      }

      // 3. Get user's session & answered questions (cached in RAM for 8s, invalidated immediately on answer)
      // Staff yang sedang mirror siswa tertentu bisa minta jawaban siswa tersebut (bukan jawabannya sendiri)
      const effectiveUserId = isStaff && targetId && targetId !== user.id ? targetId : user.id;
      const userCacheKey = `${roomId}:${effectiveUserId}`;
      const ansCache = getUserAnswerCache();
      let userAns = ansCache.get(userCacheKey);
      if (!userAns || Date.now() - userAns.cachedAt > 8000) {
        const mySessions = await db
          .select({ id: gameSessions.id })
          .from(gameSessions)
          .where(and(eq(gameSessions.roomId, roomId), eq(gameSessions.userId, effectiveUserId)));

        let activeSessionId = mySessions[0]?.id ?? null;
        const sessionIds = mySessions.map((s) => s.id);
        if (!activeSessionId && dbState.room?.levelId && effectiveUserId === user.id) {
          const newSessionId = generateId('gsn');
          await db
            .insert(gameSessions)
            .values({
              id: newSessionId,
              roomId,
              userId: user.id,
              levelId: dbState.room.levelId,
            })
            .catch(() => {});
          activeSessionId = newSessionId;
          sessionIds.push(newSessionId);
        }

        const myAnswers =
          sessionIds.length > 0
            ? await db
                .select({
                  questionId: playerAnswers.questionId,
                  answer: playerAnswers.answer,
                  isCorrect: playerAnswers.isCorrect,
                  assisted: playerAnswers.assisted,
                })
                .from(playerAnswers)
                .where(inArray(playerAnswers.sessionId, sessionIds))
            : [];

        const answerResults: Record<string, boolean | 'assisted'> = {};
        const chosenAnswers: Record<string, string> = {};
        for (const a of myAnswers) {
          answerResults[a.questionId] = a.assisted ? 'assisted' : Boolean(a.isCorrect);
          if (a.answer) chosenAnswers[a.questionId] = a.answer;
        }
        const uniqueAnsweredIds = Object.keys(answerResults);

        userAns = {
          cachedAt: Date.now(),
          sessionId: activeSessionId,
          answeredQuestionIds: uniqueAnsweredIds,
          answerResults,
          chosenAnswers,
          // Hitung semua soal yang sudah dijawab (baik benar maupun salah) agar progres misi selalu bertambah
          correctCount: uniqueAnsweredIds.length,
        };
        ansCache.set(userCacheKey, userAns);
      }

      const freshLiveMap = getLiveRoomPositions(roomId);
      const chatSync = getEphemeralChatSince(roomId, chatCursor);

      return ok({
        sessionId: userAns.sessionId,
        room: dbState.room,
        players: dbState.players.map((p) => {
          const isMe = p.userId === user.id && x !== undefined && y !== undefined;
          const live = freshLiveMap.get(p.userId);
          return {
            ...p,
            fullName: p.fullName || live?.fullName,
            stage: live?.stage ?? 1,
            lastX: isMe ? x : (live?.x ?? p.lastX),
            lastY: isMe ? y : (live?.y ?? p.lastY),
            lastFacing: isMe ? (facing ?? 1) : (live?.facing ?? p.lastFacing),
            vx: live?.vx ?? 0,
            vy: live?.vy ?? 0,
            onGround: live?.onGround ?? true,
            isDying: live?.isDying,
            deathStartedAt: live?.deathStartedAt,
            burnUntil: live?.burnUntil,
            score: dbState!.scores.find((s) => s.userId === p.userId)?.score ?? 0,
            stars: dbState!.scores.find((s) => s.userId === p.userId)?.stars ?? 0,
          };
        }),
        messages: chatSync.messages,
        chatCursor: chatSync.chatCursor,
        answeredQuestionIds: userAns.answeredQuestionIds,
        answerResults: userAns.answerResults,
        chosenAnswers: userAns.chosenAnswers,
        correctCount: userAns.correctCount,
        rejoinRequests: isStaff ? getRejoinRequests(roomId) : undefined,
      });
    }

    return fail('Aksi tidak dikenal', 404);
  } catch (err) {
    return handleError(err);
  }
}
