import http from 'node:http';
import crypto from 'node:crypto';
import type { Duplex } from 'node:stream';
import type { Socket } from 'node:net';
import {
  getLiveRoomObstacles,
  getLiveRoomPositions,
  getLiveRoomStatus,
  getRejoinRequests,
  isPlayerKicked,
  isRoomDeleted,
  recordRoomCrumble,
  recordRoomPowerUp,
  recordRoomStomp,
  recordRoomBossHit,
  recordRoomBossSync,
  recordRoomBossDied,
  removePresence,
  touchPresence,
  updateLivePlayerPosition,
  clearRoomRopes,
} from './presence-store';

type WsClient = {
  id: string;
  socket: Socket;
  roomId: string;
  userId: string;
  username: string;
  avatar: string;
  role: string;
  stage: number;
  tag?: string | null;
  colors?: { body?: string; tag?: string; nick?: string } | null;
  ropedById?: string | null;
};

type SseClient = {
  id: string;
  roomId: string;
  userId: string;
  send: (jsonText: string) => boolean;
};

type WsHubState = {
  server: http.Server | null;
  port: number;
  starting: boolean;
  samePortHooked: boolean;
  samePortHookedV3?: boolean;
  upgradeHandler?: (req: http.IncomingMessage, socket: Duplex) => void;
  rawHttpHandler?: (req: http.IncomingMessage, res: http.ServerResponse) => void;
  rooms: Map<string, Map<string, WsClient>>;
  sseRooms?: Map<string, Map<string, SseClient>>;
};

const globalForWsHub = globalThis as unknown as {
  __llysWsHub?: { server?: { close: () => void } | null };
  __llysWsHubV2?: { server?: { close: () => void } | null };
  __llysWsHubV3?: { server?: { close: () => void } | null; rooms?: Map<string, Map<string, WsClient>> };
  __llysWsHubV4?: WsHubState;
};

function getHub(): WsHubState {
  if (globalForWsHub.__llysWsHub?.server) {
    try {
      globalForWsHub.__llysWsHub.server.close();
    } catch {
      // ignore
    }
    globalForWsHub.__llysWsHub = undefined;
  }
  if (globalForWsHub.__llysWsHubV2?.server) {
    try {
      globalForWsHub.__llysWsHubV2.server.close();
    } catch {
      // ignore
    }
    globalForWsHub.__llysWsHubV2 = undefined;
  }
  if (!globalForWsHub.__llysWsHubV4) {
    const inheritedRooms = globalForWsHub.__llysWsHubV3?.rooms ?? new Map<string, Map<string, WsClient>>();
    const existingServer = (globalForWsHub.__llysWsHubV3?.server as http.Server | null) ?? null;
    globalForWsHub.__llysWsHubV4 = {
      server: existingServer,
      port: existingServer ? 3001 : 0,
      starting: false,
      samePortHooked: false,
      rooms: inheritedRooms,
    };
  }
  return globalForWsHub.__llysWsHubV4;
}

function encodeWsTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.allocUnsafe(2);
    header[0] = 0x81; // FIN + text frame
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.allocUnsafe(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.allocUnsafe(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function encodeWsPongFrame(payload: Buffer): Buffer {
  const len = Math.min(payload.length, 125);
  const frame = Buffer.allocUnsafe(2 + len);
  frame[0] = 0x8a; // FIN + pong
  frame[1] = len;
  payload.copy(frame, 2, 0, len);
  return frame;
}

function addClientToRoom(client: WsClient) {
  const hub = getHub();
  let roomClients = hub.rooms.get(client.roomId);
  if (!roomClients) {
    roomClients = new Map();
    hub.rooms.set(client.roomId, roomClients);
  }
  roomClients.set(client.id, client);
}

function removeClientFromRoom(client: WsClient) {
  const hub = getHub();
  const roomClients = hub.rooms.get(client.roomId);
  if (!roomClients) return;
  roomClients.delete(client.id);
  if (roomClients.size === 0) {
    hub.rooms.delete(client.roomId);
  }
}

export function registerSseClient(
  roomId: string,
  userId: string,
  send: (jsonText: string) => boolean,
): () => void {
  const hub = getHub();
  if (!hub.sseRooms) {
    hub.sseRooms = new Map();
  }
  let roomSse = hub.sseRooms.get(roomId);
  if (!roomSse) {
    roomSse = new Map();
    hub.sseRooms.set(roomId, roomSse);
  }
  const id = `sse_${crypto.randomBytes(6).toString('hex')}`;
  roomSse.set(id, { id, roomId, userId, send });

  return () => {
    const map = hub.sseRooms?.get(roomId);
    if (!map) return;
    map.delete(id);
    if (map.size === 0) {
      hub.sseRooms?.delete(roomId);
    }
  };
}

export function broadcastRoomEvent(
  roomId: string,
  payload: Record<string, unknown>,
  excludeUserId?: string,
  excludeClientId?: string,
) {
  const hub = getHub();
  const roomClients = hub.rooms.get(roomId);
  const sseClients = hub.sseRooms?.get(roomId);
  const hasWs = Boolean(roomClients && roomClients.size > 0);
  const hasSse = Boolean(sseClients && sseClients.size > 0);
  if (!hasWs && !hasSse) return;

  const json = JSON.stringify(payload);
  let wsFrame: Buffer | null = null;

  if (roomClients && roomClients.size > 0) {
    for (const client of roomClients.values()) {
      if (excludeClientId && client.id === excludeClientId) continue;
      if (excludeUserId && client.userId === excludeUserId) continue;

      if (!client.socket.destroyed && client.socket.writable) {
        if (!wsFrame) wsFrame = encodeWsTextFrame(json);
        try {
          client.socket.write(wsFrame);
        } catch {
          // ignore write error on closing socket
        }
      }
    }
  }

  if (sseClients && sseClients.size > 0) {
    for (const sse of Array.from(sseClients.values())) {
      if (excludeUserId && sse.userId && sse.userId === excludeUserId) continue;
      const ok = sse.send(json);
      if (!ok) {
        sseClients.delete(sse.id);
      }
    }
  }
}

function handleIncomingMessage(client: WsClient, rawText: string) {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(rawText);
  } catch {
    return;
  }

  const t = msg.t;

  // Sub-millisecond Ping / Pong + Piggybacked Room Status & Kick Flag
  if (t === 'p') {
    if (typeof msg.r === 'string' && msg.r && client.roomId !== msg.r) {
      if (client.roomId) removeClientFromRoom(client);
      client.roomId = msg.r;
      addClientToRoom(client);
    }
    if (typeof msg.u === 'string' && msg.u) {
      client.userId = msg.u;
    }
    if (typeof msg.rl === 'string' && msg.rl) {
      client.role = msg.rl;
    }

    const rId = client.roomId;
    const uId = client.userId;
    const deleted = rId ? isRoomDeleted(rId) : false;
    const kicked = rId && uId && client.role !== 'teacher' ? isPlayerKicked(rId, uId) : false;
    const rs = rId ? getLiveRoomStatus(rId) : undefined;
    const rq = rId && client.role === 'teacher' ? getRejoinRequests(rId) : undefined;

    const reply = encodeWsTextFrame(
      JSON.stringify({
        t: 'po',
        c: msg.c,
        st: Date.now(),
        rs: deleted ? 'deleted' : rs,
        del: deleted ? 1 : 0,
        k: kicked ? 1 : 0,
        rq,
      }),
    );
    if (!client.socket.destroyed && client.socket.writable) {
      client.socket.write(reply);
    }
    if (rId && uId && !deleted && !kicked) {
      touchPresence(rId, uId);
    }
    return;
  }

  // Join / Authenticate Room
  if (t === 'join') {
    const roomId = typeof msg.roomId === 'string' ? msg.roomId : '';
    const userId = typeof msg.userId === 'string' ? msg.userId : '';
    if (!roomId) return;

    if (client.roomId && client.roomId !== roomId) {
      removeClientFromRoom(client);
    }
    client.roomId = roomId;
    if (userId) client.userId = userId;
    client.username = typeof msg.username === 'string' ? msg.username : client.username || 'Player';
    client.avatar = typeof msg.avatar === 'string' ? msg.avatar : client.avatar || 'cat-orange';
    client.role = typeof msg.role === 'string' ? msg.role : client.role || 'student';
    client.stage = typeof msg.stg === 'number' ? msg.stg : typeof msg.stage === 'number' ? msg.stage : client.stage || 1;
    if (msg.tg === null || typeof msg.tg === 'string') client.tag = msg.tg;
    if (msg.cl === null || (msg.cl && typeof msg.cl === 'object')) client.colors = msg.cl as WsClient['colors'];

    addClientToRoom(client);
    if (!client.userId) return;
    touchPresence(roomId, client.userId, true);

    if (typeof msg.x === 'number' && typeof msg.y === 'number') {
      updateLivePlayerPosition(roomId, {
        userId,
        username: client.username,
        avatar: client.avatar,
        role: client.role,
        stage: client.stage,
        x: msg.x,
        y: msg.y,
        vx: typeof msg.vx === 'number' ? msg.vx : 0,
        vy: typeof msg.vy === 'number' ? msg.vy : 0,
        facing: msg.f === -1 ? -1 : 1,
        onGround: Boolean(msg.g ?? true),
        tag: client.tag,
        colors: client.colors,
      });
    }

    const snapshot = Array.from(getLiveRoomPositions(roomId).values());
    const initFrame = encodeWsTextFrame(
      JSON.stringify({
        t: 'snapshot',
        players: snapshot,
        obstacles: getLiveRoomObstacles(roomId),
        st: Date.now(),
      }),
    );
    if (!client.socket.destroyed && client.socket.writable) {
      client.socket.write(initFrame);
    }

    broadcastRoomEvent(
      roomId,
      {
        t: 'peer-join',
        u: client.userId,
        un: client.username,
        av: client.avatar,
        r: client.role,
        stg: client.stage,
        tg: client.tag,
        cl: client.colors,
        x: typeof msg.x === 'number' ? msg.x : 120,
        y: typeof msg.y === 'number' ? msg.y : 600,
        f: msg.f === -1 ? -1 : 1,
      },
      undefined,
      client.id,
    );
    return;
  }

  if (!client.roomId || !client.userId) return;

  if (t === 'obstacle') {
    const op = typeof msg.op === 'string' ? msg.op : '';
    const stg = typeof msg.stg === 'number' ? msg.stg : 1;
    if (op === 'crumble' && typeof msg.idx === 'number') {
      const at = typeof msg.at === 'number' ? msg.at : Date.now();
      recordRoomCrumble(client.roomId, stg, msg.idx, at);
      broadcastRoomEvent(
        client.roomId,
        {
          t: 'obstacle',
          op: 'crumble',
          stg,
          idx: msg.idx,
          at,
        },
        client.userId,
        client.id,
      );
    } else if (op === 'stomp' && typeof msg.id === 'string') {
      const until = typeof msg.until === 'number' ? msg.until : Date.now() + 6000;
      recordRoomStomp(client.roomId, stg, msg.id, until);
      broadcastRoomEvent(
        client.roomId,
        {
          t: 'obstacle',
          op: 'stomp',
          stg,
          id: msg.id,
          until,
        },
        client.userId,
        client.id,
      );
    } else if (op === 'powerup' && typeof msg.id === 'string') {
      const until = typeof msg.until === 'number' ? msg.until : Date.now() + 40000;
      recordRoomPowerUp(client.roomId, stg, msg.id, until);
      broadcastRoomEvent(
        client.roomId,
        {
          t: 'obstacle',
          op: 'powerup',
          stg,
          id: msg.id,
          until,
        },
        client.userId,
        client.id,
      );
    } else if (op === 'shoot' && typeof msg.pid === 'string') {
      broadcastRoomEvent(
        client.roomId,
        {
          t: 'obstacle',
          op: 'shoot',
          stg,
          pid: msg.pid,
          x: typeof msg.x === 'number' ? msg.x : 0,
          y: typeof msg.y === 'number' ? msg.y : 0,
          vx: typeof msg.vx === 'number' ? msg.vx : 14,
          len: typeof msg.len === 'number' ? msg.len : undefined,
          thk: typeof msg.thk === 'number' ? msg.thk : undefined,
          color: typeof msg.color === 'string' ? msg.color : undefined,
          glow: typeof msg.glow === 'string' ? msg.glow : undefined,
          gun: typeof msg.gun === 'string' ? msg.gun : undefined,
          dmg: typeof msg.dmg === 'number' ? msg.dmg : undefined,
          weapon: typeof msg.weapon === 'string' ? msg.weapon : undefined,
          shooterRole: typeof msg.shooterRole === 'string' ? msg.shooterRole : client.role,
          shooterId: typeof msg.shooterId === 'string' ? msg.shooterId : client.userId,
        },
        client.userId,
        client.id,
      );
    } else if (op === 'boss_hit' && typeof msg.bid === 'string' && typeof msg.dmg === 'number') {
      const currentHp = typeof msg.hp === 'number' ? msg.hp : undefined;
      recordRoomBossHit(client.roomId, stg, msg.bid, msg.dmg, currentHp);
      broadcastRoomEvent(
        client.roomId,
        {
          t: 'obstacle',
          op: 'boss_hit',
          stg,
          bid: msg.bid,
          dmg: msg.dmg,
          hp: currentHp,
        },
        client.userId,
        client.id,
      );
    } else if (op === 'boss_died') {
      recordRoomBossDied(client.roomId, stg);
      broadcastRoomEvent(
        client.roomId,
        {
          t: 'obstacle',
          op: 'boss_died',
          stg,
        },
        client.userId,
        client.id,
      );
    } else if (op === 'boss_sync' && typeof msg.bid === 'string' && typeof msg.hp === 'number') {
      const maxHp = typeof msg.maxHp === 'number' ? msg.maxHp : msg.hp;
      const alive = typeof msg.alive === 'boolean' ? msg.alive : msg.hp > 0;
      const posX = typeof msg.x === 'number' ? msg.x : undefined;
      const dirX = typeof msg.dir === 'number' ? msg.dir : undefined;
      recordRoomBossSync(client.roomId, stg, msg.bid, msg.hp, maxHp, alive, posX, dirX);
      broadcastRoomEvent(
        client.roomId,
        {
          t: 'obstacle',
          op: 'boss_sync',
          stg,
          bid: msg.bid,
          hp: msg.hp,
          maxHp,
          alive,
          x: posX,
          dir: dirX,
        },
        client.userId,
        client.id,
      );
    } else if (op === 'boss_spit' && typeof msg.bid === 'string' && typeof msg.pid === 'string') {
      broadcastRoomEvent(
        client.roomId,
        {
          t: 'obstacle',
          op: 'boss_spit',
          stg,
          bid: msg.bid,
          pid: msg.pid,
          x: typeof msg.x === 'number' ? msg.x : 0,
          y: typeof msg.y === 'number' ? msg.y : 0,
          vx: typeof msg.vx === 'number' ? msg.vx : 0,
          vy: typeof msg.vy === 'number' ? msg.vy : 0.0025,
        },
        client.userId,
        client.id,
      );
    }
    return;
  }

  if (t === 'cmd') {
    if (msg.op !== 'hit' && client.role !== 'teacher' && client.role !== 'admin') return;
    // rope_all_clear: server ikut melepas tali di live-state & connection semua client
    // supaya snapshot/heartbeat berikutnya tidak mengembalikan tali yang sudah dilepas.
    if (msg.op === 'rope_all_clear') {
      clearRoomRopes(client.roomId);
      client.ropedById = null;
    }
    if (msg.op === 'rope' && typeof msg.targetId === 'string') {
      // Tali sekarang murni command-driven: live-state di-update di sini supaya
      // snapshot player baru tetap tahu siapa yang sedang diikat tali.
      const live = getLiveRoomPositions(client.roomId);
      const entry = live.get(msg.targetId);
      if (entry) {
        updateLivePlayerPosition(client.roomId, {
          userId: entry.userId,
          username: entry.username ?? '',
          avatar: entry.avatar ?? 'cat-orange',
          role: entry.role ?? 'student',
          stage: entry.stage ?? 1,
          x: entry.x,
          y: entry.y,
          vx: entry.vx ?? 0,
          vy: entry.vy ?? 0,
          facing: entry.facing === -1 ? -1 : 1,
          onGround: entry.onGround ?? true,
          tag: entry.tag,
          colors: entry.colors,
          ropedById: msg.value === false ? null : (typeof msg.byId === 'string' ? msg.byId : 'admin'),
        });
      }
    }
    broadcastRoomEvent(client.roomId, { ...msg }, client.userId, client.id);
    return;
  }

  // High-frequency kinematics / movement packet (slimmed payload supported)
  if (t === 'm') {
    if (isRoomDeleted(client.roomId)) {
      if (!client.socket.destroyed && client.socket.writable) {
        client.socket.write(
          encodeWsTextFrame(JSON.stringify({ t: 'evt', name: 'room-status', data: { status: 'deleted' } })),
        );
      }
      return;
    }
    if (client.role !== 'teacher' && isPlayerKicked(client.roomId, client.userId)) {
      if (!client.socket.destroyed && client.socket.writable) {
        client.socket.write(
          encodeWsTextFrame(
            JSON.stringify({ t: 'evt', name: 'kicked', data: { playerId: client.userId, left: false } }),
          ),
        );
      }
      removeClientFromRoom(client);
      return;
    }
    const x = typeof msg.x === 'number' ? msg.x : 0;
    const y = typeof msg.y === 'number' ? msg.y : 0;
    const vx = typeof msg.vx === 'number' ? msg.vx : 0;
    const vy = typeof msg.vy === 'number' ? msg.vy : 0;
    const facing: 1 | -1 = msg.f === -1 ? -1 : 1;
    const onGround = Boolean(msg.g);
    const isDying = Boolean(msg.d);
    const deathStartedAt = typeof msg.ds === 'number' ? msg.ds : undefined;
    const burnUntil = typeof msg.b === 'number' ? msg.b : undefined;
    const stage = typeof msg.stg === 'number' ? msg.stg : typeof msg.stage === 'number' ? msg.stage : client.stage;
    client.stage = stage;

    const updated = updateLivePlayerPosition(client.roomId, {
      userId: client.userId,
      username: client.username,
      avatar: client.avatar,
      role: client.role,
      stage,
      x,
      y,
      vx,
      vy,
      facing,
      onGround,
      isDying,
      deathStartedAt,
      burnUntil,
      tag: msg.tg === null || typeof msg.tg === 'string' ? (client.tag = msg.tg) : client.tag,
      colors:
        msg.cl === null || (msg.cl && typeof msg.cl === 'object')
          ? (client.colors = msg.cl as WsClient['colors'])
          : client.colors,
    });
    if (!updated) return;

    broadcastRoomEvent(
      client.roomId,
      {
        t: 'm',
        u: client.userId,
        un: client.username,
        av: client.avatar,
        r: client.role,
        stg: stage,
        x,
        y,
        vx,
        vy,
        f: facing,
        g: onGround ? 1 : 0,
        d: isDying ? 1 : 0,
        ds: deathStartedAt,
        b: burnUntil,
        ts: typeof msg.ts === 'number' ? msg.ts : Date.now(),
        tg: client.tag,
        cl: client.colors,
      },
      client.userId,
      client.id,
    );
    return;
  }

  if (t === 'leave') {
    removePresence(client.roomId, client.userId);
    broadcastRoomEvent(
      client.roomId,
      {
        t: 'left',
        u: client.userId,
      },
      undefined,
      client.id,
    );
    removeClientFromRoom(client);
  }
}

function attachWsConnection(socket: Socket) {
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 15000);

  const client: WsClient = {
    id: `ws_${crypto.randomBytes(6).toString('hex')}`,
    socket,
    roomId: '',
    userId: '',
    username: '',
    avatar: '',
    role: 'student',
    stage: 1,
  };

  let buffer: Buffer = Buffer.alloc(0);

  socket.on('data', (chunk: Buffer) => {
    buffer = buffer.length === 0 ? Buffer.from(chunk) : Buffer.concat([buffer, chunk]);

    while (buffer.length >= 2) {
      const byte0 = buffer[0];
      const byte1 = buffer[1];
      const opcode = byte0 & 0x0f;
      const isMasked = (byte1 & 0x80) !== 0;
      let payloadLen = byte1 & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (buffer.length < 4) return;
        payloadLen = buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (buffer.length < 10) return;
        const bigLen = buffer.readBigUInt64BE(2);
        if (bigLen > BigInt(1024 * 64)) {
          socket.destroy();
          return;
        }
        payloadLen = Number(bigLen);
        offset = 10;
      }

      const maskOffset = offset;
      if (isMasked) offset += 4;

      if (buffer.length < offset + payloadLen) return;

      const payload = Buffer.allocUnsafe(payloadLen);
      if (isMasked) {
        const m0 = buffer[maskOffset];
        const m1 = buffer[maskOffset + 1];
        const m2 = buffer[maskOffset + 2];
        const m3 = buffer[maskOffset + 3];
        const masks = [m0, m1, m2, m3];
        for (let i = 0; i < payloadLen; i += 1) {
          payload[i] = buffer[offset + i] ^ masks[i & 3];
        }
      } else {
        buffer.copy(payload, 0, offset, offset + payloadLen);
      }

      buffer = buffer.subarray(offset + payloadLen);

      if (opcode === 0x8) {
        removeClientFromRoom(client);
        socket.end();
        return;
      } else if (opcode === 0x9) {
        if (!socket.destroyed && socket.writable) {
          socket.write(encodeWsPongFrame(payload));
        }
      } else if (opcode === 0x1) {
        handleIncomingMessage(client, payload.toString('utf8'));
      }
    }
  });

  const cleanup = () => {
    if (client.roomId) {
      removeClientFromRoom(client);
    }
  };

  socket.on('close', cleanup);
  socket.on('error', cleanup);
  socket.on('end', cleanup);
}

export function handleWsUpgrade(req: http.IncomingMessage, socket: Duplex) {
  const key = req.headers['sec-websocket-key'];
  if (!key || typeof key !== 'string') {
    socket.destroy();
    return;
  }
  const accept = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  const headers =
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`;

  socket.write(headers);
  attachWsConnection(socket as Socket);
}

function handleRawPosHttpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const wsPort = getHub().port || 3001;
  const rawUrl = req.url || '/api/pos';

  if (req.method === 'GET') {
    if (rawUrl.includes('stream=1')) {
      const qIdx = rawUrl.indexOf('?');
      const params = new URLSearchParams(qIdx >= 0 ? rawUrl.slice(qIdx + 1) : '');
      const roomId = params.get('r') ?? '';
      const userId = params.get('u') ?? '';
      if (!roomId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"missing room"}');
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.socket?.setNoDelay(true);

      const sendRaw = (jsonText: string): boolean => {
        if (res.writableEnded || res.destroyed) return false;
        try {
          res.write(`data: ${jsonText}\n\n`);
          return true;
        } catch {
          return false;
        }
      };

      const snapshot = Array.from(getLiveRoomPositions(roomId).values());
      sendRaw(JSON.stringify({ t: 'snapshot', players: snapshot }));

      const cleanupSse = registerSseClient(roomId, userId, sendRaw);
      const keepAliveTimer = setInterval(() => {
        if (res.writableEnded || res.destroyed) {
          clearInterval(keepAliveTimer);
          cleanupSse();
          return;
        }
        try {
          res.write(': keepalive\n\n');
        } catch {
          clearInterval(keepAliveTimer);
          cleanupSse();
        }
      }, 15000);

      req.on('close', () => {
        clearInterval(keepAliveTimer);
        cleanupSse();
      });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({ wsPort }));
    return;
  }

  if (req.method === 'POST') {
    let rawBody = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      if (rawBody.length < 16384) rawBody += chunk;
    });
    req.on('end', () => {
      try {
        const body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
        const roomId = typeof body.r === 'string' ? body.r : '';
        const userId = typeof body.u === 'string' ? body.u : '';
        if (!roomId || !userId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end('{"error":"invalid"}');
          return;
        }

        if (isRoomDeleted(roomId)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ wsPort, roomDeleted: true, rs: 'deleted', p: [] }));
          return;
        }
        if (isPlayerKicked(roomId, userId)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ wsPort, kicked: true, p: [] }));
          return;
        }

        if (typeof body.x === 'number' && typeof body.y === 'number') {
          const username = typeof body.un === 'string' ? body.un : 'Player';
          const avatar = typeof body.av === 'string' ? body.av : 'cat-orange';
          const role = typeof body.rl === 'string' ? body.rl : 'student';
          const vx = typeof body.vx === 'number' ? body.vx : 0;
          const vy = typeof body.vy === 'number' ? body.vy : 0;
          const facing: 1 | -1 = body.f === -1 ? -1 : 1;
          const onGround = Boolean(body.g ?? true);
          const isDying = Boolean(body.d);
          const deathStartedAt = typeof body.ds === 'number' ? body.ds : undefined;
          const burnUntil = typeof body.b === 'number' ? body.b : undefined;

          const updated = updateLivePlayerPosition(roomId, {
            userId,
            username,
            avatar,
            role,
            x: body.x,
            y: body.y,
            vx,
            vy,
            facing,
            onGround,
            isDying,
            deathStartedAt,
            burnUntil,
          });

          if (updated) {
            broadcastRoomEvent(
              roomId,
              {
                t: 'm',
                u: userId,
                un: username,
                av: avatar,
                r: role,
                x: body.x,
                y: body.y,
                vx,
                vy,
                f: facing,
                g: onGround ? 1 : 0,
                d: isDying ? 1 : 0,
                ds: deathStartedAt,
                b: burnUntil,
                ts: Date.now(),
              },
              userId,
            );
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
            av: p.avatar,
            rl: p.role,
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

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify({ wsPort, rs: getLiveRoomStatus(roomId), p: peers }));
      } catch {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"p":[]}');
      }
    });
    return;
  }

  res.writeHead(405);
  res.end();
}

/**
 * Hooks directly into Next.js's main HTTP server (port 3000) so:
 * 1) Players can establish a Native WebSocket at `/ws-game` or `/api/pos` on port 3000.
 * 2) HTTP/SSE fallback requests to `/api/pos` are answered directly at the raw Node `http.Server` layer
 *    in ~0.1ms (completely bypassing Next.js App Router overhead!).
 */
function hookMainHttpServer(hub: WsHubState) {
  hub.upgradeHandler = handleWsUpgrade;
  hub.rawHttpHandler = handleRawPosHttpRequest;
  if (hub.samePortHookedV3) return;
  try {
    const proc = process as unknown as {
      _getActiveHandles?: () => Array<
        http.Server & {
          __llysSamePortWsHooked?: boolean;
          __llysSamePortWsHookedV2?: boolean;
          __llysSamePortWsHookedV3?: boolean;
          __llysWsUpgradeHandler?: (req: http.IncomingMessage, socket: Duplex) => void;
        }
      >;
    };
    const handles = proc._getActiveHandles?.() ?? [];
    for (const h of handles) {
      if (!h || typeof h.address !== 'function' || typeof h.emit !== 'function') continue;
      if (h === hub.server) continue;
      const addr = h.address();
      if (!addr || typeof addr !== 'object' || typeof addr.port !== 'number') continue;
      if (addr.port === hub.port && hub.port !== 0) continue;

      h.__llysWsUpgradeHandler = handleWsUpgrade;

      if (!h.__llysSamePortWsHookedV3) {
        h.__llysSamePortWsHookedV3 = true;
        h.__llysSamePortWsHookedV2 = true;
        h.__llysSamePortWsHooked = true;
        h.on('connection', (sock: Socket) => {
          try {
            sock.setNoDelay(true);
          } catch {
            // ignore
          }
        });

        const prevEmit = h.emit.bind(h);
        h.emit = ((event: string, ...args: unknown[]) => {
          if (event === 'upgrade') {
            const req = args[0] as http.IncomingMessage | undefined;
            const socket = args[1] as Duplex | undefined;
            if (
              req &&
              socket &&
              typeof req.url === 'string' &&
              (req.url.startsWith('/ws-game') || req.url.startsWith('/api/pos'))
            ) {
              const handler = getHub().upgradeHandler ?? h.__llysWsUpgradeHandler ?? handleWsUpgrade;
              handler(req, socket);
              return true;
            }
          }
          if (event === 'request') {
            const req = args[0] as http.IncomingMessage | undefined;
            const res = args[1] as http.ServerResponse | undefined;
            if (
              req &&
              res &&
              typeof req.url === 'string' &&
              (req.url === '/api/pos' || req.url.startsWith('/api/pos?'))
            ) {
              const rawHandler = getHub().rawHttpHandler ?? handleRawPosHttpRequest;
              rawHandler(req, res);
              return true;
            }
          }
          return prevEmit(event, ...args);
        }) as typeof h.emit;
      }
      hub.samePortHooked = true;
      hub.samePortHookedV3 = true;
    }
  } catch {
    // non-fatal if _getActiveHandles is unavailable
  }
}

export function ensureWsServer(): number {
  const hub = getHub();
  hookMainHttpServer(hub);

  if (hub.server && hub.port > 0) {
    return hub.port;
  }
  if (hub.starting) {
    return hub.port || Number(process.env.WS_PORT || 3001);
  }

  hub.starting = true;
  const preferredPort = Number(process.env.WS_PORT || 3001);

  const server = http.createServer((_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ status: 'ok', transport: 'llysSmart-ws-v4' }));
  });

  server.on('upgrade', (req: http.IncomingMessage, socket: Duplex) => {
    handleWsUpgrade(req, socket);
  });

  function tryListen(portToTry: number, attempt: number) {
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && attempt < 5) {
        tryListen(portToTry + 1, attempt + 1);
      } else {
        hub.starting = false;
      }
    });

    server.listen(portToTry, '0.0.0.0', () => {
      hub.server = server;
      hub.port = portToTry;
      hub.starting = false;
      hookMainHttpServer(hub);
    });
  }

  tryListen(preferredPort, 0);
  return hub.port || preferredPort;
}

ensureWsServer();
