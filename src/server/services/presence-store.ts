export type LivePlayerState = {
  userId: string;
  username: string;
  fullName?: string;
  avatar: string;
  role: string;
  stage?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  isDying?: boolean;
  deathStartedAt?: number;
  burnUntil?: number;
  tag?: string | null;
  colors?: { body?: string; tag?: string; nick?: string } | null;
  ropedById?: string | null;
  hp?: number;
  updatedAt: number;
};

export type CachedRoomDbState = {
  CachedAt: number;
  room: { id: string; status: string; name: string; levelId: string; activeQuestionId: string | null } | null;
  players: {
    userId: string;
    username: string;
    fullName?: string | null;
    avatar: string;
    role: string;
    lastX: number | null;
    lastY: number | null;
    lastFacing: number | null;
  }[];
  scores: { userId: string; score: number; stars: number }[];
};

export type RejoinRequest = {
  userId: string;
  username: string;
  requestedAt: number;
};

export type LiveBossState = {
  stage: number;
  bid: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  x?: number;
  dir?: number;
  updatedAt: number;
};

export type RoomObstacleState = {
  crumbles: Map<string, { stage: number; idx: number; startedAt: number }>;
  stomps: Map<string, { stage: number; id: string; until: number }>;
  powerups: Map<string, { stage: number; id: string; until: number }>;
  bosses?: Map<string, LiveBossState>;
};

const globalForPresence = globalThis as unknown as {
  __llysRoomPresence?: Map<string, Map<string, number>>;
  __llysRecentlyLeft?: Map<string, number>;
  __llysLivePositions?: Map<string, Map<string, LivePlayerState>>;
  __llysRoomDbCache?: Map<string, CachedRoomDbState>;
  __llysLastDbPosWrite?: Map<string, number>;
  __llysKickedPlayers?: Map<string, number>;
  __llysDeletedRooms?: Map<string, number>;
  __llysLiveRoomStatus?: Map<string, string>;
  __llysRejoinRequests?: Map<string, Map<string, RejoinRequest>>;
  __llysRejectedRejoins?: Map<string, number>;
  __llysRoomObstacles?: Map<string, RoomObstacleState>;
  __llysRoomPvpState?: Map<string, boolean>;
  __llysRoomCmdAccessState?: Map<string, Set<string>>;
};

function getRoomPvpStore(): Map<string, boolean> {
  if (!globalForPresence.__llysRoomPvpState) {
    globalForPresence.__llysRoomPvpState = new Map();
  }
  return globalForPresence.__llysRoomPvpState;
}

function getRoomCmdAccessStore(): Map<string, Set<string>> {
  if (!globalForPresence.__llysRoomCmdAccessState) {
    globalForPresence.__llysRoomCmdAccessState = new Map();
  }
  return globalForPresence.__llysRoomCmdAccessState;
}

export function getRoomPvpState(roomId: string): boolean {
  return getRoomPvpStore().get(roomId) ?? false;
}

export function setRoomPvpState(roomId: string, enabled: boolean): void {
  getRoomPvpStore().set(roomId, enabled);
}

export function getRoomCmdAccessUsers(roomId: string): string[] {
  const set = getRoomCmdAccessStore().get(roomId);
  return set ? Array.from(set) : [];
}

export function setRoomCmdAccess(roomId: string, targetId: string, enabled: boolean): void {
  const store = getRoomCmdAccessStore();
  let set = store.get(roomId);
  if (!set) {
    set = new Set();
    store.set(roomId, set);
  }
  if (targetId === 'all') {
    if (enabled) {
      set.add('__ALL_STUDENTS__');
    } else {
      set.clear();
    }
  } else {
    if (enabled) {
      set.add(targetId);
    } else {
      set.delete(targetId);
      set.delete('__ALL_STUDENTS__');
    }
  }
}

function getRoomObstaclesStore(): Map<string, RoomObstacleState> {
  if (!globalForPresence.__llysRoomObstacles) {
    globalForPresence.__llysRoomObstacles = new Map();
  }
  return globalForPresence.__llysRoomObstacles;
}

export function recordRoomCrumble(roomId: string, stage: number, idx: number, startedAt: number) {
  const store = getRoomObstaclesStore();
  let state = store.get(roomId);
  if (!state) {
    state = { crumbles: new Map(), stomps: new Map(), powerups: new Map() };
    store.set(roomId, state);
  }
  if (!state.powerups) state.powerups = new Map();
  state.crumbles.set(`${stage}:${idx}`, { stage, idx, startedAt });
}

export function recordRoomStomp(roomId: string, stage: number, id: string, until: number) {
  const store = getRoomObstaclesStore();
  let state = store.get(roomId);
  if (!state) {
    state = { crumbles: new Map(), stomps: new Map(), powerups: new Map() };
    store.set(roomId, state);
  }
  if (!state.powerups) state.powerups = new Map();
  state.stomps.set(`${stage}:${id}`, { stage, id, until });
}

export function recordRoomPowerUp(roomId: string, stage: number, id: string, until: number) {
  const store = getRoomObstaclesStore();
  let state = store.get(roomId);
  if (!state) {
    state = { crumbles: new Map(), stomps: new Map(), powerups: new Map(), bosses: new Map() };
    store.set(roomId, state);
  }
  if (!state.powerups) state.powerups = new Map();
  state.powerups.set(`${stage}:${id}`, { stage, id, until });
}

export function recordRoomBossHit(roomId: string, stage: number, bid: string, dmg: number, currentHp?: number) {
  const store = getRoomObstaclesStore();
  let state = store.get(roomId);
  if (!state) {
    state = { crumbles: new Map(), stomps: new Map(), powerups: new Map(), bosses: new Map() };
    store.set(roomId, state);
  }
  if (!state.bosses) state.bosses = new Map();
  const key = `${stage}:${bid}`;
  const existing = state.bosses.get(key);
  const hp = typeof currentHp === 'number' ? Math.max(0, currentHp) : existing ? Math.max(0, existing.hp - dmg) : Math.max(0, 50 - dmg);
  const maxHp = existing?.maxHp ?? Math.max(hp, 50);
  const alive = hp > 0;
  state.bosses.set(key, {
    stage,
    bid,
    hp,
    maxHp,
    alive,
    x: existing?.x,
    dir: existing?.dir,
    updatedAt: Date.now(),
  });
}

export function recordRoomBossSync(
  roomId: string,
  stage: number,
  bid: string,
  hp: number,
  maxHp: number,
  alive: boolean,
  x?: number,
  dir?: number,
) {
  const store = getRoomObstaclesStore();
  let state = store.get(roomId);
  if (!state) {
    state = { crumbles: new Map(), stomps: new Map(), powerups: new Map(), bosses: new Map() };
    store.set(roomId, state);
  }
  if (!state.bosses) state.bosses = new Map();
  state.bosses.set(`${stage}:${bid}`, {
    stage,
    bid,
    hp: Math.max(0, hp),
    maxHp: Math.max(hp, maxHp),
    alive,
    x,
    dir,
    updatedAt: Date.now(),
  });
}

export function recordRoomBossDied(roomId: string, stage: number) {
  const store = getRoomObstaclesStore();
  let state = store.get(roomId);
  if (!state) {
    state = { crumbles: new Map(), stomps: new Map(), powerups: new Map(), bosses: new Map() };
    store.set(roomId, state);
  }
  if (!state.bosses) state.bosses = new Map();
  for (const b of state.bosses.values()) {
    if (b.stage === stage) {
      b.hp = 0;
      b.alive = false;
      b.updatedAt = Date.now();
    }
  }
}

export function getLiveRoomObstacles(roomId: string) {
  const state = getRoomObstaclesStore().get(roomId);
  if (!state) return { crumbles: [], stomps: [], powerups: [] };
  const now = Date.now();
  const crumbles: { stage: number; idx: number; startedAt: number }[] = [];
  for (const [key, c] of state.crumbles.entries()) {
    if (now - c.startedAt < 3800) {
      crumbles.push(c);
    } else {
      state.crumbles.delete(key);
    }
  }
  const stomps: { stage: number; id: string; until: number }[] = [];
  for (const [key, s] of state.stomps.entries()) {
    if (s.until > now) {
      stomps.push(s);
    } else {
      state.stomps.delete(key);
    }
  }
  const powerups: { stage: number; id: string; until: number }[] = [];
  if (state.powerups) {
    for (const [key, p] of state.powerups.entries()) {
      if (p.until > now) {
        powerups.push(p);
      } else {
        state.powerups.delete(key);
      }
    }
  }
  const bosses: { stage: number; bid: string; hp: number; maxHp: number; alive: boolean; x?: number; dir?: number }[] = [];
  if (state.bosses) {
    for (const b of state.bosses.values()) {
      bosses.push({
        stage: b.stage,
        bid: b.bid,
        hp: b.hp,
        maxHp: b.maxHp,
        alive: b.alive,
        x: b.x,
        dir: b.dir,
      });
    }
  }
  return { crumbles, stomps, powerups, bosses };
}

function getRejoinRequestsStore(): Map<string, Map<string, RejoinRequest>> {
  if (!globalForPresence.__llysRejoinRequests) {
    globalForPresence.__llysRejoinRequests = new Map();
  }
  return globalForPresence.__llysRejoinRequests;
}

function getRejectedRejoinsStore(): Map<string, number> {
  if (!globalForPresence.__llysRejectedRejoins) {
    globalForPresence.__llysRejectedRejoins = new Map();
  }
  return globalForPresence.__llysRejectedRejoins;
}

function getKickedPlayersStore(): Map<string, number> {
  if (!globalForPresence.__llysKickedPlayers) {
    globalForPresence.__llysKickedPlayers = new Map();
  }
  return globalForPresence.__llysKickedPlayers;
}

function getDeletedRoomsStore(): Map<string, number> {
  if (!globalForPresence.__llysDeletedRooms) {
    globalForPresence.__llysDeletedRooms = new Map();
  }
  return globalForPresence.__llysDeletedRooms;
}

function getLiveRoomStatusStore(): Map<string, string> {
  if (!globalForPresence.__llysLiveRoomStatus) {
    globalForPresence.__llysLiveRoomStatus = new Map();
  }
  return globalForPresence.__llysLiveRoomStatus;
}

export function markPlayerKicked(roomId: string, userId: string): void {
  getKickedPlayersStore().set(`${roomId}:${userId}`, Date.now());
  getRejectedRejoinsStore().delete(`${roomId}:${userId}`);
  getRejoinRequestsStore().get(roomId)?.delete(userId);
  removePresence(roomId, userId);
}

export function clearPlayerKicked(roomId: string, userId: string): void {
  getKickedPlayersStore().delete(`${roomId}:${userId}`);
  getRecentlyLeftStore().delete(`${roomId}:${userId}`);
  getRejectedRejoinsStore().delete(`${roomId}:${userId}`);
  getRejoinRequestsStore().get(roomId)?.delete(userId);
  invalidateRoomSyncCache(roomId);
}

export function addRejoinRequest(roomId: string, user: { userId: string; username: string }): RejoinRequest {
  const store = getRejoinRequestsStore();
  let roomReqs = store.get(roomId);
  if (!roomReqs) {
    roomReqs = new Map();
    store.set(roomId, roomReqs);
  }
  getRejectedRejoinsStore().delete(`${roomId}:${user.userId}`);
  const existing = roomReqs.get(user.userId);
  if (existing) return existing;
  const entry: RejoinRequest = {
    userId: user.userId,
    username: user.username,
    requestedAt: Date.now(),
  };
  roomReqs.set(user.userId, entry);
  invalidateRoomSyncCache(roomId);
  return entry;
}

export function getRejoinRequests(roomId: string): RejoinRequest[] {
  const roomReqs = getRejoinRequestsStore().get(roomId);
  if (!roomReqs) return [];
  return Array.from(roomReqs.values());
}

export function approvePlayerRejoin(roomId: string, userId: string): void {
  clearPlayerKicked(roomId, userId);
}

export function rejectPlayerRejoin(roomId: string, userId: string): void {
  getRejoinRequestsStore().get(roomId)?.delete(userId);
  getRejectedRejoinsStore().set(`${roomId}:${userId}`, Date.now());
  invalidateRoomSyncCache(roomId);
}

export function consumeRejoinRejection(roomId: string, userId: string): boolean {
  const key = `${roomId}:${userId}`;
  const rejected = getRejectedRejoinsStore().has(key);
  if (rejected) {
    getRejectedRejoinsStore().delete(key);
    return true;
  }
  return false;
}

export function isPlayerKicked(roomId: string, userId: string): boolean {
  const kickedAt = getKickedPlayersStore().get(`${roomId}:${userId}`);
  if (!kickedAt) return false;
  if (Date.now() - kickedAt > 2 * 60 * 60 * 1000) {
    getKickedPlayersStore().delete(`${roomId}:${userId}`);
    return false;
  }
  return true;
}

export function markRoomDeleted(roomId: string): void {
  getDeletedRoomsStore().set(roomId, Date.now());
  getLiveRoomStatusStore().set(roomId, 'deleted');
  getPresenceStore().delete(roomId);
  getLivePositionsStore().delete(roomId);
  getRoomPvpStore().delete(roomId);
  getRoomCmdAccessStore().delete(roomId);
  invalidateRoomSyncCache(roomId);
}

export function isRoomDeleted(roomId: string): boolean {
  return getDeletedRoomsStore().has(roomId);
}

export function setLiveRoomStatus(roomId: string, status: string): void {
  getLiveRoomStatusStore().set(roomId, status);
}

export function getLiveRoomStatus(roomId: string): string | undefined {
  if (isRoomDeleted(roomId)) return 'deleted';
  return getLiveRoomStatusStore().get(roomId);
}

function getPresenceStore(): Map<string, Map<string, number>> {
  if (!globalForPresence.__llysRoomPresence) {
    globalForPresence.__llysRoomPresence = new Map();
  }
  return globalForPresence.__llysRoomPresence;
}

function getRecentlyLeftStore(): Map<string, number> {
  if (!globalForPresence.__llysRecentlyLeft) {
    globalForPresence.__llysRecentlyLeft = new Map();
  }
  return globalForPresence.__llysRecentlyLeft;
}

function getLivePositionsStore(): Map<string, Map<string, LivePlayerState>> {
  if (!globalForPresence.__llysLivePositions) {
    globalForPresence.__llysLivePositions = new Map();
  }
  return globalForPresence.__llysLivePositions;
}

function getRoomDbCacheStore(): Map<string, CachedRoomDbState> {
  if (!globalForPresence.__llysRoomDbCache) {
    globalForPresence.__llysRoomDbCache = new Map();
  }
  return globalForPresence.__llysRoomDbCache;
}

function getLastDbPosWriteStore(): Map<string, number> {
  if (!globalForPresence.__llysLastDbPosWrite) {
    globalForPresence.__llysLastDbPosWrite = new Map();
  }
  return globalForPresence.__llysLastDbPosWrite;
}

export function getCachedRoomDbState(roomId: string, ttlMs = 800): CachedRoomDbState | null {
  const entry = getRoomDbCacheStore().get(roomId);
  if (!entry) return null;
  if (Date.now() - entry.CachedAt > ttlMs) return null;
  return entry;
}

export function setCachedRoomDbState(roomId: string, state: Omit<CachedRoomDbState, 'CachedAt'>): void {
  getRoomDbCacheStore().set(roomId, {
    ...state,
    CachedAt: Date.now(),
  });
}

export function invalidateRoomSyncCache(roomId?: string): void {
  const store = getRoomDbCacheStore();
  if (!roomId) {
    store.clear();
  } else {
    store.delete(roomId);
  }
}

export function shouldWritePosToDb(roomId: string, userId: string, intervalMs = 3000): boolean {
  const key = `${roomId}:${userId}`;
  const store = getLastDbPosWriteStore();
  const now = Date.now();
  const last = store.get(key) ?? 0;
  if (now - last < intervalMs) return false;
  store.set(key, now);
  return true;
}

export function touchPresence(roomId: string, userId: string, explicitJoin = false): boolean {
  if (isRoomDeleted(roomId) || isPlayerKicked(roomId, userId)) {
    return false;
  }
  const key = `${roomId}:${userId}`;
  const leftStore = getRecentlyLeftStore();
  if (explicitJoin) {
    leftStore.delete(key);
    invalidateRoomSyncCache(roomId);
  } else {
    const leftAt = leftStore.get(key);
    if (leftAt && Date.now() - leftAt < 3000) {
      return false;
    }
  }

  const store = getPresenceStore();
  let roomMap = store.get(roomId);
  if (!roomMap) {
    roomMap = new Map();
    store.set(roomId, roomMap);
  }
  roomMap.set(userId, Date.now());
  return true;
}

export function updateLivePlayerPosition(
  roomId: string,
  state: Omit<LivePlayerState, 'updatedAt'>,
): LivePlayerState | null {
  if (!touchPresence(roomId, state.userId)) {
    return null;
  }
  const store = getLivePositionsStore();
  let roomPos = store.get(roomId);
  if (!roomPos) {
    roomPos = new Map();
    store.set(roomId, roomPos);
  }
  const entry: LivePlayerState = {
    ...state,
    updatedAt: Date.now(),
  };
  roomPos.set(state.userId, entry);
  return entry;
}

export function getLiveRoomPositions(roomId: string): Map<string, LivePlayerState> {
  return getLivePositionsStore().get(roomId) ?? new Map();
}

/**
 * Lepas semua tali di live-state satu room (dipakai /untake rope all).
 * Penting: tanpa ini, snapshot server masih membawa ropedById lama dan
 * mengembalikan tali yang sudah dilepas di client.
 */
export function clearRoomRopes(roomId: string): void {
  const roomPos = getLivePositionsStore().get(roomId);
  if (!roomPos) return;
  for (const entry of roomPos.values()) {
    entry.ropedById = null;
  }
}

export function removePresence(roomId: string, userId: string): void {
  const store = getPresenceStore();
  store.get(roomId)?.delete(userId);
  getLivePositionsStore().get(roomId)?.delete(userId);
  getRecentlyLeftStore().set(`${roomId}:${userId}`, Date.now());
  invalidateRoomSyncCache(roomId);
}

export function removeUserFromAllRoomsPresence(userId: string): void {
  const store = getPresenceStore();
  const posStore = getLivePositionsStore();
  const leftStore = getRecentlyLeftStore();
  const now = Date.now();
  for (const [roomId, roomMap] of store.entries()) {
    if (roomMap.has(userId)) {
      roomMap.delete(userId);
      posStore.get(roomId)?.delete(userId);
      leftStore.set(`${roomId}:${userId}`, now);
      invalidateRoomSyncCache(roomId);
    }
  }
}

export function getStaleUserIds(
  roomId: string,
  currentUserIds: string[],
  timeoutMs = 5500,
): string[] {
  const store = getPresenceStore();
  const posStore = getLivePositionsStore();
  let roomMap = store.get(roomId);
  if (!roomMap) {
    roomMap = new Map();
    store.set(roomId, roomMap);
  }
  const now = Date.now();
  const stale: string[] = [];

  for (const uid of currentUserIds) {
    const lastSeen = roomMap.get(uid);
    if (lastSeen === undefined) {
      roomMap.set(uid, now);
    } else if (now - lastSeen > timeoutMs) {
      stale.push(uid);
      roomMap.delete(uid);
      posStore.get(roomId)?.delete(uid);
    }
  }
  if (stale.length > 0) {
    invalidateRoomSyncCache(roomId);
  }
  return stale;
}
