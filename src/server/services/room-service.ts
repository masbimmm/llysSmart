import { and, eq, count, desc, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  classroomMembers,
  classrooms,
  gameEvents,
  gameSessions,
  levels,
  roomPlayers,
  rooms,
  users,
} from '@/db/schema';
import { generateCode, generateId } from '@/server/auth/crypto';
import type { RoomInput } from '@/server/middleware/validation';
import { getRejoinRequests, invalidateRoomSyncCache, setLiveRoomStatus } from './presence-store';

export class RoomError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
  }
}

export async function createRoom(hostId: string, input: RoomInput, isAdmin = false) {
  let effectiveHostId = hostId;
  if (isAdmin) {
    const clsRows = await db
      .select({ teacherId: classrooms.teacherId })
      .from(classrooms)
      .where(eq(classrooms.id, input.classroomId))
      .limit(1);
    if (clsRows[0]?.teacherId) {
      effectiveHostId = clsRows[0].teacherId;
    }
  }

  const id = generateId('room');
  await db.insert(rooms).values({
    id,
    hostId: effectiveHostId,
    classroomId: input.classroomId,
    levelId: input.levelId,
    name: input.name,
    code: generateCode(6),
    maxPlayers: input.maxPlayers,
    settings: JSON.stringify(input.settings),
    status: 'waiting',
  });
  return getRoom(id);
}

export async function getRoom(id: string) {
  const rows = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  if (!rows[0]) throw new RoomError('Ruang tidak ditemukan', 404);
  return withDetails(rows[0]);
}

export async function getRoomByCode(code: string) {
  const rows = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
  if (!rows[0]) throw new RoomError('Kode ruang tidak ditemukan', 404);
  return withDetails(rows[0]);
}

async function withDetails(room: typeof rooms.$inferSelect) {
  const players = await db
    .select({
      id: roomPlayers.id,
      userId: roomPlayers.userId,
      username: users.username,
      fullName: users.fullName,
      customNick: users.customNick,
      tag1: users.tag1,
      tag2: users.tag2,
      tag3: users.tag3,
      customColors: users.customColors,
      avatar: roomPlayers.avatar,
      role: users.role,
      lastX: roomPlayers.lastX,
      lastY: roomPlayers.lastY,
      lastFacing: roomPlayers.lastFacing,
      ready: roomPlayers.ready,
    })
    .from(roomPlayers)
    .innerJoin(users, eq(roomPlayers.userId, users.id))
    .where(eq(roomPlayers.roomId, room.id));

  const [level, classroom] = await Promise.all([
    db.select().from(levels).where(eq(levels.id, room.levelId)).limit(1),
    db.select().from(classrooms).where(eq(classrooms.id, room.classroomId)).limit(1),
  ]);

  return {
    ...room,
    settings: JSON.parse(room.settings || '{}'),
    players,
    level: level[0] ?? null,
    classroom: classroom[0] ?? null,
  };
}

export async function updateRoomStatus(
  id: string,
  hostId: string,
  status: 'waiting' | 'starting' | 'in_progress' | 'paused' | 'completed',
) {
  await assertHost(id, hostId);
  await db
    .update(rooms)
    .set({
      status,
      updatedAt: new Date(),
      startedAt: status === 'in_progress' ? new Date() : undefined,
      endedAt: status === 'completed' ? new Date() : null,
    })
    .where(eq(rooms.id, id));
  return getRoom(id);
}

export async function removePlayer(roomId: string, hostId: string, playerId: string) {
  await assertHost(roomId, hostId);
  await db
    .delete(roomPlayers)
    .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, playerId)));
}

export async function listTeacherRooms(hostId: string, isAdmin = false) {
  const rows = isAdmin
    ? await db.select().from(rooms).orderBy(desc(rooms.createdAt))
    : await db
        .select()
        .from(rooms)
        .where(eq(rooms.hostId, hostId))
        .orderBy(desc(rooms.createdAt));

  if (rows.length === 0) return [];

  const roomIds = rows.map((r) => r.id);
  const levelIds = Array.from(new Set(rows.map((r) => r.levelId)));
  const classroomIds = Array.from(new Set(rows.map((r) => r.classroomId)));
  const hostIds = Array.from(new Set(rows.map((r) => r.hostId)));

  const [allPlayers, allLevels, allClassrooms, allHosts] = await Promise.all([
    db
      .select({
        id: roomPlayers.id,
        roomId: roomPlayers.roomId,
        userId: roomPlayers.userId,
        username: users.username,
        fullName: users.fullName,
        avatar: roomPlayers.avatar,
        role: users.role,
        lastX: roomPlayers.lastX,
        lastY: roomPlayers.lastY,
        lastFacing: roomPlayers.lastFacing,
        ready: roomPlayers.ready,
      })
      .from(roomPlayers)
      .innerJoin(users, eq(roomPlayers.userId, users.id))
      .where(inArray(roomPlayers.roomId, roomIds)),
    db.select().from(levels).where(inArray(levels.id, levelIds)),
    db.select().from(classrooms).where(inArray(classrooms.id, classroomIds)),
    db
      .select({ id: users.id, username: users.username, fullName: users.fullName })
      .from(users)
      .where(inArray(users.id, hostIds)),
  ]);

  const levelMap = new Map(allLevels.map((l) => [l.id, l]));
  const classroomMap = new Map(allClassrooms.map((c) => [c.id, c]));
  const hostMap = new Map(allHosts.map((h) => [h.id, h]));

  return rows.map((room) => ({
    ...room,
    host: hostMap.get(room.hostId) ?? null,
    settings: JSON.parse(room.settings || '{}'),
    players: allPlayers.filter((p) => p.roomId === room.id),
    rejoinRequests: getRejoinRequests(room.id),
    level: levelMap.get(room.levelId) ?? null,
    classroom: classroomMap.get(room.classroomId) ?? null,
  }));
}

export async function joinRoom(code: string, userId: string, avatar: string, role: string) {
  const room = await getRoomByCode(code);
  const isStaff = role === 'teacher' || role === 'admin';

  if (!isStaff && room.status !== 'in_progress' && room.status !== 'paused') {
    throw new RoomError(
      room.status === 'waiting'
        ? 'Game belum dimulai oleh guru. Tunggu guru menekan "Mulai Game".'
        : 'Ruang game sudah berakhir.',
      409,
    );
  }
  setLiveRoomStatus(room.id, room.status);
  const existing = await db
    .select({ id: roomPlayers.id })
    .from(roomPlayers)
    .where(and(eq(roomPlayers.roomId, room.id), eq(roomPlayers.userId, userId)))
    .limit(1);

  if (existing.length === 0 && room.players.length >= room.maxPlayers && !isStaff) {
    throw new RoomError('Ruang sudah penuh', 409);
  }

  const membership = await db
    .select({ id: classroomMembers.id })
    .from(classroomMembers)
    .where(
      and(
        eq(classroomMembers.classroomId, room.classroomId),
        eq(classroomMembers.studentId, userId),
      ),
    )
    .limit(1);
  if (membership.length === 0 && !isStaff) {
    throw new RoomError('Anda belum tergabung di kelas ruang ini', 403);
  }

  if (existing.length === 0) {
    await db.insert(roomPlayers).values({
      id: generateId('rpl'),
      roomId: room.id,
      userId,
      avatar,
    });
    invalidateRoomSyncCache(room.id);
  }
  return getRoom(room.id);
}

export async function leaveRoom(roomId: string, userId: string) {
  await db
    .delete(roomPlayers)
    .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, userId)));
}

export async function assertHost(roomId: string, hostId: string) {
  const [roomRows, userRows] = await Promise.all([
    db.select({ hostId: rooms.hostId }).from(rooms).where(eq(rooms.id, roomId)).limit(1),
    db.select({ role: users.role }).from(users).where(eq(users.id, hostId)).limit(1),
  ]);
  if (!roomRows[0]) throw new RoomError('Ruang tidak ditemukan', 404);
  const isAdmin = userRows[0]?.role === 'admin';
  if (roomRows[0].hostId !== hostId && !isAdmin) {
    throw new RoomError('Hanya host atau administrator yang dapat melakukan ini', 403);
  }
}

export async function logEvent(roomId: string, userId: string | null, eventType: string, payload: unknown) {
  await db.insert(gameEvents).values({
    id: generateId('evt'),
    roomId,
    userId,
    eventType,
    payload: JSON.stringify(payload),
  });
}

export async function countPlayers(roomId: string) {
  const rows = await db
    .select({ total: count() })
    .from(roomPlayers)
    .where(eq(roomPlayers.roomId, roomId));
  return rows[0]?.total ?? 0;
}

export async function ensureSession(roomId: string, userId: string, levelId: string) {
  const existing = await db
    .select()
    .from(gameSessions)
    .where(and(eq(gameSessions.roomId, roomId), eq(gameSessions.userId, userId)))
    .limit(1);
  if (existing[0]) return existing[0];

  const id = generateId('gsn');
  await db.insert(gameSessions).values({ id, roomId, userId, levelId });
  const rows = await db.select().from(gameSessions).where(eq(gameSessions.id, id)).limit(1);
  return rows[0];
}
