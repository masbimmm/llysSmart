'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type PresencePlayer = {
  id: string;
  username: string;
  fullName?: string | null;
  customNick?: string | null;
  avatar: string;
  role?: string;
  stage?: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  facing: 1 | -1;
  onGround?: boolean;
  isDying?: boolean;
  deathStartedAt?: number;
  burnUntil?: number;
  ts?: number;
  jailedUntil?: number;
  gun?: string | null;
  hasAdminGun?: boolean;
  tag?: string | null;
  tag1?: string | null;
  tag2?: string | null;
  tag3?: string | null;
  colors?: { body?: string; tag?: string; tag1?: string; tag2?: string; tag3?: string; nick?: string } | null;
  bodyModel?: string;
  ropedById?: string | null;
};

export type ChatMessage = {
  seq?: number;
  id: string;
  userId?: string;
  senderName: string;
  senderFullName?: string;
  role?: string;
  text: string;
  createdAt: string;
};

export type PositionData = {
  id: string;
  username: string;
  fullName?: string | null;
  customNick?: string | null;
  avatar: string;
  role?: string;
  stage?: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  facing: 1 | -1;
  onGround?: boolean;
  isDying?: boolean;
  deathStartedAt?: number;
  burnUntil?: number;
  jailedUntil?: number;
  gun?: string | null;
  hasAdminGun?: boolean;
  tag?: string | null;
  tag1?: string | null;
  tag2?: string | null;
  tag3?: string | null;
  colors?: { body?: string; tag?: string; tag1?: string; tag2?: string; tag3?: string; nick?: string } | null;
  bodyModel?: string;
  ropedById?: string | null;
};

export type ScoreData = {
  userId: string;
  username: string;
  score: number;
  stars: number;
  isCorrect: boolean;
};

export type ActiveQuestion = {
  id: string;
  content: string;
  points: number;
  timeLimit: number;
  options: { label: string; content: string }[];
};

export type ObstacleEvent =
  | { op: 'crumble'; stg: number; idx: number; at: number }
  | { op: 'stomp'; stg: number; id: string; until: number }
  | { op: 'powerup'; stg: number; id: string; until: number }
  | { op: 'shoot'; stg: number; pid: string; x: number; y: number; vx: number; len?: number; thk?: number; color?: string; glow?: string; gun?: string; dmg?: number; weapon?: string; shooterRole?: string; shooterId?: string }
  | { op: 'boss_hit'; stg: number; bid: string; dmg: number; hp?: number }
  | { op: 'boss_died'; stg: number }
  | { op: 'boss_sync'; stg: number; bid: string; hp: number; maxHp?: number; alive: boolean; x?: number; dir?: number }
  | { op: 'boss_spit'; stg: number; bid: string; pid: string; x: number; y: number; vx: number; vy: number };

export type RoomCommandEvent =
  | { op: 'god'; targetId: string; value: boolean; targetName?: string }
  | { op: 'teleport'; targetId: string; stage?: number; x?: number; y?: number }
  | { op: 'reset'; targetId: string }
  | { op: 'assist_answer'; targetId: string; qid: string }
  | { op: 'gun'; targetId: string; value: boolean; weapon?: string }
  | { op: 'jail'; targetId: string; value: boolean }
  | { op: 'cosmetics'; targetId: string; tag?: string | null; tag1?: string | null; tag2?: string | null; tag3?: string | null; avatar?: string; bodyModel?: string; colors?: { body?: string; tag?: string; tag1?: string; tag2?: string; tag3?: string; nick?: string } | null }
  | { op: 'hit'; targetId: string; by: string; dmg: number; weapon?: string; shooterRole?: string }
  | { op: 'change_nick'; targetId: string; value: string }
  | { op: 'rope'; targetId: string; value: boolean; byId?: string; byName?: string }
  | { op: 'rope_all_clear' }
| { op: 'skip_stage'; targetId: string; qids: string[]; stage?: number }
  | { op: 'cmd_access'; targetId: string; value: boolean }
  | { op: 'pvp_mode'; value: boolean }
  | { op: 'mirror_question_state'; userId: string; qid: string | null; selected?: string; isSubmitted?: boolean; isCorrect?: boolean }
  | { op: 'shop_prices_update'; prices: unknown }
  | { op: 'reset_items'; itemType: 'body' | 'tag' | 'color' | 'all'; targetId: string };

type RealtimeCallbacks = {
  onDirectMove?: (player: PresencePlayer) => void;
  onDirectLeave?: (userId: string, kicked?: boolean) => void;
  onObstacleEvent?: (evt: ObstacleEvent) => void;
  onCommandEvent?: (cmd: RoomCommandEvent) => void;
};

export function useAblyRoom(
  roomId: string,
  enabled = true,
  callbacks?: RealtimeCallbacks,
) {
  const callbacksRef = useRef<RealtimeCallbacks | undefined>(callbacks);
  callbacksRef.current = callbacks;

  const wsRef = useRef<WebSocket | null>(null);
  const wsJoinedUserIdRef = useRef<string>('');
  const myInfoRef = useRef<PositionData | null>(null);
  const lastPacketTsByUserRef = useRef<Map<string, number>>(new Map());
  const serverTimeOffsetRef = useRef<number>(0);

  const [connected, setConnected] = useState(false);
  const [transportMode, setTransportMode] = useState<'ws' | 'http'>('http');
  const [pingMs, setPingMs] = useState<number>(2);
  const [presencePlayers, setPresencePlayers] = useState<PresencePlayer[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [gameEvents, setGameEvents] = useState<{ type: string; payload: unknown }[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestion | null>(null);
  const [scoreEvent, setScoreEvent] = useState<ScoreData | null>(null);
  const [kickedPlayerId, setKickedPlayerId] = useState<string | null>(null);
  const [roomStatusEvent, setRoomStatusEvent] = useState<string | null>(null);
  const [rejoinRequestsEvent, setRejoinRequestsEvent] = useState<
    { userId: string; username: string; requestedAt: number }[] | null
  >(null);
  const [approvedPlayerId, setApprovedPlayerId] = useState<string | null>(null);

  const handleIncomingMove = useCallback((p: PresencePlayer) => {
    if (!p.id || p.id === myInfoRef.current?.id) return;
    if (typeof p.ts === 'number') {
      const prevTs = lastPacketTsByUserRef.current.get(p.id) ?? 0;
      if (p.ts < prevTs) return;
      lastPacketTsByUserRef.current.set(p.id, p.ts);
    }
    if (callbacksRef.current?.onDirectMove) {
      callbacksRef.current.onDirectMove(p);
    } else {
      setPresencePlayers((prev) => {
        const next = prev.filter((item) => item.id !== p.id);
        return [...next, p];
      });
    }
  }, []);

  const handleServerPacket = useCallback(
    (msg: Record<string, unknown>) => {
      const t = msg.t;

      if (t === 'po' && typeof msg.c === 'number') {
        const rtt = Math.max(1, Math.round((performance.now() - msg.c) * 10) / 10);
        // EMA smoothing: spike tunggal (GC/nginx hiccup) tidak langsung naikkan tampilan ping
        setPingMs((prev) => (prev <= 5 ? rtt : Math.round((prev * 0.6 + rtt * 0.4) * 10) / 10));
        if (typeof msg.st === 'number') {
          serverTimeOffsetRef.current = Math.round(msg.st + rtt / 2 - Date.now());
        }
        if (msg.del === 1 || msg.rs === 'deleted') {
          setRoomStatusEvent('deleted');
        } else if (typeof msg.rs === 'string' && msg.rs) {
          setRoomStatusEvent(msg.rs);
        }
        if (Array.isArray(msg.rq)) {
          setRejoinRequestsEvent(msg.rq as { userId: string; username: string; requestedAt: number }[]);
        }
        if (msg.k === 1) {
          const myId = myInfoRef.current?.id || 'me';
          setKickedPlayerId(myId);
          setApprovedPlayerId(null);
          callbacksRef.current?.onDirectLeave?.(myId, true);
        } else if (msg.k === 0) {
          setKickedPlayerId((prev) => {
            if (prev) {
              setApprovedPlayerId(myInfoRef.current?.id || 'me');
            }
            return null;
          });
        }
        return;
      }

      if (t === 'snapshot' || t === 'init') {
        if (typeof msg.st === 'number') {
          serverTimeOffsetRef.current = Math.round(msg.st - Date.now());
        }
        if (msg.obstacles && typeof msg.obstacles === 'object') {
          const obs = msg.obstacles as {
            crumbles?: { stage: number; idx: number; startedAt: number }[];
            stomps?: { stage: number; id: string; until: number }[];
            powerups?: { stage: number; id: string; until: number }[];
            bosses?: { stage: number; bid: string; hp: number; maxHp: number; alive: boolean; x?: number; dir?: number }[];
          };
          if (Array.isArray(obs.crumbles)) {
            for (const c of obs.crumbles) {
              callbacksRef.current?.onObstacleEvent?.({ op: 'crumble', stg: c.stage, idx: c.idx, at: c.startedAt });
            }
          }
          if (Array.isArray(obs.stomps)) {
            for (const s of obs.stomps) {
              callbacksRef.current?.onObstacleEvent?.({ op: 'stomp', stg: s.stage, id: s.id, until: s.until });
            }
          }
          if (Array.isArray(obs.powerups)) {
            for (const p of obs.powerups) {
              callbacksRef.current?.onObstacleEvent?.({ op: 'powerup', stg: p.stage, id: p.id, until: p.until });
            }
          }
          if (Array.isArray(obs.bosses)) {
            for (const b of obs.bosses) {
              callbacksRef.current?.onObstacleEvent?.({
                op: 'boss_sync',
                stg: b.stage,
                bid: b.bid,
                hp: b.hp,
                maxHp: b.maxHp,
                alive: b.alive,
                x: b.x,
                dir: b.dir,
              });
            }
          }
        }
        const list = Array.isArray(msg.players) ? (msg.players as Record<string, unknown>[]) : [];
        for (const raw of list) {
          const uid = typeof raw.userId === 'string' ? raw.userId : '';
          if (!uid || uid === myInfoRef.current?.id) continue;
          handleIncomingMove({
            id: uid,
            username: typeof raw.username === 'string' ? raw.username : 'Player',
            avatar: typeof raw.avatar === 'string' ? raw.avatar : 'cat-orange',
            role: typeof raw.role === 'string' ? raw.role : undefined,
            stage: typeof raw.stage === 'number' ? raw.stage : typeof raw.stg === 'number' ? raw.stg : 1,
            x: typeof raw.x === 'number' ? raw.x : 120,
            y: typeof raw.y === 'number' ? raw.y : 600,
            vx: typeof raw.vx === 'number' ? raw.vx : 0,
            vy: typeof raw.vy === 'number' ? raw.vy : 0,
            facing: raw.facing === -1 ? -1 : 1,
            onGround: Boolean(raw.onGround ?? true),
            isDying: Boolean(raw.isDying),
            deathStartedAt: typeof raw.deathStartedAt === 'number' ? raw.deathStartedAt : undefined,
            burnUntil: typeof raw.burnUntil === 'number' ? raw.burnUntil : undefined,
            tag: typeof raw.tag === 'string' ? raw.tag : undefined,
            colors: (raw.colors && typeof raw.colors === 'object' ? raw.colors : undefined) as PositionData['colors'],
            ropedById: typeof raw.rp === 'string' ? raw.rp : typeof raw.ropedById === 'string' ? raw.ropedById : undefined,
            ts: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
          });
        }
        return;
      }

      if (t === 'peer-join') {
        const uid = typeof msg.u === 'string' ? msg.u : '';
        if (!uid || uid === myInfoRef.current?.id) return;
        handleIncomingMove({
          id: uid,
          username: typeof msg.un === 'string' ? msg.un : 'Player',
          avatar: typeof msg.av === 'string' ? msg.av : 'cat-orange',
          role: typeof msg.r === 'string' ? msg.r : undefined,
          stage: typeof msg.stg === 'number' ? msg.stg : typeof msg.stage === 'number' ? msg.stage : 1,
          x: typeof msg.x === 'number' ? msg.x : 120,
          y: typeof msg.y === 'number' ? msg.y : 600,
          vx: 0,
          vy: 0,
          facing: msg.f === -1 ? -1 : 1,
          onGround: true,
          tag: typeof msg.tg === 'string' ? msg.tg : undefined,
          colors: (msg.cl && typeof msg.cl === 'object' ? msg.cl : undefined) as PositionData['colors'],
          ropedById: typeof msg.rp === 'string' ? msg.rp : undefined,
          ts: Date.now(),
        });
        return;
      }

      if (t === 'm') {
        const uid = typeof msg.u === 'string' ? msg.u : '';
        if (!uid || uid === myInfoRef.current?.id) return;
        handleIncomingMove({
          id: uid,
          username: typeof msg.un === 'string' ? msg.un : 'Player',
          avatar: typeof msg.av === 'string' ? msg.av : 'cat-orange',
          role: typeof msg.r === 'string' ? msg.r : undefined,
          stage: typeof msg.stg === 'number' ? msg.stg : typeof msg.stage === 'number' ? msg.stage : undefined,
          x: typeof msg.x === 'number' ? msg.x : 120,
          y: typeof msg.y === 'number' ? msg.y : 600,
          vx: typeof msg.vx === 'number' ? msg.vx : 0,
          vy: typeof msg.vy === 'number' ? msg.vy : 0,
          facing: msg.f === -1 ? -1 : 1,
          onGround: Boolean(msg.g),
          isDying: Boolean(msg.d),
          deathStartedAt: typeof msg.ds === 'number' ? msg.ds : undefined,
          burnUntil: typeof msg.b === 'number' ? msg.b : undefined,
          jailedUntil: typeof msg.j === 'number' ? msg.j : undefined,
          gun: typeof msg.gn === 'string' ? msg.gn : undefined,
          tag: typeof msg.tg === 'string' ? msg.tg : undefined,
          colors: (msg.cl && typeof msg.cl === 'object' ? msg.cl : undefined) as PositionData['colors'],
          ropedById: typeof msg.rp === 'string' ? msg.rp : undefined,
          ts: typeof msg.ts === 'number' ? msg.ts : Date.now(),
        });
        return;
      }

      if (t === 'left') {
        const uid = typeof msg.u === 'string' ? msg.u : '';
        if (!uid) return;
        if (msg.kicked && uid === myInfoRef.current?.id) {
          setKickedPlayerId(uid);
        }
        if (callbacksRef.current?.onDirectLeave) {
          callbacksRef.current.onDirectLeave(uid, Boolean(msg.kicked));
        }
        setPresencePlayers((prev) => prev.filter((p) => p.id !== uid));
        return;
      }

      if (t === 'evt') {
        const name = msg.name;
        const data = msg.data as Record<string, unknown>;
        if (name === 'chat' && data) {
          setChatMessages((prev) => [...prev.slice(-29), data as unknown as ChatMessage]);
        } else if (name === 'question' && data) {
          setActiveQuestion((data.question as ActiveQuestion | null) ?? null);
        } else if (name === 'score' && data) {
          setScoreEvent(data as unknown as ScoreData);
        } else if (name === 'kicked' && data) {
          const pid = typeof data.playerId === 'string' ? data.playerId : '';
          const isVoluntaryLeave = Boolean(data.left);
          if (pid) {
            if (!isVoluntaryLeave) {
              setKickedPlayerId(pid);
            }
            callbacksRef.current?.onDirectLeave?.(pid, !isVoluntaryLeave);
            setPresencePlayers((prev) => prev.filter((p) => p.id !== pid));
          }
        } else if (name === 'room-status' && data) {
          if (typeof data.status === 'string') {
            setRoomStatusEvent(data.status);
          }
        } else if (name === 'rejoin-request' && data) {
          if (Array.isArray(data.requests)) {
            setRejoinRequestsEvent(data.requests as { userId: string; username: string; requestedAt: number }[]);
          }
        } else if (name === 'rejoin-approved' && data) {
          const pid = typeof data.playerId === 'string' ? data.playerId : '';
          if (pid) {
            setKickedPlayerId((prev) => (prev === pid || prev === 'me' ? null : prev));
            setApprovedPlayerId(pid);
          }
          if (Array.isArray(data.requests)) {
            setRejoinRequestsEvent(data.requests as { userId: string; username: string; requestedAt: number }[]);
          }
        } else if (name === 'game-event' && data) {
          setGameEvents((prev) => [...prev.slice(-49), data as { type: string; payload: unknown }]);
        }
        return;
      }

      if (t === 'obstacle') {
        const op = msg.op;
        const stg = typeof msg.stg === 'number' ? msg.stg : typeof msg.stage === 'number' ? msg.stage : 1;
        if (op === 'crumble' && typeof msg.idx === 'number' && typeof msg.at === 'number') {
          callbacksRef.current?.onObstacleEvent?.({ op: 'crumble', stg, idx: msg.idx, at: msg.at });
        } else if (op === 'stomp' && typeof msg.id === 'string' && typeof msg.until === 'number') {
          callbacksRef.current?.onObstacleEvent?.({ op: 'stomp', stg, id: msg.id, until: msg.until });
        } else if (op === 'powerup' && typeof msg.id === 'string' && typeof msg.until === 'number') {
          callbacksRef.current?.onObstacleEvent?.({ op: 'powerup', stg, id: msg.id, until: msg.until });
        } else if (op === 'shoot' && typeof msg.pid === 'string' && typeof msg.x === 'number' && typeof msg.y === 'number' && typeof msg.vx === 'number') {
          callbacksRef.current?.onObstacleEvent?.({ op: 'shoot', stg, pid: msg.pid, x: msg.x, y: msg.y, vx: msg.vx, len: typeof msg.len === 'number' ? msg.len : undefined, thk: typeof msg.thk === 'number' ? msg.thk : undefined, color: typeof msg.color === 'string' ? msg.color : undefined, glow: typeof msg.glow === 'string' ? msg.glow : undefined, gun: typeof msg.gun === 'string' ? msg.gun : undefined, dmg: typeof msg.dmg === 'number' ? msg.dmg : undefined, weapon: typeof msg.weapon === 'string' ? msg.weapon : undefined, shooterRole: typeof msg.shooterRole === 'string' ? msg.shooterRole : undefined, shooterId: typeof msg.shooterId === 'string' ? msg.shooterId : undefined });
        } else if (op === 'boss_hit' && typeof msg.bid === 'string' && typeof msg.dmg === 'number') {
          callbacksRef.current?.onObstacleEvent?.({ op: 'boss_hit', stg, bid: msg.bid, dmg: msg.dmg, hp: typeof msg.hp === 'number' ? msg.hp : undefined });
        } else if (op === 'boss_died') {
          callbacksRef.current?.onObstacleEvent?.({ op: 'boss_died', stg });
        } else if (op === 'boss_sync' && typeof msg.bid === 'string' && typeof msg.hp === 'number') {
          callbacksRef.current?.onObstacleEvent?.({
            op: 'boss_sync',
            stg,
            bid: msg.bid,
            hp: msg.hp,
            maxHp: typeof msg.maxHp === 'number' ? msg.maxHp : undefined,
            alive: typeof msg.alive === 'boolean' ? msg.alive : msg.hp > 0,
            x: typeof msg.x === 'number' ? msg.x : undefined,
            dir: typeof msg.dir === 'number' ? msg.dir : undefined,
          });
        } else if (op === 'boss_spit' && typeof msg.bid === 'string' && typeof msg.pid === 'string' && typeof msg.x === 'number' && typeof msg.y === 'number' && typeof msg.vx === 'number') {
          callbacksRef.current?.onObstacleEvent?.({ op: 'boss_spit', stg, bid: msg.bid, pid: msg.pid, x: msg.x, y: msg.y, vx: msg.vx, vy: typeof msg.vy === 'number' ? msg.vy : 0.0025 });
        }
        return;
      }

      if (t === 'cmd') {
        const op = msg.op;
        if (typeof op === 'string' && (op === 'rope_all_clear' || op === 'shop_prices_update' || typeof msg.targetId === 'string')) {
          callbacksRef.current?.onCommandEvent?.(msg as unknown as RoomCommandEvent);
        }
        return;
      }
    },
    [handleIncomingMove],
  );

  useEffect(() => {
    if (!enabled || !roomId || typeof window === 'undefined') return;

    let cancelled = false;
    let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let sseSource: EventSource | null = null;
    let currentWsPort = 3001;
    let attemptIndex = 0;

    function ensureSseFallback() {
      if (cancelled || sseSource || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) return;
      try {
        const uid = myInfoRef.current?.id ?? '';
        const es = new EventSource(`/api/pos?stream=1&r=${encodeURIComponent(roomId)}&u=${encodeURIComponent(uid)}`);
        sseSource = es;
        es.onmessage = (ev) => {
          try {
            const parsed = JSON.parse(ev.data as string);
            handleServerPacket(parsed);
          } catch {
            // ignore
          }
        };
        es.onerror = () => {
          es.close();
          if (sseSource === es) sseSource = null;
        };
      } catch {
        // ignore
      }
    }

      function connectWebSocket(port: number) {
      if (cancelled) return;
      try {
        const isHttps = window.location.protocol === 'https:';
        const proto = isHttps ? 'wss' : 'ws';
        const hostWithPort = window.location.host; // e.g. 103.x.x.x:3000 or domain
        const hostname = window.location.hostname;

        // Jika diakses via HTTPS domain/tunnel (seperti bot.kenjay.my.id) dan percobaan pertama gagal upgrade WS,
        // jangan spam retry WebSocket atau mencoba port 3001 non-TLS karena akan membebani antrean koneksi & menaikkan ping!
        if (isHttps && attemptIndex >= 1) {
          ensureSseFallback();
          return;
        }

        // Gunakan /api/pos untuk upgrade Single-Port WebSocket (tidak pernah memicu 404 Next.js jika proxy menolak Upgrade!)
        const useSamePort = isHttps || attemptIndex % 2 === 0;
        attemptIndex += 1;
        const wsUrl = useSamePort
          ? `${proto}://${hostWithPort}/api/pos`
          : `${proto}://${hostname}:${port}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        wsJoinedUserIdRef.current = '';

        ws.onopen = () => {
          if (cancelled) {
            ws.close();
            return;
          }
          attemptIndex = 0;
          if (sseSource) {
            sseSource.close();
            sseSource = null;
          }
          setConnected(true);
          setTransportMode('ws');
          if (myInfoRef.current && myInfoRef.current.id) {
            const me = myInfoRef.current;
            wsJoinedUserIdRef.current = me.id;
            ws.send(
              JSON.stringify({
                t: 'join',
                roomId,
                userId: me.id,
                username: me.username,
                avatar: me.avatar,
                role: me.role ?? 'student',
                stg: me.stage ?? 1,
                x: Math.round(me.x * 10) / 10,
                y: Math.round(me.y * 10) / 10,
                vx: Math.round((me.vx ?? 0) * 100) / 100,
                vy: Math.round((me.vy ?? 0) * 100) / 100,
                f: me.facing,
                g: me.onGround ?? true,
              }),
            );
          } else {
            // Subscribe socket ke roomId segera walau init() profil belum selesai
            ws.send(JSON.stringify({ t: 'join', roomId }));
          }
          ws.send(
            JSON.stringify({
              t: 'p',
              c: performance.now(),
              r: roomId,
              u: myInfoRef.current?.id,
              rl: myInfoRef.current?.role,
            }),
          );
        };

        ws.onmessage = (ev) => {
          try {
            const parsed = JSON.parse(ev.data as string);
            handleServerPacket(parsed);
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          if (wsRef.current === ws) {
            wsRef.current = null;
            wsJoinedUserIdRef.current = '';
          }
          setConnected(false);
          setTransportMode('http');
          ensureSseFallback();
          if (!cancelled && !(window.location.protocol === 'https:' && attemptIndex >= 1)) {
            const retryDelay = Math.min(10000, 2000 * attemptIndex);
            wsReconnectTimer = setTimeout(() => connectWebSocket(currentWsPort), retryDelay);
          }
        };

        ws.onerror = () => {
          // handled by onclose
        };
      } catch {
        // handled by reconnect
      }
    }

    // Panggil /api/pos terlebih dahulu untuk memastikan hookMainHttpServer() pada port 3000 sudah aktif
    fetch('/api/pos')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d && typeof d.wsPort === 'number' && d.wsPort > 0) {
          currentWsPort = d.wsPort;
        }
        if (!wsRef.current) {
          connectWebSocket(currentWsPort);
        }
      })
      .catch(() => {
        if (!cancelled && !wsRef.current) {
          connectWebSocket(currentWsPort);
        }
      });

    pingTimer = setInterval(() => {
      if (cancelled) return;
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const me = myInfoRef.current;
        if (me?.id && wsJoinedUserIdRef.current !== me.id) {
          wsJoinedUserIdRef.current = me.id;
          ws.send(
            JSON.stringify({
              t: 'join',
              roomId,
              userId: me.id,
              username: me.username,
              avatar: me.avatar,
              role: me.role ?? 'student',
              stg: me.stage ?? 1,
              x: Math.round(me.x * 10) / 10,
              y: Math.round(me.y * 10) / 10,
              vx: Math.round((me.vx ?? 0) * 100) / 100,
              vy: Math.round((me.vy ?? 0) * 100) / 100,
              f: me.facing,
              g: me.onGround ?? true,
            }),
          );
        }
        ws.send(
          JSON.stringify({
            t: 'p',
            c: performance.now(),
            r: roomId,
            u: me?.id,
            rl: me?.role,
          }),
        );
      }
    }, 2000);

    return () => {
      cancelled = true;
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      if (sseSource) {
        sseSource.close();
        sseSource = null;
      }

      const ws = wsRef.current;
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ t: 'leave' }));
          } catch {
            // ignore
          }
        }
        ws.close();
        wsRef.current = null;
        wsJoinedUserIdRef.current = '';
      }
    };
  }, [enabled, roomId, handleServerPacket]);

  // PENTING: publishPosition HANYA mengirim paket kompak (~70 byte) lewat WebSocket
  const publishPosition = useCallback(
    (pos: PositionData) => {
      myInfoRef.current = pos;

      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return;
      }

      if (wsJoinedUserIdRef.current !== pos.id) {
        wsJoinedUserIdRef.current = pos.id;
        try {
          ws.send(
            JSON.stringify({
              t: 'join',
              roomId,
              userId: pos.id,
              username: pos.username,
              avatar: pos.avatar,
              role: pos.role ?? 'student',
              stg: pos.stage ?? 1,
              x: Math.round(pos.x * 10) / 10,
              y: Math.round(pos.y * 10) / 10,
              vx: Math.round((pos.vx ?? 0) * 100) / 100,
              vy: Math.round((pos.vy ?? 0) * 100) / 100,
              f: pos.facing,
              g: pos.onGround ?? true,
            }),
          );
        } catch {
          return;
        }
      }

      try {
        // Slim packet: server sudah menyimpan userId, username, avatar, role saat 'join'
        ws.send(
          JSON.stringify({
            t: 'm',
            stg: pos.stage ?? 1,
            x: Math.round(pos.x * 10) / 10,
            y: Math.round(pos.y * 10) / 10,
            vx: Math.round((pos.vx ?? 0) * 100) / 100,
            vy: Math.round((pos.vy ?? 0) * 100) / 100,
            f: pos.facing,
            g: pos.onGround ? 1 : 0,
            d: pos.isDying ? 1 : 0,
            ds: pos.deathStartedAt,
            b: pos.burnUntil,
            j: pos.jailedUntil,
            gn: pos.gun ?? undefined,
            tg: pos.tag ?? undefined,
            cl: pos.colors ?? undefined,
            ts: Date.now(),
          }),
        );
      } catch {
        // ignore
      }
    },
    [roomId],
  );

  const publishObstacle = useCallback((evt: ObstacleEvent) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ t: 'obstacle', ...evt }));
    } catch {
      // ignore
    }
  }, []);

  const publishCommand = useCallback((cmd: RoomCommandEvent) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ t: 'cmd', ...cmd }));
      } catch {
        // ignore
      }
    }
  }, []);

  const getSyncedServerTime = useCallback(() => {
    return Date.now() + serverTimeOffsetRef.current;
  }, []);

  const setServerTimeOffset = useCallback((offset: number) => {
    serverTimeOffsetRef.current = offset;
  }, []);

  const publishChat = useCallback((msg: ChatMessage) => {
    void msg;
  }, []);

  const publishGameEvent = useCallback((type: string, payload: unknown) => {
    void type;
    void payload;
  }, []);

  return {
    connected,
    transportMode,
    pingMs,
    setPingMs,
    presencePlayers,
    chatMessages,
    gameEvents,
    activeQuestion,
    scoreEvent,
    kickedPlayerId,
    approvedPlayerId,
    roomStatusEvent,
    rejoinRequestsEvent,
    publishPosition,
    publishObstacle,
    publishCommand,
    getSyncedServerTime,
    setServerTimeOffset,
    publishChat,
    publishGameEvent,
  };
}
