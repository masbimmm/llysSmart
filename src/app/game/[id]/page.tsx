'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { type ShopPrices, DEFAULT_SHOP_PRICES } from '@/lib/shop';
import { Camera } from '@/game-engine/camera/camera';
import { updatePlayerPhysics, updateStageEntities, canShooterHitTarget, type Player, type Projectile, type BossProjectile, PLAYER_W, PLAYER_H } from '@/game-engine/physics/physics';
import { drawWorld, drawPlatforms, drawEnemies, drawPowerUps, drawProjectiles, drawCat, drawBosses, drawBossProjectiles, type BubbleEntry } from '@/game-engine/entities/render';
import {
  PHYSICS,
  PLATFORMS,
  SPAWN_POINTS,
  WORLD,
  generateQuestionBlocks,
  getStageBasePlatforms,
  createStageEnemies,
  createStagePowerUps,
  createStageBosses,
  type Platform,
  type StageBoss,
  type StageEnemy,
  type StagePowerUp,
} from '@/game-engine/maps/world';
import { soundEngine } from '@/game-engine/audio/sound-engine';
import { WEAPONS, JAIL_FREEZE_MS, parseWeaponType, parseColorArg, type PlayerColors } from '@/game-engine/physics/weapons';
import { useAblyRoom, type ObstacleEvent, type RoomCommandEvent } from '@/features/multiplayer/use-ably-room';
import type { useAblyRoom as useAblyRoomType } from '@/features/multiplayer/use-ably-room';
type AblyRoomApi = ReturnType<typeof useAblyRoom>;
import { clearCachedData } from '@/lib/client-cache';
import '../game.css';

type HudControlsConfig = {
  size: number;
  gap: number;
  opacity: number;
  swapSides: boolean;
  dpadX: number;
  dpadY: number;
  jumpX: number;
  jumpY: number;
};

const DEFAULT_HUD_CONTROLS: HudControlsConfig = {
  size: 86,
  gap: 18,
  opacity: 0.88,
  swapSides: false,
  dpadX: 0,
  dpadY: 0,
  jumpX: 0,
  jumpY: 0,
};

const HUD_CONTROLS_STORAGE_KEY = 'llys_hud_controls_v1';

type RoomPlayer = {
  userId: string;
  username: string;
  fullName?: string | null;
  customNick?: string | null;
  tag1?: string | null;
  tag2?: string | null;
  tag3?: string | null;
  customColors?: string | null;
  avatar: string;
  role?: string;
  stage?: number;
  lastX?: number;
  lastY?: number;
  lastFacing?: number;
  vx?: number;
  vy?: number;
  onGround?: boolean;
  isDying?: boolean;
  deathStartedAt?: number;
  burnUntil?: number;
  score?: number;
  tag?: string | null;
  originalFullName?: string | null;
};

type RoomData = {
  hostId: string;
  id: string;
  name: string;
  code: string;
  status: string;
  settings?: { stageCount?: number; selectedStages?: number[] };
  players: RoomPlayer[];
  level: { id: string; name: string; subject?: string; mapConfig?: string } | null;
};

function resolveSelectedStages(room: RoomData | null): number[] {
  const custom = room?.settings?.selectedStages;
  if (Array.isArray(custom) && custom.length > 0) {
    const valid = Array.from(new Set(custom.map((n) => Math.round(Number(n))).filter((n) => n >= 1 && n <= 20))).sort((a, b) => a - b);
    if (valid.length > 0) return valid;
  }
  const configured = Number(room?.settings?.stageCount);
  const count = Number.isFinite(configured) && configured >= 1 ? Math.min(20, Math.max(1, Math.round(configured))) : 4;
  return Array.from({ length: count }, (_, i) => i + 1);
}

function resolveTotalStages(room: RoomData | null): number {
  return resolveSelectedStages(room).length;
}

function parseStageInput(
  destStr: string,
  totalStages: number,
  stageList: number[],
): { stageOrder: number; realStageId: number } | null {
  const clean = destStr.trim().toLowerCase().replace(/^s(tage)?/i, '');
  const num = Number(clean);
  if (!Number.isFinite(num) || num < 1) return null;

  // 1. Cocokkan dengan urutan stage (1..totalStages)
  if (num >= 1 && num <= totalStages) {
    const order = Math.round(num);
    const realId = stageList[order - 1] ?? order;
    return { stageOrder: order, realStageId: realId };
  }

  // 2. Cocokkan dengan ID Stage asli di stageList (contoh: ketik 11 atau s11 untuk Stage 11)
  const foundIdx = stageList.findIndex((s) => s === Math.round(num));
  if (foundIdx !== -1) {
    return { stageOrder: foundIdx + 1, realStageId: stageList[foundIdx] };
  }

  return null;
}

function getMapThemeForStage(stg: number, stageList: number[]): number {
  const idx = Math.max(0, Math.min(stageList.length - 1, stg - 1));
  return stageList[idx] ?? Math.min(20, Math.max(1, stg));
}

function getStageIcon(mapTheme: number): string {
  switch (mapTheme) {
    case 20: return '👑';
    case 19: return '🦠';
    case 18: return '🌪️';
    case 17: return '🤖';
    case 16: return '🛩️';
    case 15: return '🌋';
    case 14: return '🧪';
    case 13: return '🛸';
    case 12: return '🏜️';
    case 11: return '⛈️';
    case 10: return '✈️';
    case 9: return '❄️';
    case 8: return '⚙️';
    case 7: return '🌿';
    case 6: return '🔥';
    case 5: return '⚡';
    case 4: return '🎈';
    case 3: return '💨';
    case 2: return '🌅';
    default: return '🏞️';
  }
}

function getStageTitle(mapTheme: number): string {
  switch (mapTheme) {
    case 20: return 'Puncak Tahta Void — Taklukkan Primordial Void Overlord!';
    case 19: return 'Neraka Matrix Virus — Hancurkan Drone & Virus Swarm!';
    case 18: return 'Dimensi Void Berputar — Taklukkan 85% Pijakan Runtuh & Kipas!';
    case 17: return 'Koridor Robot Mecha — Hindari Mesin Pemusnah & Sabuk Maut!';
    case 16: return 'Formasi Tempur Pesawat — Parkour Pesawat Cepat & Awan Petir!';
    case 15: return 'Benteng Magma Neraka — Lautan Lahar Luas & Dewa Vulcan!';
    case 14: return 'Mutasi Biohazard — Waspada Lumpur Beracun & Mutan Virus!';
    case 13: return 'Lab Drone Pengintai — Hindari Sensor Scanner Drone Udara!';
    case 12: return 'Gurun Reruntuhan — Lolos dari Pasir Hisap & Jurang Terjal!';
    case 11: return 'Badai Petir Angkasa — Melambung dengan Kipas Melompati Petir!';
    case 10: return 'Penerbangan Awan — Berlayar Naik Pesawat Melintasi Langit!';
    case 9: return 'Samudra Es Kutub — Awas Pijakan Licin & Retakkan Es!';
    case 8: return 'Kota Roda Gigi — Waspada Sabuk Conveyor & Gir Berputar!';
    case 7: return 'Hutan Neon Biolumin — Jelajahi Rimba & Spora Bercahaya!';
    case 6: return 'Kastil Magma — Lahar Panas & Lift Vulkanik Bergerak!';
    case 5: return 'Galaksi Cyber Pemula — Kuasai Blaster & Grid Cyber!';
    case 4: return 'Bukit Balon Udara — Melayang Santai di Awan & Trampolin!';
    case 3: return 'Lembah Kipas Angin — Terbang Tinggi dengan Hembusan Kipas!';
    case 2: return 'Menara Sunset — Tangga Batu Sunset & Patroli Virus!';
    default: return 'Lembah Kampus — Jawab Soal untuk Buka Gerbang!';
  }
}

function getStageShortName(mapTheme: number): string {
  switch (mapTheme) {
    case 20: return 'Tahta Void';
    case 19: return 'Matrix Virus';
    case 18: return 'Dimensi Void';
    case 17: return 'Robot Mecha';
    case 16: return 'Pesawat Tempur';
    case 15: return 'Benteng Magma';
    case 14: return 'Mutasi Bio';
    case 13: return 'Lab Drone';
    case 12: return 'Gurun Kuno';
    case 11: return 'Badai Petir';
    case 10: return 'Pesawat Awan';
    case 9: return 'Samudra Es';
    case 8: return 'Kota Gir';
    case 7: return 'Hutan Neon';
    case 6: return 'Kastil Magma';
    case 5: return 'Galaksi Cyber';
    case 4: return 'Bukit Balon';
    case 3: return 'Lembah Kipas';
    case 2: return 'Menara Sunset';
    default: return 'Lembah Kampus';
  }
}

function getStageQuestions<T>(allQuestions: T[], stage: number, totalStages: number): T[] {
  if (totalStages <= 1 || allQuestions.length === 0) return allQuestions;
  const perStage = Math.ceil(allQuestions.length / totalStages);
  const startIdx = Math.max(0, (stage - 1) * perStage);
  return allQuestions.slice(startIdx, startIdx + perStage);
}

function getRoomSubjectTitle(room: RoomData | null): string {
  if (!room) return 'Arena llysSmart';
  if (room.level?.subject?.trim()) return room.level.subject.trim();
  if (room.level?.mapConfig) {
    try {
      const parsed = JSON.parse(room.level.mapConfig);
      if (parsed && typeof parsed.subjectName === 'string' && parsed.subjectName.trim()) {
        return parsed.subjectName.trim();
      }
    } catch {
      // fallback below
    }
  }
  if (room.level?.name) {
    const clean = room.level.name.split(/\s*\(|\s*-/)[0]?.trim();
    if (clean) return clean;
  }
  return room.name?.split(/\s*\(|\s*-/)[0]?.trim() || 'Arena llysSmart';
}

type ChatMsg = {
  seq?: number;
  id: string;
  userId?: string;
  senderName: string;
  senderFullName?: string;
  role?: string;
  text: string;
  createdAt: string;
};

type Question = {
  id: string;
  content: string;
  points: number;
  timeLimit: number;
  options: { label: string; content: string }[];
  correctAnswer?: string;
};

const CHIP_COLORS = ['blue', 'pink', 'green', 'yellow', 'purple'] as const;
const OPTION_DISPLAY_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;

function shuffleQuestionOptions(q: Question, seedStr: string): Question {
  const opts = [...(q.options ?? [])];
  if (opts.length <= 1) return q;
  let h = 2166136261 >>> 0;
  const fullSeed = `${seedStr}:${q.id}`;
  for (let i = 0; i < fullSeed.length; i += 1) {
    h ^= fullSeed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  for (let i = opts.length - 1; i > 0; i -= 1) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const j = (h >>> 0) % (i + 1);
    const tmp = opts[i];
    opts[i] = opts[j];
    opts[j] = tmp;
  }
  return { ...q, options: opts };
}

function chipColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return CHIP_COLORS[h % CHIP_COLORS.length];
}

function CatAvatarSvg({ color }: { color: string }) {
  const palettes: Record<string, { bg: string; stroke: string; fur: string; dark: string; eye: string }> = {
    blue: { bg: '#d8ecff', stroke: '#1e4b85', fur: '#5ca0ff', dark: '#183966', eye: '#10233d' },
    pink: { bg: '#ffe0ec', stroke: '#85214b', fur: '#ff80ab', dark: '#691638', eye: '#3d1024' },
    green: { bg: '#dff7e3', stroke: '#1f6b32', fur: '#66bb6a', dark: '#174f24', eye: '#0f3618' },
    yellow: { bg: '#fff3d1', stroke: '#8a6410', fur: '#ffc93c', dark: '#6b4a08', eye: '#3d2b04' },
    purple: { bg: '#efe2ff', stroke: '#5b2f9e', fur: '#b07cff', dark: '#45227a', eye: '#2a1450' },
  };
  const p = palettes[color] ?? palettes.blue;
  return (
    <svg width="36" height="36" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill={p.bg} stroke={p.stroke} strokeWidth="3" />
      <polygon points="11,18 8,6 20,13" fill={p.fur} stroke={p.dark} strokeWidth="2.5" />
      <polygon points="37,18 40,6 28,13" fill={p.fur} stroke={p.dark} strokeWidth="2.5" />
      <ellipse cx="24" cy="27" rx="14" ry="12" fill={p.fur} stroke={p.dark} strokeWidth="2.5" />
      <ellipse cx="24" cy="30" rx="9" ry="6.5" fill="#fff" />
      <circle cx="19" cy="25" r="2.2" fill={p.eye} />
      <circle cx="29" cy="25" r="2.2" fill={p.eye} />
    </svg>
  );
}

function FinishCharacterAnimator({ bodyModel, avatar, nick }: { bodyModel: string; avatar: string; nick: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const startTime = Date.now();

    const renderFrame = () => {
      const now = Date.now();
      const elapsed = (now - startTime) * 0.005;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Celebration jump offset
      const jump = Math.abs(Math.sin(elapsed * 2.5)) * 16;
      const x = canvas.width / 2 - 20;
      const y = canvas.height - 52 - jump;

      const activeAvatar = bodyModel && bodyModel !== 'cat' ? bodyModel : (avatar || 'cat-blue');

      drawCat(
        ctx,
        x,
        y,
        PLAYER_W,
        PLAYER_H,
        activeAvatar,
        1,
        nick,
        'student',
        null,
        {
          isGodMode: false,
          velocity: { vx: 0, vy: -jump },
        }
      );

      // Confetti particles
      for (let i = 0; i < 6; i++) {
        const sx = (canvas.width / 2) + Math.cos(elapsed * 2.2 + i * 1.05) * (38 + (i % 3) * 6);
        const sy = (canvas.height / 2 - 12) + Math.sin(elapsed * 2.8 + i * 1.3) * (26 + (i % 3) * 5);
        ctx.fillStyle = i % 3 === 0 ? '#f59e0b' : i % 3 === 1 ? '#38bdf8' : '#ec4899';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [bodyModel, avatar, nick]);

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={110}
      className="finish-anim-canvas drop-shadow-md"
    />
  );
}

export default function GamePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roomId = params.id;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera | null>(null);
  const playersRef = useRef<Map<string, Player>>(new Map());
  const myIdRef = useRef<string>('');
  const keysRef = useRef({ left: false, right: false, jump: false });
  const draggingRef = useRef<{ active: boolean; x: number; y: number; moved: boolean }>({ active: false, x: 0, y: 0, moved: false });
  const lastSentRef = useRef(0);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  const [room, setRoom] = useState<RoomData | null>(null);
  const roomRef = useRef<RoomData | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [myRole, setMyRole] = useState('student');
  const myRoleRef = useRef('student');
  myRoleRef.current = myRole;
  const isStaff = myRole === 'teacher' || myRole === 'admin';
  const isAdmin = myRole === 'admin';
  const isStaffRole = (r?: string | null) => r === 'teacher' || r === 'admin';
  const [exitNotice, setExitNotice] = useState<'kicked' | 'deleted' | null>(null);
  const exitNoticeRef = useRef<'kicked' | 'deleted' | null>(null);
  const manualLeaveRef = useRef(false);
  const [chatMinimized, setChatMinimized] = useState(true);
  const [leaderboardMinimized, setLeaderboardMinimized] = useState(true);

  const [missionMinimized, setMissionMinimized] = useState(true);
  const [questionMinimized, setQuestionMinimized] = useState(true);
  const [panelsHidden, setPanelsHidden] = useState(false);
  const [panelOffsets, setPanelOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const panelDragRef = useRef<{ key: string; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const [kickModalOpen, setKickModalOpen] = useState(false);
  const [rejoinRequests, setRejoinRequests] = useState<{ userId: string; username: string; requestedAt: number }[]>([]);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [showFinishCelebration, setShowFinishCelebration] = useState(false);
  const [showShopModal, setShowShopModal] = useState(false);
  const [shopTab, setShopTab] = useState<'body' | 'tag' | 'color'>('body');
  const [shopPrices, setShopPrices] = useState<ShopPrices>(DEFAULT_SHOP_PRICES);
  const shopPricesRef = useRef<ShopPrices>(DEFAULT_SHOP_PRICES);
  const [unlockedBodies, setUnlockedBodies] = useState<string[]>(['cat']);
  const [equippedBody, setEquippedBody] = useState<string>('cat');
  const equippedBodyRef = useRef<string>('cat');
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  const previewBodyRef = useRef<string | null>(null);
  const [previewTag1, setPreviewTag1] = useState<string | null>(null);
  const previewTag1Ref = useRef<string | null>(null);
  const [previewColors, setPreviewColors] = useState<Record<string, string> | null>(null);
  const previewColorsRef = useRef<Record<string, string> | null>(null);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [shopTagInput, setShopTagInput] = useState<string>('');
  const [shopColorPart, setShopColorPart] = useState<'body' | 'tag1' | 'nick'>('body');
  const [shopColorMode, setShopColorMode] = useState<'static' | 'rgb'>('static');
  const [shopColorVal, setShopColorVal] = useState<string>('#ffd43b');
  const [shopSubmitting, setShopSubmitting] = useState(false);
  const [editingControlsLayout, setEditingControlsLayout] = useState(false);
  const [hudControls, setHudControls] = useState<HudControlsConfig>(DEFAULT_HUD_CONTROLS);
  const controlDragRef = useRef<{ group: 'dpad' | 'jump'; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [bgmVolume, setBgmVolume] = useState(0.45);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [sfxVolume, setSfxVolume] = useState(0.75);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<string[]>([]);
  const answeredIdsRef = useRef<Set<string>>(new Set());
  const answerResultsRef = useRef<Map<string, boolean | 'assisted'>>(new Map());
  const [correctCount, setCorrectCount] = useState(0);
  const [levelQuestions, setLevelQuestions] = useState<Question[]>([]);
  const levelQuestionsRef = useRef<Question[]>([]);
  const questionBlocksRef = useRef<Platform[]>([]);
  const [currentStage, setCurrentStage] = useState(1);
  const currentStageRef = useRef(1);
  const [selectedStages, setSelectedStages] = useState<number[]>([1, 2, 3, 4]);
  const selectedStagesRef = useRef<number[]>([1, 2, 3, 4]);
  const [totalStages, setTotalStages] = useState(20);
  const totalStagesRef = useRef(20);
  const stagePlatformsRef = useRef<Platform[]>(getStageBasePlatforms(1));
  const stageEnemiesRef = useRef<StageEnemy[]>(createStageEnemies(1));
  const stagePowerUpsRef = useRef<StagePowerUp[]>(createStagePowerUps(1));
  const stageBossesRef = useRef<StageBoss[]>(createStageBosses(1));
  const bossDiedBannerRef = useRef<Set<number>>(new Set());
  const gateEnterCooldownRef = useRef(0);
  const gateLockedNoticeCooldownRef = useRef(0);
  const bossStateCacheRef = useRef<Map<string, { hp: number; maxHp: number; alive: boolean; x?: number; dir?: number }>>(new Map());
  const lastBossSyncBroadcastRef = useRef<number>(0);
  const projectilesRef = useRef<Projectile[]>([]);
  const bossProjectilesRef = useRef<BossProjectile[]>([]);
  const lastShotAtRef = useRef<number>(0);
  const [ammoCount, setAmmoCount] = useState<number>(0);
  const [isGodMode, setIsGodMode] = useState(false);
  const isGodModeRef = useRef(false);
  const [mirrorTarget, setMirrorTarget] = useState<string | null>(null);
  const mirrorTargetRef = useRef<{ userId: string; username: string } | 'all' | null>(null);
  const [isCameraFreePanning, setIsCameraFreePanning] = useState(false);
  const isCameraFreePanningRef = useRef(false);
  const [spectateTargetId, setSpectateTargetId] = useState<string | null>(null);
  const spectateTargetIdRef = useRef<string | null>(null);
  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  interface AdminActionTarget {
    target: string;
    username: string;
    fullName?: string;
    role?: string;
    stage?: number;
  }
  const [actionModalTarget, setActionModalTarget] = useState<AdminActionTarget | null>(null);
  const [actionModalScope, setActionModalScope] = useState<'here' | 'all'>('here');
  // Default OFF: siswa tidak bisa menembak player lain (hanya monster/bola).
  // Guru/Admin tetap bisa. Guru bisa mengaktifkan mode tawuran via /set pvp on.
  const [isStudentPvpEnabled, setIsStudentPvpEnabled] = useState(false);
  const isStudentPvpEnabledRef = useRef(false);
  const [ropedByUserId, setRopedByUserId] = useState<string | null>(null);
  const [studentChosenAnswers, setStudentChosenAnswers] = useState<Map<string, string>>(new Map());
  const studentChosenAnswersRef = useRef<Map<string, string>>(new Map());
  const [mirroredStudentSelections, setMirroredStudentSelections] = useState<Map<string, string>>(new Map());
  const mirroredStudentSelectionRef = useRef<Map<string, string>>(new Map());
  // Posisi terakhir admin yang mengikat tali saya (untuk respawn & leash lintas stage)
  const meAdminAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const meAdminFacingRef = useRef<1 | -1>(1);
  // Ref ini dipakai sync loop untuk minta status jawaban si target mirror (bukan jawaban staff sendiri)
  const mirrorFetchTargetRef = useRef<string | null>(null);
  const [stageBanner, setStageBanner] = useState<string | null>(null);
  const stageBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Helper notif dengan auto-close: semua banner otomatis hilang, ga ada yang nyangkut
  const showBanner = useCallback((msg: string, ms = 4000) => {
    setStageBanner(msg);
    if (stageBannerTimerRef.current) clearTimeout(stageBannerTimerRef.current);
    stageBannerTimerRef.current = setTimeout(() => setStageBanner(null), ms);
  }, []);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [question, setQuestion] = useState<Question | null>(null);
  const questionRef = useRef<Question | null>(null);
  const ablyRef = useRef<AblyRoomApi | null>(null);
  const dismissedQuestionIdRef = useRef<string | null>(null);
  const closedQuestionCooldownRef = useRef<Map<string, number>>(new Map());

  const returnCameraToSelf = useCallback(() => {
    if (isCameraFreePanningRef.current) {
      isCameraFreePanningRef.current = false;
      setIsCameraFreePanning(false);
    }
    if (spectateTargetIdRef.current) {
      spectateTargetIdRef.current = null;
      setSpectateTargetId(null);
      const me = playersRef.current.get(myIdRef.current);
      if (me?.stage && me.stage !== currentStageRef.current) {
        applyStage(me.stage, { respawnPlayer: false, showToast: false, persistCheckpoint: false, force: true });
      }
      showBanner('Kamera kembali ke karaktermu.');
    }
  }, [applyStage, showBanner]);

  const toggleSpectate = useCallback((targetId: string, targetUsername: string) => {
    if (spectateTargetIdRef.current === targetId) {
      returnCameraToSelf();
      return;
    }

    spectateTargetIdRef.current = targetId;
    setSpectateTargetId(targetId);
    isCameraFreePanningRef.current = false;
    setIsCameraFreePanning(false);

    const targetP = playersRef.current.get(targetId);
    if (targetP) {
      if (targetP.stage && targetP.stage !== currentStageRef.current) {
        applyStage(targetP.stage, { respawnPlayer: false, showToast: false, persistCheckpoint: false, force: true });
      }
      if (cameraRef.current) {
        cameraRef.current.follow(targetP.x + PLAYER_W / 2, targetP.y, 0.4);
      }
    }

    // Jika staff memantau siswa, otomatis aktifkan mirror untuk melihat soal & progresnya
    if (isStaffRole(myRoleRef.current) && targetP?.role !== 'admin' && targetP?.role !== 'teacher') {
      mirrorTargetRef.current = { userId: targetId, username: targetUsername };
      mirrorFetchTargetRef.current = targetId;
      setMirrorTarget(targetUsername);
      const curStg = targetP?.stage ?? currentStageRef.current;
      const curStageQs = getStageQuestions(levelQuestionsRef.current, curStg, totalStagesRef.current);
      const curMapTheme = getMapThemeForStage(curStg, selectedStagesRef.current);
      questionBlocksRef.current = generateQuestionBlocks(
        curStageQs.map((q) => q.id),
        `${targetId}:${roomId}:s${curStg}`,
        curMapTheme,
      );
      answerResultsRef.current.clear();
      fetch('/api/game/room-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, targetId }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          const results = (d.answerResults ?? {}) as Record<string, boolean | 'assisted'>;
          for (const [qid, okAns] of Object.entries(results)) {
            answerResultsRef.current.set(qid, okAns === 'assisted' ? 'assisted' : Boolean(okAns));
          }
          if (d.chosenAnswers) {
            for (const [qid, ans] of Object.entries(d.chosenAnswers)) {
              studentChosenAnswersRef.current.set(qid, String(ans));
            }
            setStudentChosenAnswers(new Map(studentChosenAnswersRef.current));
          }
        })
        .catch(() => { });
    }

    soundEngine.playPowerUp();
    showBanner(`📹 Memantau ${targetP?.fullName || targetUsername} (Gunakan tombol gerak untuk kembali)`);
  }, [applyStage, returnCameraToSelf, roomId, showBanner]);

  const copyPlayerUsername = useCallback((uname: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(uname).catch(() => { });
    }
    soundEngine.playClick();
    showBanner(`📋 Username '${uname}' disalin ke clipboard!`);
  }, [showBanner]);

  const closeQuestionModal = useCallback((dismissId?: string) => {
    const qid = dismissId || questionRef.current?.id;
    if (qid) {
      dismissedQuestionIdRef.current = qid;
      closedQuestionCooldownRef.current.set(qid, Date.now() + 3500);
      if (!isStaff) {
        ablyRef.current?.publishCommand({ op: 'mirror_question_state', userId: myIdRef.current, qid: null });
      }
    }
    setQuestion(null);
    questionRef.current = null;
    setSelected('');
  }, [isStaff]);
  const [selected, setSelected] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; correctAnswer?: string; explanation?: string; pointsEarned: number } | null>(null);
  const [error, setError] = useState('');
  const bubblesRef = useRef<Map<string, BubbleEntry>>(new Map());
  const seenMsgIdsRef = useRef<Set<string>>(new Set());
  const chatCursorRef = useRef<number>(-1);
  const myUsernameRef = useRef<string>('');
  const myFullNameRef = useRef<string>('');
  const sessionIdRef = useRef<string>('');
  const lastSyncedPosRef = useRef<{ x: number; y: number; facing: number }>({ x: -9999, y: -9999, facing: 1 });
  const hasLeftRef = useRef(false);
  const justKickedInSessionRef = useRef(false);
  const chatMinimizedRef = useRef(chatMinimized);
  const [unreadCount, setUnreadCount] = useState(0);
  const ablyEnabled = true;

  function ingestRemotePlayerSnapshot(rp: {
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
    colors?: PlayerColors | null;
    ropedById?: string | null;
  }) {
    if (!rp.id || rp.id === myIdRef.current) return;
    const nowPerf = performance.now();
    const nowWall = Date.now();
    const pvx = typeof rp.vx === 'number' ? rp.vx : 0;
    const pvy = typeof rp.vy === 'number' ? rp.vy : 0;
    const existing = playersRef.current.get(rp.id);
    if (existing) {
      existing.targetX = rp.x;
      existing.targetY = rp.y;
      existing.vx = pvx;
      existing.vy = pvy;
      existing.facing = rp.facing;
      if (rp.avatar) {
        existing.avatar = rp.avatar;
        existing.bodyModel = (rp as any).bodyModel || (rp.avatar.startsWith('cat') ? 'cat' : rp.avatar);
      }
      if (rp.username) existing.username = rp.username;
      if (rp.fullName) existing.fullName = rp.fullName;
      if (rp.customNick !== undefined) existing.customNick = rp.customNick || undefined;
      if (typeof rp.stage === 'number') existing.stage = rp.stage;
      if (typeof rp.onGround === 'boolean') existing.onGround = rp.onGround;
      if (typeof rp.isDying === 'boolean') existing.isDying = rp.isDying;
      if (rp.deathStartedAt !== undefined) existing.deathStartedAt = rp.deathStartedAt;
      if (rp.burnUntil !== undefined) existing.burnUntil = rp.burnUntil;
      if (rp.role) existing.role = rp.role;
      if (rp.jailedUntil !== undefined) existing.jailedUntil = rp.jailedUntil;
      if (rp.gun !== undefined) existing.gun = rp.gun;
      if (rp.hasAdminGun !== undefined) existing.hasAdminGun = rp.hasAdminGun;
      if (rp.tag !== undefined) existing.tag = rp.tag;
      if (rp.tag1 !== undefined) existing.tag1 = rp.tag1 || undefined;
      if (rp.tag2 !== undefined) existing.tag2 = rp.tag2 || undefined;
      if (rp.tag3 !== undefined) existing.tag3 = rp.tag3 || undefined;
      if (rp.colors !== undefined) existing.colors = rp.colors;
      if (rp.ropedById !== undefined) existing.ropedById = rp.ropedById;
      else if (rp.ropedById === null) {
        existing.ropedById = null;
        existing.adminAnchor = undefined;
        existing.adminFacing = undefined;
      }
      if (existing.ropedById === null) {
        existing.adminAnchor = undefined;
        existing.adminFacing = undefined;
      }

      if (!existing.snapshots) existing.snapshots = [];
      const snaps = existing.snapshots;
      const lastSnap = snaps[snaps.length - 1];
      const hasMovedSinceLastSnap =
        !lastSnap ||
        Math.abs(rp.x - lastSnap.x) > 0.08 ||
        Math.abs(rp.y - lastSnap.y) > 0.08 ||
        Math.abs(pvx - lastSnap.vx) > 0.04 ||
        Math.abs(pvy - lastSnap.vy) > 0.04;
      if (hasMovedSinceLastSnap) {
        if (lastSnap) {
          const dt = Math.max(12, Math.min(220, nowPerf - lastSnap.time));
          existing.avgInterval =
            existing.avgInterval !== undefined ? existing.avgInterval * 0.75 + dt * 0.25 : dt;
        }
        snaps.push({ x: rp.x, y: rp.y, vx: pvx, vy: pvy, time: nowPerf });
        if (snaps.length > 10) snaps.splice(0, snaps.length - 10);
      }
      existing.lastPacketAt = nowWall;
    } else {
      const matchPl = roomRef.current?.players?.find((pl) => pl.userId === rp.id);
      const resolvedFullName = rp.fullName || matchPl?.fullName || undefined;
      playersRef.current.set(rp.id, {
        id: rp.id,
        username: rp.username,
        fullName: resolvedFullName,
        customNick: rp.customNick || matchPl?.customNick || undefined,
        avatar: rp.avatar,
        role: rp.role,
        stage: rp.stage ?? 1,
        x: rp.x,
        y: rp.y,
        targetX: rp.x,
        targetY: rp.y,
        vx: pvx,
        vy: pvy,
        facing: rp.facing,
        onGround: rp.onGround ?? true,
        isDying: rp.isDying,
        deathStartedAt: rp.deathStartedAt,
        burnUntil: rp.burnUntil,
        jailedUntil: rp.jailedUntil,
        gun: rp.gun,
        hasAdminGun: rp.hasAdminGun,
        tag: rp.tag || matchPl?.tag1 || undefined,
        tag1: rp.tag1 || matchPl?.tag1 || undefined,
        tag2: rp.tag2 || matchPl?.tag2 || undefined,
        tag3: rp.tag3 || matchPl?.tag3 || undefined,
        colors: rp.colors,
        ropedById: rp.ropedById,
        avgInterval: 24,
        snapshots: [{ x: rp.x, y: rp.y, vx: pvx, vy: pvy, time: nowPerf }],
        lastPacketAt: nowWall,
      });
    }
  }

  function triggerForcedExit(reason: 'kicked' | 'deleted') {
    if (manualLeaveRef.current) return;
    if (exitNoticeRef.current === 'deleted' || exitNoticeRef.current === reason) return;
    if (reason === 'kicked' && isStaffRole(myRoleRef.current)) return;
    exitNoticeRef.current = reason;
    hasLeftRef.current = true;
    keysRef.current.left = false;
    keysRef.current.right = false;
    keysRef.current.jump = false;
    questionRef.current = null;
    setQuestion(null);
    setFeedback(null);
    const me = playersRef.current.get(myIdRef.current);
    if (me) {
      me.vx = 0;
      me.vy = 0;
    }
    setExitNotice(reason);
  }

  function applyStage(
    nextStage: number,
    opts?: {
      respawnPlayer?: boolean;
      showToast?: boolean;
      seedId?: string;
      allQuestions?: Question[];
      totalStg?: number;
      persistCheckpoint?: boolean;
      force?: boolean;
    },
  ) {
    const tStg = opts?.totalStg ?? totalStagesRef.current;
    const stg = Math.max(1, Math.min(tStg, nextStage));

    // Siswa tidak dapat melompati stage tanpa menyelesaikan soal stage sebelumnya & mengalahkan boss
    // (kecuali force: misalnya ditarik tali admin lintas stage atau init)
    if (!opts?.force && !isStaff && stg > currentStageRef.current) {
      const allQsForCheck = opts?.allQuestions ?? levelQuestionsRef.current;
      const curStageQs = getStageQuestions(allQsForCheck, currentStageRef.current, tStg);
      const isCleared = curStageQs.length === 0 || curStageQs.every((q) => answeredIdsRef.current.has(q.id));
      const bossAlive = stageBossesRef.current.some((b) => b.alive);
      if (!isCleared || bossAlive) {
        return;
      }
    }

    const mapTheme = getMapThemeForStage(stg, selectedStagesRef.current);
    currentStageRef.current = stg;
    setCurrentStage(stg);
    stagePlatformsRef.current = getStageBasePlatforms(mapTheme);
    stageEnemiesRef.current = createStageEnemies(mapTheme);
    stagePowerUpsRef.current = createStagePowerUps(mapTheme);
    const defaultBosses = createStageBosses(mapTheme);
    for (const b of defaultBosses) {
      const cached = bossStateCacheRef.current.get(`${stg}:${b.id}`);
      if (cached) {
        b.hp = cached.hp;
        if (typeof cached.maxHp === 'number') b.maxHp = cached.maxHp;
        b.alive = cached.alive;
        if (typeof cached.x === 'number') b.x = cached.x;
        if (typeof cached.dir === 'number') b.dir = cached.dir === -1 ? -1 : 1;
      }
    }
    stageBossesRef.current = defaultBosses;
    bossDiedBannerRef.current.delete(stg);
    projectilesRef.current = [];
    {
      const meNow = playersRef.current.get(myIdRef.current);
      if (!meNow || (!meNow.hasAdminGun && !meNow.gun)) {
        setAmmoCount(0);
      } else if (meNow.hasAdminGun && meNow.gun) {
        meNow.blasterAmmo = Infinity;
        setAmmoCount(Infinity);
      }
    }

    const allQs = opts?.allQuestions ?? levelQuestionsRef.current;
    const stageQs = getStageQuestions(allQs, stg, tStg);
    const uid = opts?.seedId || myIdRef.current || 'anon';

    // Default Guru & Admin: kotak soal bersih/hilang total, kecuali sedang mirror!
    if (isStaffRole(myRoleRef.current) && !mirrorTargetRef.current) {
      questionBlocksRef.current = [];
    } else {
      const mirror = mirrorTargetRef.current;
      const seedUserId = mirror && mirror !== 'all' ? mirror.userId : uid;
      questionBlocksRef.current = generateQuestionBlocks(
        stageQs.map((q) => q.id),
        `${seedUserId}:${roomId}:s${stg}`,
        mapTheme,
      );
    }

    if (opts?.persistCheckpoint !== false && uid && roomId) {
      try {
        window.localStorage.setItem(`llys_stage_${roomId}_${uid}`, String(stg));
      } catch {
        // ignore storage error
      }
    }

    const me = playersRef.current.get(myIdRef.current);
    if (me) {
      me.stage = stg;
      if (opts?.respawnPlayer) {
        me.x = me.spawnX ?? 120;
        me.y = me.spawnY ?? 600;
        me.vx = 0;
        me.vy = 0;
        me.onGround = false;
        me.ridingPlatform = null;
        me.isDying = false;
        me.deathStartedAt = undefined;
        me.burnUntil = undefined;
        if (me.hasAdminGun && me.gun) {
          me.blasterAmmo = Infinity;
          me.blasterUntil = undefined;
        } else {
          me.gun = null;
          me.blasterAmmo = 0;
          me.blasterUntil = undefined;
        }
      } else if (me.isDying) {
        // Pindah stage tanpa respawn eksplisit (misalnya ditarik tali admin lintas stage):
        // pastikan state death di-reset supaya tidak infinite respawn.
        me.isDying = false;
        me.deathStartedAt = undefined;
        me.burnUntil = undefined;
      }
      if (ably.connected) {
        ably.publishPosition({
          id: me.id,
          username: me.username,
          avatar: me.avatar,
          role: myRole,
          stage: stg,
          x: me.x,
          y: me.y,
          vx: me.vx,
          vy: me.vy,
          facing: me.facing,
          onGround: me.onGround,
          isDying: me.isDying,
          deathStartedAt: me.deathStartedAt,
          burnUntil: me.burnUntil,
          tag: me.tag,
          tag1: me.tag1,
          tag2: me.tag2,
          tag3: me.tag3,
          customNick: me.customNick,
          colors: me.colors,
        });
      }
    }

    if (opts?.showToast) {
      soundEngine.playAnswerCorrect();
      const icon = getStageIcon(mapTheme);
      const desc = getStageTitle(mapTheme);
      const label = `${icon} STAGE ${stg}/${tStg}: ${desc} (${stageQs.length} Soal)`;
      const bossLabel = createStageBosses(mapTheme)[0];
      showBanner(bossLabel ? `${label} ⚔️ BOSS: ${bossLabel.name} — Tembak sampai mati untuk dapat kunci!` : label, 4200);
    }
  }

  function handleRejoinApproved() {
    if (exitNoticeRef.current !== 'kicked') return;
    exitNoticeRef.current = null;
    hasLeftRef.current = false;
    justKickedInSessionRef.current = false;
    setExitNotice(null);
    answeredIdsRef.current.clear();
    answerResultsRef.current.clear();
    setAnsweredQuestionIds([]);
    setCorrectCount(0);
    questionRef.current = null;
    setQuestion(null);
    setFeedback(null);
    // Guru/Admin selalu mulai dengan mirror OFF saat rejoin
    mirrorTargetRef.current = null;
    setMirrorTarget(null);
    questionBlocksRef.current = [];
    if (myIdRef.current) {
      setScores((prev) => ({ ...prev, [myIdRef.current]: 0 }));
      const shuffleSeed = `${myIdRef.current}:${roomId}:${Date.now()}`;
      setLevelQuestions((prev) => {
        const next = prev.map((q) => shuffleQuestionOptions(q, shuffleSeed));
        levelQuestionsRef.current = next;
        applyStage(1, {
          respawnPlayer: true,
          showToast: true,
          seedId: myIdRef.current,
          allQuestions: next,
        });
        return next;
      });
    }
  }

  function applyLiveRoomStatus(nextStatus: string) {
    if (!nextStatus) return;
    if (nextStatus === 'deleted') {
      if (isStaffRole(myRoleRef.current)) {
        manualLeaveRef.current = true;
        hasLeftRef.current = true;
        router.replace('/dashboard/teacher/rooms');
      } else {
        triggerForcedExit('deleted');
      }
      return;
    }
    if (nextStatus === 'completed') {
      manualLeaveRef.current = true;
      hasLeftRef.current = true;
      router.replace(isStaffRole(myRoleRef.current) ? '/dashboard/teacher/rooms' : '/dashboard/student');
      return;
    }
    if (nextStatus === 'paused') {
      keysRef.current.left = false;
      keysRef.current.right = false;
      keysRef.current.jump = false;
      const me = playersRef.current.get(myIdRef.current);
      if (me) {
        me.vx = 0;
        me.vy = 0;
      }
    }
    if (roomRef.current) {
      roomRef.current = { ...roomRef.current, status: nextStatus };
    }
    setRoom((prev) => (prev && prev.status !== nextStatus ? { ...prev, status: nextStatus } : prev));
  }

  const pendingObstacleUploadRef = useRef<ObstacleEvent | null>(null);

  const applyObstacleEvent = useCallback((evt: ObstacleEvent) => {
    const curStg = currentStageRef.current;
    if (evt.stg !== curStg) return;
    if (evt.op === 'crumble') {
      const plat = stagePlatformsRef.current[evt.idx];
      if (plat && plat.type === 'crumble') {
        plat.crumbleStartedAt = evt.at;
      }
    } else if (evt.op === 'stomp') {
      const enemy = stageEnemiesRef.current.find((e) => e.id === evt.id);
      if (enemy) {
        enemy.stompedUntil = Math.max(enemy.stompedUntil ?? 0, evt.until);
      }
    } else if (evt.op === 'powerup') {
      const pu = stagePowerUpsRef.current.find((p) => p.id === evt.id);
      if (pu) {
        pu.collectedUntil = Math.max(pu.collectedUntil ?? 0, evt.until);
      }
    } else if (evt.op === 'shoot') {
      if (projectilesRef.current.some((pr) => pr.id === evt.pid)) return;
      projectilesRef.current.push({
        id: evt.pid,
        x: evt.x,
        y: evt.y,
        vx: evt.vx,
        shooterId: evt.shooterId ?? 'remote',
        stage: evt.stg,
        createdAt: Date.now(),
        kind: evt.gun ? 'admin-round' : 'blaster',
        damage: evt.dmg,
        length: evt.len,
        thickness: evt.thk,
        color: evt.color,
        glow: evt.glow,
        weapon: evt.weapon as Projectile['weapon'],
        shooterRole: evt.shooterRole,
      });
      soundEngine.playShoot();
    } else if (evt.op === 'boss_hit') {
      const cacheKey = `${evt.stg}:${evt.bid}`;
      const existing = bossStateCacheRef.current.get(cacheKey);
      const newHp = typeof evt.hp === 'number' ? Math.max(0, evt.hp) : existing ? Math.max(0, existing.hp - evt.dmg) : Math.max(0, 50 - evt.dmg);
      bossStateCacheRef.current.set(cacheKey, {
        hp: newHp,
        maxHp: existing?.maxHp ?? Math.max(newHp, 50),
        alive: newHp > 0,
        x: existing?.x,
        dir: existing?.dir,
      });

      if (currentStageRef.current === evt.stg) {
        const b = stageBossesRef.current.find((x) => x.id === evt.bid);
        if (b) {
          b.hp = newHp;
          b.hitFlashUntil = Date.now() + 120;
          if (b.hp <= 0) b.alive = false;
        }
      }
    } else if (evt.op === 'boss_sync') {
      const cacheKey = `${evt.stg}:${evt.bid}`;
      bossStateCacheRef.current.set(cacheKey, {
        hp: evt.hp,
        maxHp: evt.maxHp ?? evt.hp,
        alive: evt.alive,
        x: evt.x,
        dir: evt.dir,
      });

      if (currentStageRef.current === evt.stg) {
        const b = stageBossesRef.current.find((x) => x.id === evt.bid);
        if (b) {
          b.hp = evt.hp;
          if (typeof evt.maxHp === 'number') b.maxHp = evt.maxHp;
          b.alive = evt.alive;
          if (typeof evt.x === 'number') b.x = evt.x;
          if (typeof evt.dir === 'number') b.dir = evt.dir === -1 ? -1 : 1;
        }
      }
    } else if (evt.op === 'boss_spit') {
      if (bossProjectilesRef.current.some((bp) => bp.id === evt.pid)) return;
      bossProjectilesRef.current.push({
        id: evt.pid,
        x: evt.x,
        y: evt.y,
        vx: evt.vx,
        vy: evt.vy,
        bossId: evt.bid,
        stage: evt.stg,
        createdAt: Date.now(),
      });
      soundEngine.playShoot();
    } else if (evt.op === 'boss_died') {
      for (const [key, b] of bossStateCacheRef.current.entries()) {
        if (key.startsWith(`${evt.stg}:`)) {
          b.hp = 0;
          b.alive = false;
        }
      }
      if (currentStageRef.current === evt.stg) {
        for (const b of stageBossesRef.current) {
          b.hp = 0;
          b.alive = false;
        }
      }
      if (!bossDiedBannerRef.current.has(evt.stg)) {
        bossDiedBannerRef.current.add(evt.stg);
        soundEngine.playPowerUp();
        const curStg = currentStageRef.current;
        const totStg = totalStagesRef.current;
        const curStageQs = getStageQuestions(levelQuestionsRef.current, curStg, totStg);
        const stageTotal = curStageQs.length;
        let stageAnswered = 0;
        for (const sq of curStageQs) {
          if (answeredIdsRef.current.has(sq.id)) stageAnswered += 1;
        }
        const questionsDone = stageTotal === 0 || stageAnswered >= stageTotal;
        if (questionsDone) {
          showBanner(curStg < totStg ? `🔑 Boss berhasil dikalahkan! Gerbang Stage ${curStg + 1} TERBUKA! Masuk ke Pintu Ujung Kanan ➜` : `🏆 Boss dikalahkan! Gerbang Finish Terbuka!`, 5000);
        } else {
          showBanner(`💥 Boss dikalahkan! Selesaikan sisa soal (${stageTotal - stageAnswered} lagi) untuk membuka gerbang!`, 4500);
        }
      }
    }
  }, []);

  const applyIncomingCommand = useCallback((cmd: RoomCommandEvent) => {
    const isTarget = 'targetId' in cmd && (cmd.targetId === 'all' || cmd.targetId === myIdRef.current);
    if (cmd.op === 'god') {
      if (cmd.targetId === 'all') {
        for (const p of playersRef.current.values()) {
          p.isGodMode = cmd.value;
        }
      } else {
        const targetP = playersRef.current.get(cmd.targetId);
        if (targetP) {
          targetP.isGodMode = cmd.value;
        }
      }
      if (isTarget) {
        isGodModeRef.current = cmd.value;
        setIsGodMode(cmd.value);
        const me = playersRef.current.get(myIdRef.current);
        if (me) me.isGodMode = cmd.value;
        if (cmd.value) {
          soundEngine.playPowerUp();
          showBanner('👑 GOD MODE DIAKTIFKAN! Kamu kebal rintangan map (duri/monster/lahar).');
        } else {
          showBanner('🛡️ God Mode telah dinonaktifkan.');
        }
      }
    } else if (cmd.op === 'teleport') {
      if (isTarget) {
        if (typeof cmd.stage === 'number' && cmd.stage !== currentStageRef.current) {
          applyStage(cmd.stage, { respawnPlayer: true, showToast: true, force: true });
        } else if (typeof cmd.x === 'number' && typeof cmd.y === 'number') {
          const me = playersRef.current.get(myIdRef.current);
          if (me) {
            me.x = cmd.x;
            me.y = cmd.y;
            me.vx = 0;
            me.vy = 0;
          }
          soundEngine.playBounce();
          showBanner('🌀 Kamu diteleportasikan oleh Guru/Admin!');
        }
      }
    } else if (cmd.op === 'reset') {
      if (isTarget) {
        answeredIdsRef.current.clear();
        answerResultsRef.current.clear();
        setAnsweredQuestionIds([]);
        setCorrectCount(0);
        questionRef.current = null;
        setQuestion(null);
        setQuestionMinimized(false);
        setSelected('');
        if (myIdRef.current) {
          setScores((prev) => ({ ...prev, [myIdRef.current]: 0 }));
          try {
            window.localStorage.setItem(`llys_stage_${roomId}_${myIdRef.current}`, '1');
          } catch { }
        }
        applyStage(1, { respawnPlayer: true, showToast: true });
        soundEngine.playDeath();
        showBanner('🔄 Jawaban & Progres kamu telah di-reset ke Stage 1 oleh Guru/Admin.');
      }
      if (isStaff && mirrorTargetRef.current) {
        const curM = mirrorTargetRef.current;
        if (cmd.targetId === 'all' || (curM !== 'all' && curM.userId === cmd.targetId)) {
          answerResultsRef.current.clear();
          const curStg = currentStageRef.current;
          const stageQs = getStageQuestions(levelQuestionsRef.current, curStg, totalStagesRef.current);
          const seedUserId = curM !== 'all' ? curM.userId : (myIdRef.current || 'anon');
          questionBlocksRef.current = generateQuestionBlocks(
            stageQs.map((q) => q.id),
            `${seedUserId}:${roomId}:s${curStg}`,
            curStg,
          );
        }
      }
    } else if (cmd.op === 'shop_prices_update') {
      if (cmd.prices && typeof cmd.prices === 'object') {
        const p = cmd.prices as ShopPrices;
        setShopPrices(p);
        shopPricesRef.current = p;
        addSystemChatMessage('📢 Harga Toko Item & Karakter telah diperbarui oleh Admin.');
      }
    } else if (cmd.op === 'reset_items') {
      if (isTarget) {
        if (cmd.itemType === 'body' || cmd.itemType === 'all') {
          setUnlockedBodies(['cat']);
          setEquippedBody('cat');
          equippedBodyRef.current = 'cat';
          previewBodyRef.current = null;
          setPreviewBody(null);
          const me = playersRef.current.get(myIdRef.current);
          if (me) { me.bodyModel = 'cat'; me.avatar = 'cat-blue'; }
          try { window.localStorage.setItem('llys_avatar', 'cat-blue'); } catch { }
        }
        if (cmd.itemType === 'tag' || cmd.itemType === 'all') {
          const me = playersRef.current.get(myIdRef.current);
          if (me) { me.tag1 = undefined; me.tag = undefined; }
          try { window.localStorage.removeItem('llys_custom_tag1'); } catch { }
        }
        if (cmd.itemType === 'color' || cmd.itemType === 'all') {
          const me = playersRef.current.get(myIdRef.current);
          if (me) me.customColors = undefined;
          try { window.localStorage.removeItem('llys_custom_colors'); } catch { }
        }
        soundEngine.playDeath();
        showBanner(`🔄 Item kamu [${cmd.itemType.toUpperCase()}] telah di-reset oleh Admin!`, 5000);
      }
    } else if (cmd.op === 'assist_answer') {
      if (isTarget) {
        answeredIdsRef.current.add(cmd.qid);
        answerResultsRef.current.set(cmd.qid, 'assisted');
        setAnsweredQuestionIds(Array.from(answeredIdsRef.current));
        setCorrectCount(answeredIdsRef.current.size);
        soundEngine.playAnswerCorrect();
        showBanner('⭐ Soal sudah dibantu jawab');
      }
    } else if (cmd.op === 'gun') {
      const applyGunToP = (p: Player) => {
        if (cmd.value && cmd.weapon && cmd.weapon !== 'none') {
          const spec = WEAPONS[cmd.weapon as keyof typeof WEAPONS];
          if (spec) {
            p.gun = cmd.weapon;
            p.blasterAmmo = Infinity;
            p.hasAdminGun = true;
            p.blasterUntil = undefined;
            if (cmd.weapon === 'ice' || cmd.weapon === 'stunt') {
              p.frozenUntil = undefined;
              p.frozenDeathAt = undefined;
              p.stunnedUntil = undefined;
            }
          }
        } else {
          p.gun = null;
          p.blasterAmmo = 0;
          p.hasAdminGun = false;
          p.blasterUntil = undefined;
        }
      };

      if (cmd.targetId === 'all') {
        for (const p of playersRef.current.values()) {
          applyGunToP(p);
        }
      } else {
        const targetP = playersRef.current.get(cmd.targetId);
        if (targetP) applyGunToP(targetP);
      }
      if (isTarget) {
        if (cmd.value && cmd.weapon && cmd.weapon !== 'none') {
          const spec = WEAPONS[cmd.weapon as keyof typeof WEAPONS];
          if (spec) {
            setAmmoCount(Infinity);
            showBanner(cmd.weapon === 'ice' ? `🧊 ${spec.label} diberikan! (beku musuh jadi es, terdorong, lalu mati)` : cmd.weapon === 'stunt' ? `⚡ ${spec.label} diberikan! (musuh terkejut listrik, diam, lalu mati)` : `🔫 ${spec.label} diberikan! (peluru unlimited)`);
            soundEngine.playPowerUp();
          }
        } else {
          setAmmoCount(0);
          showBanner('🔫 Senjatamu telah dicabut oleh Admin/Guru.');
        }
      }
    } else if (cmd.op === 'jail') {
      const targetP = playersRef.current.get(cmd.targetId);
      if (targetP) {
        targetP.jailedUntil = cmd.value ? Date.now() + JAIL_FREEZE_MS : undefined;
        if (!cmd.value) targetP.vx = 0;
      }
      if (isTarget) {
        const me = playersRef.current.get(myIdRef.current);
        if (me) me.jailedUntil = targetP?.jailedUntil;
        if (cmd.value) soundEngine.playBurn();
      }
    } else if (cmd.op === 'cosmetics') {
      const targetP = playersRef.current.get(cmd.targetId);
      if (targetP) {
        if (cmd.avatar) {
          targetP.avatar = cmd.avatar;
          targetP.bodyModel = cmd.avatar.startsWith('cat') ? 'cat' : cmd.avatar;
        }
        if (cmd.tag !== undefined) targetP.tag = cmd.tag || undefined;
        if (cmd.tag1 !== undefined) {
          targetP.tag1 = cmd.tag1 || undefined;
          if (cmd.tag1) targetP.tag = cmd.tag1;
        }
        if (cmd.tag2 !== undefined) targetP.tag2 = cmd.tag2 || undefined;
        if (cmd.tag3 !== undefined) targetP.tag3 = cmd.tag3 || undefined;
        if (cmd.colors) {
          targetP.colors = { ...(targetP.colors ?? {}) };
          if (cmd.colors.body !== undefined) targetP.colors.body = cmd.colors.body || undefined;
          if (cmd.colors.tag !== undefined) targetP.colors.tag = cmd.colors.tag || undefined;
          if (cmd.colors.tag1 !== undefined) targetP.colors.tag1 = cmd.colors.tag1 || undefined;
          if (cmd.colors.tag2 !== undefined) targetP.colors.tag2 = cmd.colors.tag2 || undefined;
          if (cmd.colors.tag3 !== undefined) targetP.colors.tag3 = cmd.colors.tag3 || undefined;
          if (cmd.colors.nick !== undefined) targetP.colors.nick = cmd.colors.nick || undefined;
        }
      }
      if (isTarget) {
        const me = playersRef.current.get(myIdRef.current);
        if (me) {
          if (cmd.avatar) {
            me.avatar = cmd.avatar;
            const b = cmd.avatar.startsWith('cat') ? 'cat' : cmd.avatar;
            me.bodyModel = b;
            setEquippedBody(b);
            equippedBodyRef.current = b;
          }
          if (cmd.tag !== undefined) me.tag = cmd.tag || undefined;
          if (cmd.tag1 !== undefined) {
            me.tag1 = cmd.tag1 || undefined;
            if (cmd.tag1) me.tag = cmd.tag1;
          }
          if (cmd.tag2 !== undefined) me.tag2 = cmd.tag2 || undefined;
          if (cmd.tag3 !== undefined) me.tag3 = cmd.tag3 || undefined;
          if (cmd.colors) {
            me.colors = { ...(me.colors ?? {}) };
            if (cmd.colors.body !== undefined) me.colors.body = cmd.colors.body || undefined;
            if (cmd.colors.tag !== undefined) me.colors.tag = cmd.colors.tag || undefined;
            if (cmd.colors.tag1 !== undefined) me.colors.tag1 = cmd.colors.tag1 || undefined;
            if (cmd.colors.tag2 !== undefined) me.colors.tag2 = cmd.colors.tag2 || undefined;
            if (cmd.colors.tag3 !== undefined) me.colors.tag3 = cmd.colors.tag3 || undefined;
            if (cmd.colors.nick !== undefined) me.colors.nick = cmd.colors.nick || undefined;
          }
        }
      }
    } else if (cmd.op === 'mirror_question_state') {
      const isTargeted =
        mirrorTargetRef.current === 'all' ||
        (mirrorTargetRef.current && mirrorTargetRef.current.userId === cmd.userId) ||
        (ropedByUserId && ropedByUserId === cmd.userId);

      if (isTargeted && isStaffRole(myRoleRef.current)) {
        if (cmd.qid) {
          const found = levelQuestionsRef.current.find((q) => q.id === cmd.qid);
          if (found && (!questionRef.current || questionRef.current.id !== cmd.qid)) {
            questionRef.current = found;
            setQuestion(found);
            setQuestionMinimized(false);
          }
          if (cmd.selected) {
            mirroredStudentSelectionRef.current.set(cmd.qid, cmd.selected);
            setMirroredStudentSelections(new Map(mirroredStudentSelectionRef.current));
          }
          if (cmd.isSubmitted) {
            studentChosenAnswersRef.current.set(cmd.qid, cmd.selected || '');
            setStudentChosenAnswers(new Map(studentChosenAnswersRef.current));
            answerResultsRef.current.set(cmd.qid, Boolean(cmd.isCorrect));
          }
        }
      }
    } else if (cmd.op === 'pvp_mode') {
      isStudentPvpEnabledRef.current = Boolean(cmd.value);
      setIsStudentPvpEnabled(Boolean(cmd.value));
    } else if (cmd.op === 'cmd_access') {
      // Admin / Guru broadcast siapa aja yang di-enable / di-disable cmd access-nya
      if (cmd.targetId === 'all') {
        if (cmd.value) {
          cmdEnabledUsersRef.current.add('__ALL_STUDENTS__');
          if (myRoleRef.current === 'student' && myIdRef.current) {
            cmdEnabledUsersRef.current.add(myIdRef.current);
          }
          for (const p of playersRef.current.values()) {
            if (p.role === 'student' || (!p.role && p.id !== myIdRef.current)) {
              cmdEnabledUsersRef.current.add(p.id);
            }
          }
        } else {
          cmdEnabledUsersRef.current.clear();
        }
      } else {
        if (cmd.value) {
          cmdEnabledUsersRef.current.add(cmd.targetId);
        } else {
          cmdEnabledUsersRef.current.delete(cmd.targetId);
          cmdEnabledUsersRef.current.delete('__ALL_STUDENTS__');
        }
      }
    } else if (cmd.op === 'rope') {
      // Selalu update map lokal (walau target belum ada di map, siapkan entry-nya),
      // supaya /untake rope all benar-benar melepas tali di SEMUA client (bukan hanya admin).
      const targetP = playersRef.current.get(cmd.targetId);
      if (targetP) {
        targetP.ropedById = cmd.value ? (cmd.byId ?? 'admin') : null;
        if (!cmd.value) {
          targetP.adminAnchor = undefined;
          targetP.adminFacing = undefined;
        }
      } else if (!cmd.value) {
        // Target tidak ada di map (misalnya baru rejoin): tetap tandai via presence players
        for (const p of playersRef.current.values()) {
          if (p.id === cmd.targetId) {
            p.ropedById = null;
            p.adminAnchor = undefined;
            p.adminFacing = undefined;
          }
        }
      }
      if (cmd.targetId === myIdRef.current) {
        const me = playersRef.current.get(myIdRef.current);
        if (me) {
          me.ropedById = cmd.value ? (cmd.byId ?? 'admin') : null;
          if (!cmd.value) {
            me.adminAnchor = undefined;
            me.adminFacing = undefined;
            meAdminAnchorRef.current = null;
          }
        }
        if (cmd.value) {
          showBanner(`🪢 Kamu diikat oleh ${cmd.byName || 'Admin'}! Ikuti kemana pun admin pergi.`);
          soundEngine.playPowerUp();
        } else {
          showBanner('🪢 Tali kamu dilepas oleh Admin.');
        }
      }
    } else if (cmd.op === 'rope_all_clear') {
      // Admin menjalankan /untake rope all: pastikan SEMUA tali di semua player lepas
      for (const p of playersRef.current.values()) {
        p.ropedById = null;
        p.adminAnchor = undefined;
        p.adminFacing = undefined;
      }
      meAdminAnchorRef.current = null;
      const me = playersRef.current.get(myIdRef.current);
      if (me) me.ropedById = null;
      showBanner('🪢 Semua tali dilepas oleh Admin.');
    } else if (cmd.op === 'change_nick') {
      // Admin ganti nickname (persist di DB, seperti tag): berlaku lintas rejoin & room lain
      const newName = (cmd.value || '').trim().slice(0, 20);
      const targetP = playersRef.current.get(cmd.targetId);
      if (targetP) {
        if (!targetP.originalFullName) targetP.originalFullName = targetP.fullName || targetP.username;
        targetP.username = newName || targetP.username;
        targetP.fullName = newName || targetP.fullName;
      }
      if (isTarget) {
        const me = playersRef.current.get(myIdRef.current);
        if (me && newName) {
          if (!me.originalFullName) me.originalFullName = me.fullName || myFullNameRef.current || me.username;
          me.username = newName;
          me.fullName = newName;
        }
        if (newName) {
          myUsernameRef.current = newName;
          try { window.localStorage.setItem('llys_custom_nick', newName); } catch { }
          showBanner(`🏷️ Nickname kamu diganti Admin jadi "${newName}".`);
          soundEngine.playPowerUp();
        }
      }
    } else if (cmd.op === 'skip_stage') {
      if (cmd.targetId === myIdRef.current) {
        for (const qid of cmd.qids) {
          answeredIdsRef.current.add(qid);
          answerResultsRef.current.set(qid, 'assisted');
        }
        setAnsweredQuestionIds(Array.from(answeredIdsRef.current));
        setCorrectCount(answeredIdsRef.current.size);
        soundEngine.playAnswerCorrect();
        showBanner('⏭️ Soal tersisa di stage ini ditandai selesai oleh Admin! Silakan lanjut ke stage berikutnya.', 5000);
      }
    } else if (cmd.op === 'hit') {
      const shooterRole =
        cmd.shooterRole ??
        playersRef.current.get(cmd.by)?.role ??
        (cmd.by === myIdRef.current ? myRoleRef.current : undefined);
      const shooterName =
        playersRef.current.get(cmd.by)?.username ??
        (shooterRole === 'admin' ? 'Admin' : shooterRole === 'teacher' ? 'Guru' : 'Player');

      if (cmd.targetId === myIdRef.current) {
        const me = playersRef.current.get(myIdRef.current);
        if (me && !me.isDying && !me.ropedById) {
          if (canShooterHitTarget(shooterRole, me.role, isStudentPvpEnabledRef.current)) {
            if (cmd.weapon === 'ice') {
              me.isDying = false;
              me.frozenUntil = Date.now() + 1200;
              me.frozenDeathAt = Date.now() + 1200;
              me.frozenByShooterId = cmd.by;
              me.frozenByWeapon = 'ice';
              me.vx = me.x < (projectilesRef.current.find((r) => r.shooterId === cmd.by)?.x ?? me.x) ? -4 : 4;
              me.vy = -3.5;
            } else if (cmd.weapon === 'stunt') {
              me.isDying = false;
              me.frozenUntil = Date.now() + 1200;
              me.frozenDeathAt = Date.now() + 1200;
              me.stunnedUntil = Date.now() + 1200;
              me.frozenByShooterId = cmd.by;
              me.frozenByWeapon = 'stunt';
              me.vx = 0;
              me.vy = 0;
            } else {
              me.isDying = true;
              me.deathStartedAt = Date.now();
              me.vx = 0;
              me.vy = -13.2;
              soundEngine.playDeath();
            }
          }
        }
      } else {
        // Remote player: update efek visual di player lain juga
        const target = playersRef.current.get(cmd.targetId);
        if (target && !target.isDying && !target.ropedById) {
          if (canShooterHitTarget(shooterRole, target.role, isStudentPvpEnabledRef.current)) {
            if (cmd.weapon === 'ice') {
              target.isDying = false;
              target.frozenUntil = Date.now() + 1200;
              target.frozenDeathAt = Date.now() + 1200;
              target.frozenByShooterId = cmd.by;
              target.frozenByWeapon = 'ice';
              target.vx = target.x < (projectilesRef.current.find((r) => r.shooterId === cmd.by)?.x ?? target.x) ? -4 : 4;
              target.vy = -3.5;
            } else if (cmd.weapon === 'stunt') {
              target.isDying = false;
              target.frozenUntil = Date.now() + 1200;
              target.frozenDeathAt = Date.now() + 1200;
              target.stunnedUntil = Date.now() + 1200;
              target.frozenByShooterId = cmd.by;
              target.frozenByWeapon = 'stunt';
              target.vx = 0;
              target.vy = 0;
            } else {
              target.isDying = true;
              target.deathStartedAt = Date.now();
              target.vx = 0;
              target.vy = -13.2;
            }
          }
        }
      }
    }
  }, [applyStage]);

  const ably = useAblyRoom(roomId, ablyEnabled, {
    onDirectMove: (rp) => {
      ingestRemotePlayerSnapshot({ ...rp, gun: rp.gun ?? undefined, tag: rp.tag ?? undefined, colors: rp.colors ?? undefined });
    },
    onDirectLeave: (uid, kicked) => {
      if (uid === myIdRef.current || uid === 'me') {
        if (kicked && !manualLeaveRef.current && !isStaffRole(myRoleRef.current)) {
          justKickedInSessionRef.current = true;
          triggerForcedExit('kicked');
        }
        return;
      }
      playersRef.current.delete(uid);
      setRoom((prev) => (prev ? { ...prev, players: prev.players.filter((pl) => pl.userId !== uid) } : prev));
    },
    onObstacleEvent: applyObstacleEvent,
    onCommandEvent: applyIncomingCommand,
  });
  ablyRef.current = ably;

  const fireLaser = useCallback(() => {
    if (isCameraFreePanningRef.current || spectateTargetIdRef.current) {
      returnCameraToSelf();
    }
    const me = playersRef.current.get(myIdRef.current);
    if (!me || exitNoticeRef.current || roomRef.current?.status === 'paused') return;
    const now = Date.now();
    const ammo = me.blasterAmmo ?? 0;
    const until = me.blasterUntil ?? 0;
    if (!me.hasAdminGun && until > 0 && until <= now) {
      me.gun = null;
      me.blasterAmmo = 0;
      setAmmoCount(0);
      return;
    }
    if (ammo <= 0) {
      return;
    }
    const gunSpec = me.gun ? WEAPONS[me.gun as keyof typeof WEAPONS] : undefined;
    const cooldown = gunSpec?.cooldownMs ?? 160;
    if (now - lastShotAtRef.current < cooldown) {
      return;
    }
    lastShotAtRef.current = now;
    if (!me.hasAdminGun && me.blasterAmmo !== Infinity) {
      me.blasterAmmo = Math.max(0, ammo - 1);
      if (me.blasterAmmo <= 0) {
        me.gun = null;
      }
      setAmmoCount(me.blasterAmmo);
    } else {
      me.blasterAmmo = Infinity;
      setAmmoCount(Infinity);
    }
    soundEngine.playShoot();

    const facing = me.facing ?? 1;
    const projId = `proj_${myIdRef.current}_${now}`;
    const pX = facing === 1 ? me.x + 36 : me.x;
    const pY = me.y + 20;
    const pVx = facing * (gunSpec?.speed ?? 14);
    const curStg = currentStageRef.current;

    const proj: Projectile = {
      id: projId,
      x: pX,
      y: pY,
      vx: pVx,
      shooterId: myIdRef.current,
      stage: curStg,
      createdAt: now,
      kind: gunSpec ? 'admin-round' : 'blaster',
      damage: gunSpec?.damage,
      color: gunSpec?.color,
      glow: gunSpec?.glow,
      length: gunSpec?.length,
      thickness: gunSpec?.thickness,
      weapon: me.gun as Projectile['weapon'],
      shooterRole: myRoleRef.current,
    };
    projectilesRef.current.push(proj);

    const shootEvt = {
      op: 'shoot' as const,
      stg: curStg,
      pid: projId,
      x: pX,
      y: pY,
      vx: pVx,
      len: gunSpec?.length,
      thk: gunSpec?.thickness,
      color: gunSpec?.color,
      glow: gunSpec?.glow,
      gun: me.gun ?? undefined,
      dmg: gunSpec?.damage,
      weapon: me.gun as Projectile['weapon'],
      shooterRole: myRoleRef.current,
      shooterId: myIdRef.current,
    };
    ably.publishObstacle(shootEvt);
    pendingObstacleUploadRef.current = shootEvt;
  }, [ably]);

  function notifyLeaveRoom() {
    if (hasLeftRef.current || exitNoticeRef.current || !roomId) return;
    hasLeftRef.current = true;
    const payload = JSON.stringify({ roomId });
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payload], { type: 'application/json' });
        if (navigator.sendBeacon('/api/game/leave', blob)) return;
      }
    } catch {
      // fallback to keepalive fetch
    }
    fetch('/api/game/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => { });
  }

  function handleSessionReplaced() {
    manualLeaveRef.current = true;
    hasLeftRef.current = true;
    clearCachedData();
    window.location.replace('/login?reason=session_replaced');
  }

  function handleLeaveGame() {
    manualLeaveRef.current = true;
    notifyLeaveRoom();
    router.push(isStaff ? '/dashboard/teacher/rooms' : '/dashboard/student');
  }

  const startPreview = useCallback((bodyId: string) => {
    setPreviewBody(bodyId);
    previewBodyRef.current = bodyId;
    const me = playersRef.current.get(myIdRef.current);
    if (me) {
      me.bodyModel = bodyId;
    }
    setShowShopModal(false);
    soundEngine.playPowerUp();
    showBanner(`👁️ Mode Preview Aktif: Karakter diubah jadi [${bodyId.toUpperCase()}]. Preview hanya terlihat olehmu dan batal otomatis jika gugur!`, 5000);
    showBanner(`👁️ Mode Coba Aktif: Karakter [${bodyId.toUpperCase()}]. Hanya terlihat olehmu dan batal otomatis jika gugur!`, 4500);
  }, [showBanner]);

  const startTagPreview = useCallback((tag: string) => {
      const cleanTag = tag.trim().slice(0, 24);
      if (!cleanTag) return;
      setPreviewTag1(cleanTag);
      previewTag1Ref.current = cleanTag;
      setShowShopModal(false);
      soundEngine.playPowerUp();
      showBanner(`👁️ Mode Coba Aktif: Gelar "${cleanTag}". Hanya terlihat olehmu dan batal otomatis jika gugur!`, 4500);
    }, [showBanner]);

    const startColorPreview = useCallback((part: 'body' | 'tag1' | 'nick', mode: 'static' | 'rgb', colorVal: string) => {
      const nextColors = { ...(previewColorsRef.current ?? {}) };
      nextColors[part] = mode === 'rgb' ? 'rgb' : colorVal;
      setPreviewColors(nextColors);
      previewColorsRef.current = nextColors;
      setShowShopModal(false);
      soundEngine.playPowerUp();
      showBanner(`👁️ Mode Coba Aktif: Warna [${part.toUpperCase()} ${mode.toUpperCase()}]. Hanya terlihat olehmu!`, 4500);
    }, [showBanner]);

    const cancelAllPreviews = useCallback(() => {
      const hadPreview = previewBodyRef.current || previewTag1Ref.current || previewColorsRef.current;
      if (!hadPreview) return;
      const restore = equippedBodyRef.current || 'cat';
      setPreviewBody(null);
      previewBodyRef.current = null;
      setPreviewTag1(null);
      previewTag1Ref.current = null;
      setPreviewColors(null);
      previewColorsRef.current = null;
      const me = playersRef.current.get(myIdRef.current);
      if (me) {
        me.bodyModel = restore;
        me.avatar = restore === 'cat' ? 'cat-blue' : restore;
      }
      soundEngine.playBounce();
      showBanner(`Preview dibatalkan. Kembali ke karakter [${restore.toUpperCase()}].`, 3000);
      showBanner('Mode coba dibatalkan. Kembali ke pengaturan awal.', 2500);
    }, [showBanner]);

    const cancelPreview = cancelAllPreviews;

    const buyBody = useCallback(async (bodyId: string) => {
      if (shopSubmitting) return;
      setShopSubmitting(true);
      try {
        const res = await fetch('/api/game/shop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'buy_body', body: bodyId, roomId }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showBanner(`❌ ${data.error || 'Gagal membeli karakter.'}`, 4000);
          soundEngine.playDeath();
          return;
        }
        setUserPoints(data.totalPoints);
        setUnlockedBodies(data.unlockedBodies);
        const newBody = data.equippedBody || bodyId;
        setEquippedBody(newBody);
        equippedBodyRef.current = newBody;
        setPreviewBody(null);
        previewBodyRef.current = null;
        const canonicalAvatar = newBody === 'cat' ? 'cat-blue' : newBody;
        const me = playersRef.current.get(myIdRef.current);
        if (me) {
          me.bodyModel = newBody;
          me.avatar = canonicalAvatar;
        }
        try {
          window.localStorage.setItem('llys_avatar', canonicalAvatar);
          window.localStorage.setItem('llys_body', newBody);
        } catch { }
        ably.publishCommand({ op: 'cosmetics', targetId: myIdRef.current, avatar: canonicalAvatar });
        soundEngine.playPowerUp();
        showBanner(`Berhasil membeli karakter [${bodyId.toUpperCase()}]! Tersimpan permanen.`, 5000);
      } catch {
        showBanner('❌ Gagal menghubungi server toko.', 4000);
      } finally {
        setShopSubmitting(false);
      }
    }, [shopSubmitting, roomId, showBanner, ably]);

    const equipBody = useCallback(async (bodyId: string) => {
      if (shopSubmitting) return;
      setShopSubmitting(true);
      try {
        const res = await fetch('/api/game/shop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'equip_body', body: bodyId, roomId }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showBanner(`❌ ${data.error || 'Gagal equip karakter.'}`, 4000);
          return;
        }
        const newBody = data.equippedBody || bodyId;
        setEquippedBody(newBody);
        equippedBodyRef.current = newBody;
        setPreviewBody(null);
        previewBodyRef.current = null;
        const canonicalAvatar = newBody === 'cat' ? 'cat-blue' : newBody;
        const me = playersRef.current.get(myIdRef.current);
        if (me) {
          me.bodyModel = newBody;
          me.avatar = canonicalAvatar;
        }
        try {
          window.localStorage.setItem('llys_avatar', canonicalAvatar);
          window.localStorage.setItem('llys_body', newBody);
        } catch { }
        ably.publishCommand({ op: 'cosmetics', targetId: myIdRef.current, avatar: canonicalAvatar });
        soundEngine.playPowerUp();
        showBanner(`Karakter [${bodyId.toUpperCase()}] berhasil dipasang permanen!`, 3500);
      } catch {
        showBanner('❌ Gagal menghubungi server.', 4000);
      } finally {
        setShopSubmitting(false);
      }
    }, [shopSubmitting, roomId, showBanner, ably]);

    const buyTag1 = useCallback(async (newTag: string) => {
      if (shopSubmitting) return;
      setShopSubmitting(true);
      try {
        const res = await fetch('/api/game/shop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'buy_tag1', title: newTag, tag: newTag, roomId }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showBanner(`❌ ${data.error || 'Gagal mengganti tag.'}`, 4000);
          soundEngine.playDeath();
          return;
        }
        setUserPoints(data.totalPoints);
        const me = playersRef.current.get(myIdRef.current);
        if (me) {
          me.tag1 = data.tag1;
          me.tag = data.tag1;
        }
        ably.publishCommand({ op: 'cosmetics', targetId: myIdRef.current, tag1: data.tag1 });
        soundEngine.playPowerUp();
        setShopTagInput('');
        showBanner(`🏷️ Gelar Tag 1 berhasil diubah jadi "${data.tag1}"!`, 4000);
      } catch {
        showBanner('❌ Gagal menghubungi server.', 4000);
      } finally {
        setShopSubmitting(false);
      }
    }, [shopSubmitting, roomId, showBanner, ably]);

    const buyColor = useCallback(async (part: 'body' | 'tag1' | 'nick', mode: 'static' | 'rgb', colorVal: string) => {
      if (shopSubmitting) return;
      setShopSubmitting(true);
      try {
        const res = await fetch('/api/game/shop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'buy_color', part, mode, colorVal, roomId }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showBanner(`❌ ${data.error || 'Gagal mengubah warna.'}`, 4000);
          soundEngine.playDeath();
          return;
        }
        setUserPoints(data.totalPoints);
        const me = playersRef.current.get(myIdRef.current);
        if (me) {
          me.colors = data.customColors;
          me.customColors = data.customColors;
        }
        ably.publishCommand({ op: 'cosmetics', targetId: myIdRef.current, colors: data.customColors });
        soundEngine.playPowerUp();
        showBanner(`🎨 Warna [${part.toUpperCase()} ${mode.toUpperCase()}] berhasil dipasang!`, 4000);
      } catch {
        showBanner('❌ Gagal menghubungi server.', 4000);
      } finally {
        setShopSubmitting(false);
      }
    }, [shopSubmitting, roomId, showBanner, ably]);

    useEffect(() => {
      hasLeftRef.current = false;
      manualLeaveRef.current = false;
      const onUnload = () => notifyLeaveRoom();
      window.addEventListener('pagehide', onUnload);
      window.addEventListener('beforeunload', onUnload);
      return () => {
        window.removeEventListener('pagehide', onUnload);
        window.removeEventListener('beforeunload', onUnload);
      };
    }, [roomId]);

    useEffect(() => {
      chatMinimizedRef.current = chatMinimized;
      if (!chatMinimized) {
        setUnreadCount(0);
      }
    }, [chatMinimized]);

    useEffect(() => {
      setBgmEnabled(soundEngine.bgmEnabled);
      setBgmVolume(soundEngine.bgmVolume);
      setSfxEnabled(soundEngine.sfxEnabled);
      setSfxVolume(soundEngine.sfxVolume);

      try {
        const raw = window.localStorage.getItem(HUD_CONTROLS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<HudControlsConfig>;
          setHudControls((prev) => ({
            size: typeof parsed.size === 'number' ? Math.max(64, Math.min(128, parsed.size)) : prev.size,
            gap: typeof parsed.gap === 'number' ? Math.max(8, Math.min(44, parsed.gap)) : prev.gap,
            opacity: typeof parsed.opacity === 'number' ? Math.max(0.35, Math.min(1, parsed.opacity)) : prev.opacity,
            swapSides: typeof parsed.swapSides === 'boolean' ? parsed.swapSides : prev.swapSides,
            dpadX: typeof parsed.dpadX === 'number' ? parsed.dpadX : prev.dpadX,
            dpadY: typeof parsed.dpadY === 'number' ? parsed.dpadY : prev.dpadY,
            jumpX: typeof parsed.jumpX === 'number' ? parsed.jumpX : prev.jumpX,
            jumpY: typeof parsed.jumpY === 'number' ? parsed.jumpY : prev.jumpY,
          }));
        }
      } catch {
        // ignore storage read error
      }

      const unlockAudio = () => {
        soundEngine.unlockAndStartBgm();
      };
      window.addEventListener('pointerdown', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
      return () => {
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        soundEngine.stopBgm();
      };
    }, []);

    function updateHudControls(patch: Partial<HudControlsConfig>) {
      setHudControls((prev) => {
        const next = { ...prev, ...patch };
        try {
          window.localStorage.setItem(HUD_CONTROLS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore storage error
        }
        return next;
      });
    }

    function resetHudControls() {
      soundEngine.playClick();
      setHudControls(DEFAULT_HUD_CONTROLS);
      try {
        window.localStorage.setItem(HUD_CONTROLS_STORAGE_KEY, JSON.stringify(DEFAULT_HUD_CONTROLS));
      } catch {
        // ignore
      }
    }

    function ingestMessages(incoming: ChatMsg[]) {
      if (!incoming || incoming.length === 0) return;
      const newMsgs: ChatMsg[] = [];
      let unreadAdded = 0;

      for (const m of incoming) {
        if (!m || !m.id || seenMsgIdsRef.current.has(m.id)) continue;
        seenMsgIdsRef.current.add(m.id);
        newMsgs.push(m);

        const player =
          (m.userId ? playersRef.current.get(m.userId) : undefined) ??
          Array.from(playersRef.current.values()).find((pl) => pl.username === m.senderName);
        if (player) {
          bubblesRef.current.set(player.id, { text: m.text, at: Date.now() });
        }

        const isMe =
          (Boolean(m.userId) && m.userId === myIdRef.current) ||
          (Boolean(myUsernameRef.current) && m.senderName === myUsernameRef.current);
        if (chatMinimizedRef.current && !isMe) {
          unreadAdded += 1;
        }
      }

      if (newMsgs.length > 0) {
        setChat((prev) => [...prev.slice(-49), ...newMsgs]);
      }
      if (unreadAdded > 0) {
        setUnreadCount((prev) => prev + unreadAdded);
      }
    }

    useEffect(() => {
      let cancelled = false;
      chatCursorRef.current = -1;
      seenMsgIdsRef.current.clear();
      setChat([]);
      setUnreadCount(0);

      async function init() {
        const res = await fetch('/api/rooms/' + roomId + '?bootstrap=1');
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        if (!res.ok) {
          if (res.status === 404) {
            triggerForcedExit('deleted');
            return;
          }
          setError('Ruang tidak ditemukan');
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        const p = data.profile;
        const r: RoomData = data.room;
        myIdRef.current = p.id;
        myUsernameRef.current = p.username;
        if (data.shopPrices) {
          setShopPrices(data.shopPrices);
          shopPricesRef.current = data.shopPrices;
        }
        if (Array.isArray(p.unlockedBodies)) {
          setUnlockedBodies(p.unlockedBodies);
        }
        const effectiveEquipped = (p.equippedBody && p.equippedBody.trim()) ? p.equippedBody.trim() : 'cat';
        setEquippedBody(effectiveEquipped);
        equippedBodyRef.current = effectiveEquipped;
        if (typeof p.totalPoints === 'number') {
          setUserPoints(p.totalPoints);
        }
        myRoleRef.current = p.role;
        setMyRole(p.role);

        if (Array.isArray(data.rejoinRequests)) {
          setRejoinRequests(data.rejoinRequests);
        }

        if (typeof data.sessionId === 'string' && data.sessionId) {
          sessionIdRef.current = data.sessionId;
        }
        if (typeof data.chatCursor === 'number' && data.chatCursor > chatCursorRef.current) {
          chatCursorRef.current = data.chatCursor;
        }
        if (!data.kicked) {
          if (data.answerResults && typeof data.answerResults === 'object') {
            for (const [qid, okAns] of Object.entries(data.answerResults as Record<string, boolean | 'assisted'>)) {
              answerResultsRef.current.set(qid, okAns === 'assisted' ? 'assisted' : Boolean(okAns));
            }
          }
          if (Array.isArray(data.answeredQuestionIds)) {
            for (const qid of data.answeredQuestionIds) answeredIdsRef.current.add(qid);
            const list = Array.from(answeredIdsRef.current);
            setAnsweredQuestionIds(list);
            setCorrectCount(list.length);
          }
        }

        if (r.status === 'completed' || (!isStaffRole(p.role) && r.status !== 'in_progress' && r.status !== 'paused')) {
          router.replace(isStaffRole(p.role) ? '/dashboard/teacher/rooms' : '/dashboard/student');
          return;
        }

        if (isStaffRole(p.role)) {
          mirrorTargetRef.current = null;
          setMirrorTarget(null);
        }
        setRoom(r);
        roomRef.current = r;
        const myEntry = (r.players ?? []).find((pl: RoomPlayer) => pl.userId === p.id);
        myFullNameRef.current = p.fullName || myEntry?.fullName || '';

        for (const pl of r.players ?? []) {
          const isMe = pl.userId === p.id;
          if (!playersRef.current.has(pl.userId)) {
            const spawn = SPAWN_POINTS[playersRef.current.size % SPAWN_POINTS.length];
            const px = pl.lastX ?? spawn.x;
            const py = pl.lastY ?? spawn.y;
            let parsedColors: PlayerColors | undefined;
            if (pl.customColors) {
              try {
                parsedColors = typeof pl.customColors === 'string' ? JSON.parse(pl.customColors) : (pl.customColors as any);
              } catch { }
            }
            playersRef.current.set(pl.userId, {
              id: pl.userId,
              username: pl.username,
              fullName: pl.fullName || undefined,
              customNick: pl.customNick || undefined,
              tag: pl.tag1 || undefined,
              tag1: pl.tag1 || undefined,
              tag2: pl.tag2 || undefined,
              tag3: pl.tag3 || undefined,
              colors: parsedColors,
              avatar: isMe ? (effectiveEquipped === 'cat' ? (pl.avatar && pl.avatar.startsWith('cat') ? pl.avatar : 'cat-blue') : effectiveEquipped) : pl.avatar,
              bodyModel: isMe ? effectiveEquipped : (pl.avatar && pl.avatar !== 'cat' && !pl.avatar.startsWith('cat') ? pl.avatar : 'cat'),
              role: isMe ? p.role : pl.role,
              stage: pl.stage ?? 1,
              x: px,
              y: py,
              spawnX: spawn.x,
              spawnY: spawn.y,
              targetX: px,
              targetY: py,
              vx: 0,
              vy: 0,
              facing: (pl.lastFacing as 1 | -1) ?? 1,
              onGround: false,
            });
          }
        }
        if (!playersRef.current.has(p.id)) {
          const spawn = SPAWN_POINTS[playersRef.current.size % SPAWN_POINTS.length];
          playersRef.current.set(p.id, {
            id: p.id,
            username: p.username,
            fullName: p.fullName || myEntry?.fullName || undefined,
            avatar: effectiveEquipped === 'cat' ? (p.avatar && p.avatar.startsWith('cat') ? p.avatar : 'cat-blue') : effectiveEquipped,
            bodyModel: effectiveEquipped,
            role: p.role,
            stage: myEntry?.stage ?? 1,
            x: myEntry?.lastX ?? spawn.x,
            y: myEntry?.lastY ?? spawn.y,
            spawnX: spawn.x,
            spawnY: spawn.y,
            vx: 0,
            vy: 0,
            facing: (myEntry?.lastFacing as 1 | -1) ?? 1,
            onGround: false,
          });
        }

        // Muat nick, tag & warna kustom yang tersimpan dari DB (dan fallback storage)
        try {
          const meP = playersRef.current.get(p.id);
          if (meP) {
            const canonicalAvatar = effectiveEquipped === 'cat' ? 'cat-blue' : effectiveEquipped;
            meP.bodyModel = effectiveEquipped;
            meP.avatar = canonicalAvatar;
            if (p.customNick) meP.customNick = p.customNick;
            if (p.tag1) meP.tag1 = p.tag1;
            if (p.tag2) meP.tag2 = p.tag2;
            if (p.tag3) meP.tag3 = p.tag3;
            if (p.tag1 || p.tag2 || p.tag3) meP.tag = p.tag1 || p.tag2 || p.tag3;
            if (p.customColors) {
              try {
                const parsed = typeof p.customColors === 'string' ? JSON.parse(p.customColors) : (p.customColors as any);
                meP.colors = {
                  body: parsed.body || undefined,
                  tag: parsed.tag || undefined,
                  nick: parsed.nick || undefined,
                };
              } catch { }
            }
          }
        } catch { }

        const rawQs: Question[] = data.questions ?? [];
        const shuffleSeed = `${p.id}:${roomId}:${Date.now()}`;
        const qs: Question[] = rawQs.map((q) => shuffleQuestionOptions(q, shuffleSeed));
        setLevelQuestions(qs);
        levelQuestionsRef.current = qs;

        const selStages = resolveSelectedStages(r);
        selectedStagesRef.current = selStages;
        setSelectedStages(selStages);
        const tStg = selStages.length;
        totalStagesRef.current = tStg;
        setTotalStages(tStg);

        let initialStage = 1;
        try {
          const savedStage = Number(window.localStorage.getItem(`llys_stage_${roomId}_${p.id}`));
          if (Number.isFinite(savedStage) && savedStage >= 1 && savedStage <= tStg) {
            initialStage = savedStage;
          }
        } catch {
          // ignore storage read error
        }

        // Validasi checkpoint: siswa tidak boleh berada di stage N jika soal stage sebelumnya belum selesai
        if (!isStaffRole(p.role) && initialStage > 1 && qs.length > 0) {
          for (let s = 1; s < initialStage; s++) {
            const sQs = getStageQuestions(qs, s, tStg);
            const sCleared = sQs.length === 0 || sQs.every((q) => answeredIdsRef.current.has(q.id));
            if (!sCleared) {
              initialStage = s;
              try {
                window.localStorage.setItem(`llys_stage_${roomId}_${p.id}`, String(initialStage));
              } catch { }
              break;
            }
          }
        }

        applyStage(initialStage, {
          respawnPlayer: false,
          showToast: false,
          seedId: p.id,
          allQuestions: qs,
          totalStg: tStg,
          force: true,
          persistCheckpoint: false,
        });

        const meInit = playersRef.current.get(p.id);
        if (meInit && !data.kicked) {
          meInit.stage = initialStage;
          ably.publishPosition({
            id: meInit.id,
            username: meInit.username,
            avatar: meInit.avatar,
            role: p.role,
            stage: initialStage,
            x: meInit.x,
            y: meInit.y,
            vx: 0,
            vy: 0,
            facing: meInit.facing,
            onGround: meInit.onGround,
            tag: meInit.tag,
            tag1: meInit.tag1,
            tag2: meInit.tag2,
            tag3: meInit.tag3,
            customNick: meInit.customNick,
            colors: meInit.colors,
            ropedById: meInit.ropedById ?? undefined,
          });
        }

        if (data.kicked && !isStaffRole(p.role)) {
          triggerForcedExit('kicked');
        }
      }

      init();
      return () => {
        cancelled = true;
      };
    }, [roomId, router]);

    const [isFullscreen, setIsFullscreen] = useState(false);
    const mainRef = useRef<HTMLElement>(null);
    const manualExitFsRef = useRef(false);

    function getFullscreenElement(): Element | null {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
    }

    async function requestElementFullscreen(el: HTMLElement | null): Promise<boolean> {
      if (!el) return false;
      const anyEl = el as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      };
      try {
        if (typeof el.requestFullscreen === 'function') {
          await el.requestFullscreen({ navigationUI: 'hide' });
          return true;
        }
        if (typeof anyEl.webkitRequestFullscreen === 'function') {
          await anyEl.webkitRequestFullscreen();
          return true;
        }
      } catch {
        // ignore and allow fallback
      }
      return false;
    }

    async function enterFullscreen() {
      if (getFullscreenElement()) return;
      const okMain = await requestElementFullscreen(mainRef.current);
      if (!okMain) {
        await requestElementFullscreen(document.documentElement);
      }
      try {
        const scr = screen as Screen & { orientation?: { lock?: (o: string) => Promise<void> } };
        await scr.orientation?.lock?.('landscape');
      } catch {
        // orientation lock optional
      }
    }

    useEffect(() => {
      function onFsChange() {
        const active = Boolean(getFullscreenElement());
        setIsFullscreen(active);
        window.dispatchEvent(new Event('resize'));
      }
      document.addEventListener('fullscreenchange', onFsChange);
      document.addEventListener('webkitfullscreenchange', onFsChange);
      return () => {
        document.removeEventListener('fullscreenchange', onFsChange);
        document.removeEventListener('webkitfullscreenchange', onFsChange);
      };
    }, []);

    useEffect(() => {
      const el = mainRef.current;
      if (!el) return;
      function onFirstTouch() {
        if (manualExitFsRef.current) return;
        if (window.matchMedia('(pointer: coarse)').matches && !getFullscreenElement()) {
          void enterFullscreen();
        }
      }
      el.addEventListener('pointerdown', onFirstTouch, { passive: true });
      return () => el.removeEventListener('pointerdown', onFirstTouch);
    }, []);

    async function toggleFullscreen() {
      try {
        if (getFullscreenElement()) {
          manualExitFsRef.current = true;
          const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void };
          if (typeof document.exitFullscreen === 'function') {
            await document.exitFullscreen();
          } else if (typeof doc.webkitExitFullscreen === 'function') {
            await doc.webkitExitFullscreen();
          }
        } else {
          manualExitFsRef.current = false;
          await enterFullscreen();
        }
      } catch {
        // iOS Safari tidak mendukung requestFullscreen pada elemen; abaikan
      }
    }

    useEffect(() => {
      function blockContext(e: Event) {
        e.preventDefault();
      }
      const el = mainRef.current;
      el?.addEventListener('contextmenu', blockContext);
      return () => el?.removeEventListener('contextmenu', blockContext);
    }, []);

    useEffect(() => {
      const html = document.documentElement;
      const body = document.body;
      const prevHtmlOverflow = html.style.overflow;
      const prevBodyOverflow = body.style.overflow;
      const prevBodyPos = body.style.position;
      const prevBodyInset = body.style.inset;
      const prevBodyWidth = body.style.width;
      const prevBodyHeight = body.style.height;
      const prevBodyBg = body.style.backgroundColor;

      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.inset = '0';
      body.style.width = '100%';
      body.style.height = '100%';
      body.style.backgroundColor = '#1e2d42';

      let lockedH = window.innerHeight;

      function isInputFocused() {
        const a = document.activeElement as HTMLElement | null;
        return Boolean(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable));
      }

      function syncViewportLock() {
        const el = mainRef.current;
        if (!el) return;

        if (!isInputFocused() || window.innerHeight > lockedH) {
          lockedH = window.innerHeight;
        }

        el.style.height = `${lockedH}px`;
      }

      function onOrientationChange() {
        setTimeout(() => {
          lockedH = window.innerHeight;
          syncViewportLock();
        }, 150);
      }

      syncViewportLock();
      window.addEventListener('resize', syncViewportLock);
      window.addEventListener('scroll', syncViewportLock, { passive: true });
      window.addEventListener('orientationchange', onOrientationChange);
      const vv = window.visualViewport;
      vv?.addEventListener('resize', syncViewportLock);
      vv?.addEventListener('scroll', syncViewportLock);

      return () => {
        window.removeEventListener('resize', syncViewportLock);
        window.removeEventListener('scroll', syncViewportLock);
        window.removeEventListener('orientationchange', onOrientationChange);
        vv?.removeEventListener('resize', syncViewportLock);
        vv?.removeEventListener('scroll', syncViewportLock);

        html.style.overflow = prevHtmlOverflow;
        body.style.overflow = prevBodyOverflow;
        body.style.position = prevBodyPos;
        body.style.inset = prevBodyInset;
        body.style.width = prevBodyWidth;
        body.style.height = prevBodyHeight;
        body.style.backgroundColor = prevBodyBg;
      };
    }, []);

    useEffect(() => {
      for (const rp of ably.presencePlayers) {
        if (rp.id === myIdRef.current) continue;
        const existing = playersRef.current.get(rp.id);
        if (existing) {
          existing.targetX = rp.x;
          existing.targetY = rp.y;
          existing.facing = rp.facing;
          if (rp.username) existing.username = rp.username;
          if ((rp as any).fullName) existing.fullName = (rp as any).fullName;
          if (typeof rp.stage === 'number') existing.stage = rp.stage;
          if (rp.role) existing.role = rp.role;
          const rpTag = (rp as any).tag;
          if (rpTag !== undefined) existing.tag = rpTag;
          const rpColors = (rp as any).colors;
          if (rpColors !== undefined) existing.colors = rpColors;
          const rpRoped = (rp as any).ropedById;
          if (rpRoped !== undefined) existing.ropedById = rpRoped ?? null;
          if (existing.ropedById === null) {
            existing.adminAnchor = undefined;
            existing.adminFacing = undefined;
          }
        } else {
          const resolvedFullName = (rp as any).fullName || roomRef.current?.players?.find((pl) => pl.userId === rp.id)?.fullName || undefined;
          playersRef.current.set(rp.id, {
            id: rp.id,
            username: rp.username,
            fullName: resolvedFullName,
            avatar: rp.avatar,
            role: rp.role,
            stage: rp.stage ?? 1,
            x: rp.x,
            y: rp.y,
            targetX: rp.x,
            targetY: rp.y,
            vx: 0,
            vy: 0,
            facing: rp.facing,
            onGround: false,
            ropedById: (rp as any).ropedById ?? null,
            adminAnchor: undefined,
            adminFacing: undefined,
            tag: (rp as any).tag,
            colors: (rp as any).colors,
          });
        }
      }
    }, [ably.presencePlayers]);

    useEffect(() => {
      function onKey(e: KeyboardEvent, down: boolean) {
        if (exitNoticeRef.current || (roomRef.current?.status === 'paused' && !isStaffRole(myRoleRef.current))) {
          keysRef.current.left = false;
          keysRef.current.right = false;
          keysRef.current.jump = false;
          return;
        }
        const target = e.target as HTMLElement | null;
        const active = document.activeElement as HTMLElement | null;
        const isTyping =
          (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) ||
          (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable));
        if (isTyping) {
          keysRef.current.left = false;
          keysRef.current.right = false;
          keysRef.current.jump = false;
          return;
        }
        if (e.key === 'Escape' && down) {
          if (isStaffRole(myRoleRef.current) && questionRef.current) {
            closeQuestionModal(questionRef.current.id);
            return;
          }
        }
        if (
          down &&
          (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'A', 'd', 'D', 'w', 'W', ' ', 'f', 'F', 'x', 'X', 'e', 'E', 'j', 'J'].includes(e.key))
        ) {
          if (isCameraFreePanningRef.current || spectateTargetIdRef.current) {
            returnCameraToSelf();
          }
        }
        if (['ArrowLeft', 'a', 'A'].includes(e.key)) keysRef.current.left = down;
        if (['ArrowRight', 'd', 'D'].includes(e.key)) keysRef.current.right = down;
        if (['ArrowUp', 'w', 'W', ' '].includes(e.key)) {
          keysRef.current.jump = down;
          if (down) e.preventDefault();
        }
        if (['f', 'F', 'x', 'X', 'e', 'E', 'j', 'J'].includes(e.key) && down) {
          fireLaser();
        }
        if (e.key === '/' && down) {
          if (!isStaffRole(myRoleRef.current)) return;
          e.preventDefault();
          keysRef.current.left = false;
          keysRef.current.right = false;
          keysRef.current.jump = false;
          setPanelsHidden(false);
          setChatMinimized(false);
          chatMinimizedRef.current = false;
          setChatInput('/');
          setTimeout(() => {
            const inputEl = document.getElementById('mp-chat-input') as HTMLInputElement | null;
            if (inputEl) {
              inputEl.focus();
              inputEl.setSelectionRange(1, 1);
            }
          }, 30);
        }
      }
      const kd = (e: KeyboardEvent) => onKey(e, true);
      const ku = (e: KeyboardEvent) => onKey(e, false);
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);
      return () => {
        window.removeEventListener('keydown', kd);
        window.removeEventListener('keyup', ku);
      };
    }, [fireLaser]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      function resize() {
        if (!canvas) return;
        const parent = canvas.parentElement;
        if (!parent) return;
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        cameraRef.current?.resize(canvas.width, canvas.height);
      }
      resize();
      window.addEventListener('resize', resize);
      const ro = typeof ResizeObserver !== 'undefined' && canvas.parentElement
        ? new ResizeObserver(() => resize())
        : null;
      if (ro && canvas.parentElement) ro.observe(canvas.parentElement);

      const camera = new Camera(canvas.width, canvas.height);
      cameraRef.current = camera;

      let raf = 0;
      let tick = 0;
      let prevSentX = -1;
      let prevSentY = -1;
      let prevSentVx = 0;
      let prevSentVy = 0;
      let prevSentFacing = 0;
      let prevSentDying = false;
      let lastFrameTime = performance.now();

      function loop(now = performance.now()) {
        if (!ctx || !canvas) return;
        const elapsedMs = now - lastFrameTime;
        lastFrameTime = now;
        // Normalisasi delta-time ke basis 60 FPS (16.6667ms) supaya layar Android 90Hz/120Hz/144Hz
        // punya kecepatan jalan & lompat yang persis sama dengan iOS dan PC 60Hz
        const dtScale = elapsedMs > 0 ? Math.min(2.5, Math.max(0.1, elapsedMs / (1000 / 60))) : 1;
        const camLerp = 1 - Math.pow(1 - 0.12, dtScale);
        tick += 1;

        const me = playersRef.current.get(myIdRef.current);

        for (const p of playersRef.current.values()) {
          if (p.id === myIdRef.current) continue;
          // Adaptive Mobile Legends Snapshot Buffer Interpolation:
          // - Untuk peer LAN (WebSocket ~16-25ms): interpDelay super rendah (~20ms) -> instan & 60/120 FPS mulus
          // - Untuk peer luar LAN (HTTP Single-Flight ~70-130ms): interpDelay otomatis menyesuaikan (~90-150ms) -> tetap mulus tanpa patah-patah
          let desiredX = p.targetX ?? p.x;
          let desiredY = p.targetY ?? p.y;

          const snaps = p.snapshots;
          if (snaps && snaps.length >= 2 && !p.isDying) {
            const avgInt = p.avgInterval ?? 24;
            const interpDelay = Math.max(18, Math.min(180, avgInt * 1.18));
            const renderTime = now - interpDelay;

            while (snaps.length > 2 && snaps[1].time <= renderTime) {
              snaps.shift();
            }

            const s0 = snaps[0];
            const s1 = snaps[1];
            if (renderTime <= s0.time) {
              desiredX = s0.x;
              desiredY = s0.y;
            } else if (renderTime <= s1.time) {
              const span = Math.max(1, s1.time - s0.time);
              const alpha = Math.max(0, Math.min(1, (renderTime - s0.time) / span));
              desiredX = s0.x + (s1.x - s0.x) * alpha;
              desiredY = s0.y + (s1.y - s0.y) * alpha;
            } else {
              const latest = snaps[snaps.length - 1];
              const overMs = Math.min(55, renderTime - latest.time);
              const overFrames = overMs / (1000 / 60);
              desiredX = Math.max(0, Math.min(WORLD.width - PLAYER_W, latest.x + latest.vx * overFrames * 0.7));
              desiredY = Math.min(WORLD.groundY - PLAYER_H, latest.y + latest.vy * overFrames * 0.7);
            }
          }

          const dx = desiredX - p.x;
          if (Math.abs(dx) > 450) {
            p.x = desiredX;
          } else if (Math.abs(dx) <= 0.15) {
            p.x = desiredX;
          } else {
            const smoothX = 1 - Math.pow(1 - 0.45, dtScale);
            p.x += dx * smoothX;
          }

          const dy = desiredY - p.y;
          if (Math.abs(dy) > 450) {
            p.y = desiredY;
          } else if (Math.abs(dy) <= 0.15) {
            p.y = desiredY;
          } else {
            const smoothY = 1 - Math.pow(1 - 0.48, dtScale);
            p.y += dy * smoothY;
          }
          for (const plat of stagePlatformsRef.current) {
            if (
              plat.type === 'fire' &&
              p.x + PLAYER_W > plat.x &&
              p.x < plat.x + plat.w &&
              p.y + PLAYER_H > plat.y &&
              p.y < plat.y + plat.h
            ) {
              p.burnUntil = Date.now() + 5000;
              break;
            }
          }
          if (p.ropedById) p.burnUntil = undefined;
        }

        // Auto-break rope HANYA jika admin (pemilik tali) benar-benar sudah pergi / DC.
        // CATATAN: admin pindah stage TIDAK memutus tali, malah memaksa player terikut.
        for (const p of playersRef.current.values()) {
          if (!p.ropedById) continue;
          const owner = playersRef.current.get(p.ropedById);
          if (!owner || !ably.connected) {
            p.ropedById = null;
            if (p.id === myIdRef.current) {
              showBanner('🪢 Tali kamu terlepas (player pergi / disconnect).');
              setRopedByUserId(null);
            }
          } else {
            // Simpan posisi owner sebagai anchor respawn (jika owner mati, anchor lama tetap dijaga sampai respawn)
            if (!owner.isDying) {
              p.adminAnchor = { x: owner.x, y: owner.y };
              p.adminFacing = owner.facing;
              if (p.id === myIdRef.current) {
                meAdminAnchorRef.current = { x: owner.x, y: owner.y };
                meAdminFacingRef.current = owner.facing;
              }
            }
          }
        }

        // Tali kaku (rigid leash) lintas stage: jika stage admin != stage player diikat,
        // TELEPORT paksa player ke belakang admin (tali "menarik" lintas stage).
        if (me && me.ropedById && !me.isDying) {
          const owner = playersRef.current.get(me.ropedById);
          if (owner && !owner.isDying && (owner.stage ?? 1) !== (me.stage ?? 1)) {
            applyStage(owner.stage ?? 1, { respawnPlayer: false, showToast: false, force: true });
            const side = owner.facing === 1 ? -1 : 1;
            me.x = owner.x + side * 60;
            me.y = owner.y;
            me.vx = 0;
            me.vy = 0;
            me.isDying = false;
            me.deathStartedAt = undefined;
            me.burnUntil = undefined;
            soundEngine.playBounce();
          }
        }

        // Rope drag: tali kaku (rigid leash), jarak fixed dari admin, player gabisa kabur
        const leashLen = 70;
        const applyLeash = (target: Player, ax: number, ay: number, afacing: number) => {
          const side = afacing === 1 ? -1 : 1;
          const tx = ax + side * 60;
          const ty = ay;
          const dx = target.x - tx;
          const dy = target.y - ty;
          const dist = Math.hypot(dx, dy);
          if (dist > leashLen) {
            const s = leashLen / dist;
            target.x = tx + dx * s;
            target.y = ty + dy * s;
          }
          target.vx = 0;
          target.vy = 0;
          target.facing = afacing === 1 ? 1 : -1;
        };
        if (me && !me.isDying) {
          for (const p of playersRef.current.values()) {
            if (p.id === myIdRef.current) continue;
            if (p.ropedById !== myIdRef.current) continue;
            if ((p.stage ?? 1) !== (me.stage ?? 1)) continue;
            if (p.isDying) continue;
            applyLeash(p, me.x, me.y, me.facing);
          }
        }
        // Leash di sisi player yang diikat: clamp posisi sendiri realtime (biar ga nimbrung di client sendiri)
        if (me && me.ropedById && !me.isDying) {
          const owner = playersRef.current.get(me.ropedById);
          // Boleh beda stage: leash tetap jalan (cross-stage dipindah paksa di blok atas).
          if (owner && !owner.isDying && (owner.stage ?? 1) === (me.stage ?? 1)) {
            applyLeash(me, owner.x, owner.y, owner.facing);
          } else if (owner && !owner.isDying && meAdminAnchorRef.current) {
            // Beda stage: clamp ke anchor admin supaya tidak drift jauh sebelum applyStage memindahkan
            applyLeash(me, meAdminAnchorRef.current.x, meAdminAnchorRef.current.y, meAdminFacingRef.current ?? owner.facing);
          }
        }

        const syncedNow = ably.getSyncedServerTime();
        updateStageEntities(
          stagePlatformsRef.current,
          stageEnemiesRef.current,
          dtScale,
          syncedNow,
          stagePowerUpsRef.current,
          projectilesRef.current,
          (projId, enemyId) => {
            soundEngine.playZap();
            const curStg = currentStageRef.current;
            const stompEvt = {
              op: 'stomp' as const,
              stg: curStg,
              id: enemyId,
              until: Date.now() + 9000,
            };
            applyObstacleEvent(stompEvt);
            ably.publishObstacle(stompEvt);
            pendingObstacleUploadRef.current = stompEvt;
          },
          stageBossesRef.current,
          (projId, bossId, dmg = 1) => {
            soundEngine.playZap();
            const b = stageBossesRef.current.find((x) => x.id === bossId);
            const curStg = currentStageRef.current;
            if (!b) return;
            const wasAlive = b.alive;
            const hitEvt = {
              op: 'boss_hit' as const,
              stg: curStg,
              bid: bossId,
              dmg,
              hp: b.hp,
            };
            ably.publishObstacle(hitEvt);
            pendingObstacleUploadRef.current = hitEvt;

            // Update local cache
            bossStateCacheRef.current.set(`${curStg}:${bossId}`, {
              hp: b.hp,
              maxHp: b.maxHp,
              alive: b.alive,
              x: b.x,
              dir: b.dir,
            });

            if (wasAlive && !b.alive && !bossDiedBannerRef.current.has(curStg)) {
              const dieEvt = { op: 'boss_died' as const, stg: curStg };
              applyObstacleEvent(dieEvt);
              ably.publishObstacle(dieEvt);
              pendingObstacleUploadRef.current = dieEvt;
            }
          },
          bossProjectilesRef.current,
          (spit) => {
            const curStg = currentStageRef.current;
            const evt = {
              op: 'boss_spit' as const,
              stg: curStg,
              bid: spit.bid,
              pid: spit.pid,
              x: spit.x,
              y: spit.y,
              vx: spit.vx,
              vy: spit.vy,
            };
            applyObstacleEvent(evt);
            ably.publishObstacle(evt);
          },
          (playerId, bossId) => {
            const victim = playersRef.current.get(playerId);
            if (!victim) return;
            const now = Date.now();
            victim.isDying = true;
            victim.deathStartedAt = now;
            victim.vx = 0;
            victim.vy = -13.2;
            victim.onGround = false;
            victim.ridingPlayerId = null;
            victim.lastCarrierX = undefined;
            victim.ridingPlatform = null;
            soundEngine.playDeath();
            void bossId;
          },
          Array.from(playersRef.current.values()),
          myIdRef.current,
        );

        // Periodic Boss Sync Broadcast: sinkronisasi darah & posisi boss ke pemain mode rope/follow
        const nowSync = Date.now();
        const curBoss = stageBossesRef.current[0];
        if (curBoss && nowSync - lastBossSyncBroadcastRef.current > 1800) {
          lastBossSyncBroadcastRef.current = nowSync;
          const curStg = currentStageRef.current;
          const allInStage = Array.from(playersRef.current.values()).filter((p) => (p.stage ?? 1) === curStg);
          const isAuthority = isStaff || allInStage.length === 0 || allInStage.every((p) => p.id >= myIdRef.current);
          if (isAuthority) {
            ably.publishObstacle({
              op: 'boss_sync',
              stg: curStg,
              bid: curBoss.id,
              hp: curBoss.hp,
              maxHp: curBoss.maxHp,
              alive: curBoss.alive,
              x: Math.round(curBoss.x),
              dir: curBoss.dir,
            });
          }
        }

        const curStage = currentStageRef.current;
        const tStages = totalStagesRef.current;
        const curStageQs = getStageQuestions(levelQuestionsRef.current, curStage, tStages);
        const stageTotal = curStageQs.length;
        let stageAnswered = 0;
        for (const sq of curStageQs) {
          if (answeredIdsRef.current.has(sq.id)) stageAnswered += 1;
        }
        const bossAlive = stageBossesRef.current.some((b) => b.alive);
        const isGateUnlocked = isStaff || ((stageTotal === 0 || stageAnswered >= stageTotal) && !bossAlive);

        const dynBlocks: Platform[] = questionBlocksRef.current.map((b) => {
          const qid = b.questionId ?? '';
          const res = answerResultsRef.current.get(qid);
          const type = res === 'assisted' ? 'qblock-assisted' : res === true ? 'qblock-correct' : res === false ? 'qblock-wrong' : 'qblock';
          return { ...b, type };
        });

        const isStudentPaused = room?.status === 'paused' && !isStaff;
        const isQuestionModalBusy = !isStaff && Boolean(questionRef.current && !answeredIdsRef.current.has(questionRef.current.id));
        if (isQuestionModalBusy) {
          keysRef.current.left = false;
          keysRef.current.right = false;
          keysRef.current.jump = false;
        }
        // Cek apakah player sudah bergeser/lepas dari kontak kotak yang baru di-close
        if (dismissedQuestionIdRef.current && me) {
          const dismissedBlock = questionBlocksRef.current.find((b) => b.questionId === dismissedQuestionIdRef.current);
          if (!dismissedBlock) {
            dismissedQuestionIdRef.current = null;
          } else {
            const isOverlapping =
              me.x + PLAYER_W > dismissedBlock.x - 4 &&
              me.x < dismissedBlock.x + dismissedBlock.w + 4 &&
              me.y + PLAYER_H >= dismissedBlock.y - 4 &&
              me.y <= dismissedBlock.y + dismissedBlock.h + 4;
            if (!isOverlapping) {
              dismissedQuestionIdRef.current = null;
            }
          }
        }

        if (
          me &&
          !exitNoticeRef.current &&
          !isStudentPaused &&
          (isStaff || room?.status === 'in_progress' || room?.status === 'waiting')
        ) {
          updatePlayerPhysics(
            me,
            isQuestionModalBusy ? { left: false, right: false, jump: false } : keysRef.current,
            playersRef.current.values(),
            dynBlocks,
            (qid) => {
              if (dismissedQuestionIdRef.current === qid) return;
              const cooldownUntil = closedQuestionCooldownRef.current.get(qid);
              if (cooldownUntil && Date.now() < cooldownUntil) return;
              if (questionRef.current?.id === qid) return;

              if (!isStaff) {
                if (answeredIdsRef.current.has(qid)) return;
                const found = levelQuestionsRef.current.find((q) => q.id === qid);
                if (found) {
                  keysRef.current.left = false;
                  keysRef.current.right = false;
                  keysRef.current.jump = false;
                  me.vx = 0;
                  soundEngine.playQuestionOpen();
                  questionRef.current = found;
                  setQuestion(found);
                  setQuestionMinimized(false);
                  setSelected('');
                  setPanelOffsets((prev) => ({ ...prev, question: { x: 0, y: 0 } }));
                  if (!isStaff) {
                    ably.publishCommand({ op: 'mirror_question_state', userId: myIdRef.current, qid: found.id });
                  }
                }
              } else {
                // Guru / Admin: bisa iseng mengecek soal kapanpun (baik saat mirroring maupun tidak)
                if (mirrorTargetRef.current) {
                  const res = answerResultsRef.current.get(qid);
                  if (res === true || res === 'assisted') return;
                }
                const found = levelQuestionsRef.current.find((q) => q.id === qid);
                if (found) {
                  keysRef.current.left = false;
                  keysRef.current.right = false;
                  keysRef.current.jump = false;
                  me.vx = 0;
                  soundEngine.playQuestionOpen();
                  questionRef.current = found;
                  setQuestion(found);
                  setQuestionMinimized(false);
                  setSelected('');
                  setPanelOffsets((prev) => ({ ...prev, question: { x: 0, y: 0 } }));
                }
              }
            },
            dtScale,
            (soundEvt) => {
              if (isQuestionModalBusy) return;
              if (soundEvt === 'jump') soundEngine.playJump();
              else if (soundEvt === 'bounce') soundEngine.playBounce();
              else if (soundEvt === 'burn') soundEngine.playBurn();
              else if (soundEvt === 'death') soundEngine.playDeath();
            },
            {
              basePlatforms: stagePlatformsRef.current,
              enemies: stageEnemiesRef.current,
              powerUps: stagePowerUpsRef.current,
              bosses: stageBossesRef.current,
              isGateUnlocked,
              isStaff,
              onObstacleEvent: (evt) => {
                applyObstacleEvent(evt);
                ably.publishObstacle(evt);
                pendingObstacleUploadRef.current = evt;
              },
              onCollectPowerUp: () => {
                soundEngine.playPowerUp();
                const meNow = playersRef.current.get(myIdRef.current);
                if (!meNow?.hasAdminGun) {
                  setAmmoCount(10);
                }
              },
              onRespawn: (p) => {
                if (p.id === myIdRef.current) {
                  const newAmmo = p.hasAdminGun && p.gun ? Infinity : (p.blasterAmmo ?? 0);
                  setAmmoCount(newAmmo);
                  if (previewBodyRef.current || previewTag1Ref.current || previewColorsRef.current) {
                    const restore = equippedBodyRef.current || 'cat';
                    setPreviewBody(null);
                    previewBodyRef.current = null;
                    setPreviewTag1(null);
                    previewTag1Ref.current = null;
                    setPreviewColors(null);
                    previewColorsRef.current = null;
                    p.bodyModel = restore;
                    p.avatar = restore === 'cat' ? 'cat-blue' : restore;
                    soundEngine.playBounce();
                    showBanner(`⚠️ Mode coba berakhir karena karakter gugur! Kembali ke [${restore.toUpperCase()}].`, 3500);
                  }
                }
              },
              onEnterGate: () => {
                  const curStg = currentStageRef.current;
                  const totStg = totalStagesRef.current;
                  if (gateEnterCooldownRef.current && Date.now() < gateEnterCooldownRef.current) return;
                  gateEnterCooldownRef.current = Date.now() + 1500;

                  if (curStg < totStg) {
                    const nextStg = curStg + 1;
                    applyStage(nextStg, {
                      respawnPlayer: true,
                      showToast: true,
                      persistCheckpoint: true,
                    });
                    soundEngine.playPowerUp();
                    showBanner(`🎉 Berhasil melewati pintu! Selamat datang di Stage ${nextStg} (Checkpoint tersimpan).`, 4500);
                  } else {
                    soundEngine.playPowerUp();
                    showBanner(`🏆 SELAMAT! Kamu telah menyelesaikan seluruh stage game ini!`, 6000);
                    setShowFinishCelebration(true);
                  }
                },
                  onLockedGateTouch: () => {
                    if (gateLockedNoticeCooldownRef.current && Date.now() < gateLockedNoticeCooldownRef.current) return;
                    gateLockedNoticeCooldownRef.current = Date.now() + 3000;
                    const curStg = currentStageRef.current;
                    const totStg = totalStagesRef.current;
                    const curStgQs = getStageQuestions(levelQuestionsRef.current, curStg, totStg);
                    const stageTotal = curStgQs.length;
                    let stageAnswered = 0;
                    for (const sq of curStageQs) {
                      if (answeredIdsRef.current.has(sq.id)) stageAnswered += 1;
                    }
                    const questionsDone = stageTotal === 0 || stageAnswered >= stageTotal;
                    const bossAlive = stageBossesRef.current.some((b) => b.alive);
                    if (!questionsDone && bossAlive) {
                      showBanner(`🔒 Pintu Terkunci! Selesaikan semua soal (${stageAnswered}/${stageTotal}) dan kalahkan Boss Penjaga terlebih dahulu!`, 3500);
                    } else if (!questionsDone) {
                      showBanner(`🔒 Pintu Terkunci! Jawab sisa soal (${stageTotal - stageAnswered} lagi) untuk membuka pintu!`, 3500);
                    } else if (bossAlive) {
                      showBanner('🔒 Pintu Terkunci! Kalahkan Boss Penjaga di depan pintu untuk mendapatkan kunci!', 3500);
                    }
                  },
                    playerRounds: projectilesRef.current
                      .map((r) => ({
                        id: r.id,
                        x: r.x,
                        y: r.y,
                        vx: r.vx,
                        shooterId: r.shooterId,
                        damage: r.damage,
                        len: r.length,
                        w: r.thickness,
                        h: r.thickness,
                        weapon: (r as Projectile & { weapon?: string }).weapon,
                        shooterRole: r.shooterRole ?? playersRef.current.get(r.shooterId)?.role,
                      })),
                      isPvpEnabled: isStudentPvpEnabledRef.current,
                        myPlayerId: myIdRef.current,
                          onPlayerHitByRound: (victimId, shooterId, dmg, weapon, projId) => {
                            if (projId && weapon !== 'megalaser') {
                              const idx = projectilesRef.current.findIndex((r) => r.id === projId);
                              if (idx !== -1) projectilesRef.current.splice(idx, 1);
                            }
                            const shooterRole =
                              shooterId === myIdRef.current
                                ? myRoleRef.current
                                : projectilesRef.current.find((r) => r.shooterId === shooterId)?.shooterRole ??
                                playersRef.current.get(shooterId)?.role ??
                                'student';
                            const victim = playersRef.current.get(victimId);
                            if (victim && !canShooterHitTarget(shooterRole, victim.role, isStudentPvpEnabledRef.current)) return;

                            if (victimId === myIdRef.current) {
                              const me = playersRef.current.get(myIdRef.current);
                              if (me && !me.isDying && !me.ropedById) {
                                const shooterName =
                                  playersRef.current.get(shooterId)?.username ??
                                  (shooterRole === 'admin' ? 'Admin' : shooterRole === 'teacher' ? 'Guru' : 'Player');
                                if (weapon === 'ice') {
                                  me.isDying = false;
                                  me.frozenUntil = Date.now() + 1200;
                                  me.frozenDeathAt = Date.now() + 1200;
                                  me.frozenByShooterId = shooterId;
                                  me.frozenByWeapon = 'ice';
                                  me.vx = me.x < (projectilesRef.current.find((r) => r.shooterId === shooterId)?.x ?? me.x) ? -4 : 4;
                                  me.vy = -3.5;
                                } else if (weapon === 'stunt') {
                                  me.isDying = false;
                                  me.frozenUntil = Date.now() + 1200;
                                  me.frozenDeathAt = Date.now() + 1200;
                                  me.stunnedUntil = Date.now() + 1200;
                                  me.frozenByShooterId = shooterId;
                                  me.frozenByWeapon = 'stunt';
                                  me.vx = 0;
                                  me.vy = 0;
                                } else {
                                  me.isDying = true;
                                  me.deathStartedAt = Date.now();
                                  me.vx = 0;
                                  me.vy = -13.2;
                                  soundEngine.playDeath();
                                }
                              }
                            }
                            ably.publishCommand({ op: 'hit', targetId: victimId, by: shooterId, dmg, weapon, shooterRole });
                          },
          },
        );
        }

        // Jalur 1 (WebSocket Port 3000 /ws-game atau Port 3001):
        // - Adaptif tick rate: 60Hz (16ms) di LAN, 42Hz (24ms) di luar jaringan agar bebas TCP bufferbloat
        // - Mengirim 1 paket "berhenti" terakhir saat vx=0 & vy=0 agar interpolasi player lain berhenti presisi
        if (me && ably.connected) {
          const nowMs = Date.now();
          const isMovingNow = Math.abs(me.vx) > 0.04 || Math.abs(me.vy) > 0.04;
          const wasMovingPrev = Math.abs(prevSentVx) > 0.04 || Math.abs(prevSentVy) > 0.04;
          const justStopped = !isMovingNow && wasMovingPrev;
          const moved =
            justStopped ||
            Math.abs(me.x - prevSentX) > 0.25 ||
            Math.abs(me.y - prevSentY) > 0.25 ||
            Math.abs(me.vx - prevSentVx) > 0.08 ||
            Math.abs(me.vy - prevSentVy) > 0.08 ||
            me.facing !== prevSentFacing ||
            Boolean(me.isDying) !== prevSentDying;
          const minSendInterval = justStopped ? 0 : ably.pingMs > 25 ? 24 : 16;
          if (moved && nowMs - lastSentRef.current >= minSendInterval) {
            lastSentRef.current = nowMs;
            prevSentX = me.x;
            prevSentY = me.y;
            prevSentVx = isMovingNow ? me.vx : 0;
            prevSentVy = isMovingNow ? me.vy : 0;
            prevSentFacing = me.facing;
            prevSentDying = Boolean(me.isDying);
            ably.publishPosition({
              id: me.id,
              username: me.username,
              avatar: previewBodyRef.current
                ? (previewBodyRef.current === 'cat' ? 'cat-blue' : previewBodyRef.current)
                : (equippedBodyRef.current === 'cat' ? 'cat-blue' : (equippedBodyRef.current || me.bodyModel || 'cat-blue')),
              bodyModel: previewBodyRef.current || equippedBodyRef.current || me.bodyModel || 'cat',
              role: myRole,
              stage: curStage,
              x: me.x,
              y: me.y,
              vx: isMovingNow ? me.vx : 0,
              vy: isMovingNow ? me.vy : 0,
              facing: me.facing,
              onGround: me.onGround,
              isDying: me.isDying,
              deathStartedAt: me.deathStartedAt,
              burnUntil: me.burnUntil,
              jailedUntil: me.jailedUntil,
              gun: me.gun ?? undefined,
              hasAdminGun: me.hasAdminGun,
              tag: me.tag,
              tag1: me.tag1,
              tag2: me.tag2,
              tag3: me.tag3,
              customNick: me.customNick,
              colors: me.colors,
            });
          }
        }

        const spectateP = spectateTargetIdRef.current ? playersRef.current.get(spectateTargetIdRef.current) : null;
        const followTarget = spectateP || me;
        if (!isCameraFreePanningRef.current && followTarget) {
          camera.follow(followTarget.x + PLAYER_W / 2, followTarget.y, camLerp);
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        camera.applyTransform(ctx);

        const curMapTheme = getMapThemeForStage(curStage, selectedStagesRef.current);
        drawWorld(ctx, {
          stage: curMapTheme,
          totalStages: tStages,
          stageAnswered,
          stageTotal,
          isGateUnlocked,
          bossAlive: stageBossesRef.current.some((b) => b.alive),
        });
        drawPlatforms(
          ctx,
          [...stagePlatformsRef.current, ...dynBlocks],
          curMapTheme,
          stageBossesRef.current.some((b) => b.alive),
        );
        drawEnemies(ctx, stageEnemiesRef.current, syncedNow);
        drawBosses(ctx, stageBossesRef.current, syncedNow);
        drawBossProjectiles(ctx, bossProjectilesRef.current, syncedNow);
        drawPowerUps(ctx, stagePowerUpsRef.current, syncedNow);
        drawProjectiles(ctx, projectilesRef.current, syncedNow);

        // Render tali: garis putus-putus admin <-> player yang diikat (terlihat di semua client)
        for (const p of playersRef.current.values()) {
          if (!p.ropedById) continue;
          const owner = playersRef.current.get(p.ropedById);
          if (!owner) continue;
          if ((p.stage ?? 1) !== (owner.stage ?? 1)) continue;
          if ((p.stage ?? 1) !== curStage) continue;
          ctx.save();
          ctx.setLineDash([8, 6]);
          ctx.strokeStyle = '#a97b4f';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(owner.x + PLAYER_W / 2, owner.y + PLAYER_H / 2);
          ctx.lineTo(p.x + PLAYER_W / 2, p.y + PLAYER_H / 2);
          ctx.stroke();
          ctx.restore();
        }

        for (const p of playersRef.current.values()) {
          const pStage = p.stage ?? 1;
          if (pStage !== curStage) continue;

          const role = p.id === myIdRef.current ? myRole : (p.role ?? (room?.hostId === p.id ? 'teacher' : 'student'));
          const displayName = p.customNick?.trim() || p.fullName?.trim() || p.username;
          const effectiveAvatar =
            p.id === myIdRef.current
              ? (previewBodyRef.current
                  ? (previewBodyRef.current === 'cat' ? 'cat-blue' : previewBodyRef.current)
                  : (equippedBodyRef.current === 'cat'
                      ? 'cat-blue'
                      : (equippedBodyRef.current || (p.bodyModel === 'cat' ? 'cat-blue' : (p.bodyModel || p.avatar || 'cat-blue')))))
              : (p.bodyModel && p.bodyModel !== 'cat'
                  ? p.bodyModel
                  : (p.avatar || 'cat-blue'));
          drawCat(
            ctx,
            p.x,
            p.y,
            PLAYER_W,
            PLAYER_H,
            effectiveAvatar,
            p.facing,
            displayName,
            role,
            bubblesRef.current.get(p.id) ?? null,
            {
              isDying: p.isDying,
              deathStartedAt: p.deathStartedAt,
              burnUntil: p.burnUntil,
              blasterAmmo: p.blasterAmmo,
              blasterUntil: p.blasterUntil,
              jailedUntil: p.jailedUntil,
              gun: p.gun,
              tag: (p.id === myIdRef.current && previewTag1Ref.current) ? previewTag1Ref.current : (p.tag1 || p.tag),
              tag1: (p.id === myIdRef.current && previewTag1Ref.current) ? previewTag1Ref.current : p.tag1,
              tag2: p.tag2,
              tag3: p.tag3,
              customNick: p.customNick,
              colors: (p.id === myIdRef.current && previewColorsRef.current)
                ? { ...(p.colors ?? {}), ...previewColorsRef.current }
                : p.colors,
              isGodMode: p.isGodMode || (p.id === myIdRef.current && isGodModeRef.current),
              frozenUntil: p.frozenUntil,
              stunnedUntil: p.stunnedUntil,
              velocity: { vx: p.vx, vy: p.vy },
            },
          );
        }

        ctx.restore();
        raf = requestAnimationFrame(loop);
      }
      raf = requestAnimationFrame(loop);

      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        ro?.disconnect();
      };
    }, [room?.status, room?.hostId, roomId, myRole, ablyEnabled, ably.connected, ably.publishPosition]);

    // Jalur 2 (Khusus Pemain Luar LAN / Tunnel Port 3000 yang tidak tembus port WebSocket 3001):
    // - HANYA aktif jika WebSocket belum terhubung (!ably.connected), sehingga pemain LAN tidak mengirim HTTP sama sekali
    // - Single-flight: request berikutnya hanya dikirim setelah request sebelumnya selesai (0 antrean / tidak bikin ping pemain lain naik!)
    // - Server /api/pos otomatis mem-broadcast gerakan pemain luar LAN ke semua pemain WebSocket LAN dalam < 0.2ms
    useEffect(() => {
      if (ably.connected) return;
      let active = true;
      let timer: ReturnType<typeof setTimeout>;
      let lastUploadX = -9999;
      let lastUploadY = -9999;
      let lastUploadVx = 0;
      let lastUploadVy = 0;
      let lastUploadFacing = 1;
      let lastUploadDying = false;
      let lastHeartbeatAt = 0;

      async function posLoop() {
        if (!active || ably.connected) return;
        const tStart = performance.now();
        let didSendMove = false;
        try {
          const me = playersRef.current.get(myIdRef.current);
          if (me && myIdRef.current) {
            const nowMs = Date.now();
            const isMoving = Math.abs(me.vx) > 0.04 || Math.abs(me.vy) > 0.04;
            const wasMoving = Math.abs(lastUploadVx) > 0.04 || Math.abs(lastUploadVy) > 0.04;
            const justStopped = !isMoving && wasMoving;
            const moved =
              justStopped ||
              Math.abs(me.x - lastUploadX) > 0.3 ||
              Math.abs(me.y - lastUploadY) > 0.3 ||
              me.facing !== lastUploadFacing ||
              Boolean(me.isDying) !== lastUploadDying;

            // Saat diam, gunakan SSE push stream untuk menerima gerakan player lain secara real-time,
            // dan hanya kirim heartbeat /api/pos setiap 1400ms agar bandwidth Cloudflare/4G 100% hemat!
            const pendingObs = pendingObstacleUploadRef.current;
            if (pendingObs) pendingObstacleUploadRef.current = null;

            if (moved || pendingObs || nowMs - lastHeartbeatAt >= 1400) {
              didSendMove = moved;
              lastHeartbeatAt = nowMs;
              lastUploadX = me.x;
              lastUploadY = me.y;
              lastUploadVx = isMoving ? me.vx : 0;
              lastUploadVy = isMoving ? me.vy : 0;
              lastUploadFacing = me.facing;
              lastUploadDying = Boolean(me.isDying);

              const postPayload: Record<string, unknown> = moved
                ? {
                  r: roomId,
                  u: me.id,
                  un: me.username,
                  fn: myFullNameRef.current || me.fullName || undefined,
                  av: me.avatar,
                  rl: myRole,
                  stg: currentStageRef.current,
                  x: Math.round(me.x * 10) / 10,
                  y: Math.round(me.y * 10) / 10,
                  vx: isMoving ? Math.round(me.vx * 100) / 100 : 0,
                  vy: isMoving ? Math.round(me.vy * 100) / 100 : 0,
                  f: me.facing,
                  g: me.onGround ? 1 : 0,
                  d: me.isDying ? 1 : 0,
                  ds: me.deathStartedAt,
                  b: me.burnUntil,
                  j: me.jailedUntil,
                  gn: me.gun ?? undefined,
                  tg: me.tag,
                  cl: me.colors,
                }
                : {
                  r: roomId,
                  u: me.id,
                };
              if (pendingObs) {
                postPayload.obstacle = pendingObs;
              }

              const res = await fetch('/api/pos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postPayload),
              });
              if (res.ok && active) {
                const rtt = Math.max(1, Math.round((performance.now() - tStart) * 0.42));
                ably.setPingMs((prev) => (prev <= 5 ? rtt : Math.round(prev * 0.6 + rtt * 0.4)));
                const data = await res.json();
                if (typeof data.st === 'number') {
                  ably.setServerTimeOffset(Math.round(data.st + rtt / 2 - Date.now()));
                }
                if (data.obstacles && typeof data.obstacles === 'object') {
                  const obs = data.obstacles as {
                    crumbles?: { stage: number; idx: number; startedAt: number }[];
                    stomps?: { stage: number; id: string; until: number }[];
                    powerups?: { stage: number; id: string; until: number }[];
                  };
                  if (Array.isArray(obs.crumbles)) {
                    for (const c of obs.crumbles) {
                      applyObstacleEvent({ op: 'crumble', stg: c.stage, idx: c.idx, at: c.startedAt });
                    }
                  }
                  if (Array.isArray(obs.stomps)) {
                    for (const s of obs.stomps) {
                      applyObstacleEvent({ op: 'stomp', stg: s.stage, id: s.id, until: s.until });
                    }
                  }
                  if (Array.isArray(obs.powerups)) {
                    for (const pu of obs.powerups) {
                      applyObstacleEvent({ op: 'powerup', stg: pu.stage, id: pu.id, until: pu.until });
                    }
                  }
                }
                if (data.roomDeleted || data.rs === 'deleted') {
                  active = false;
                  applyLiveRoomStatus('deleted');
                  return;
                }
                if (data.kicked && !isStaffRole(myRoleRef.current)) {
                  triggerForcedExit('kicked');
                  return;
                }
                if (!data.kicked && exitNoticeRef.current === 'kicked') {
                  handleRejoinApproved();
                }
                if (typeof data.rs === 'string' && data.rs) {
                  applyLiveRoomStatus(data.rs);
                }
                const peers = Array.isArray(data.p) ? data.p : [];
                for (const rp of peers) {
                  const uid = typeof rp.u === 'string' ? rp.u : '';
                  if (!uid || uid === myIdRef.current) continue;
                  ingestRemotePlayerSnapshot({
                    id: uid,
                    username: typeof rp.un === 'string' ? rp.un : 'Player',
                    fullName: typeof rp.fn === 'string' ? rp.fn : undefined,
                    avatar: typeof rp.av === 'string' ? rp.av : 'cat-orange',
                    role: typeof rp.rl === 'string' ? rp.rl : undefined,
                    stage: typeof rp.stg === 'number' ? rp.stg : typeof rp.stage === 'number' ? rp.stage : 1,
                    x: typeof rp.x === 'number' ? rp.x : 120,
                    y: typeof rp.y === 'number' ? rp.y : 600,
                    vx: typeof rp.vx === 'number' ? rp.vx : 0,
                    vy: typeof rp.vy === 'number' ? rp.vy : 0,
                    facing: rp.f === -1 ? -1 : 1,
                    onGround: Boolean(rp.g),
                    isDying: Boolean(rp.d),
                    deathStartedAt: typeof rp.ds === 'number' ? rp.ds : undefined,
                    burnUntil: typeof rp.b === 'number' ? rp.b : undefined,
                    jailedUntil: typeof rp.j === 'number' ? rp.j : undefined,
                    gun: typeof rp.gn === 'string' ? rp.gn : undefined,
                    tag: typeof rp.tg === 'string' ? rp.tg : undefined,
                    colors: (rp.cl as PlayerColors | undefined) ?? undefined,
                  });
                }
              }
            }
          }
        } catch {
          // non-fatal
        } finally {
          if (active && !ably.connected) {
            const elapsed = performance.now() - tStart;
            const waitMs = didSendMove ? Math.max(28, Math.round(55 - elapsed)) : 32;
            timer = setTimeout(posLoop, waitMs);
          }
        }
      }

      posLoop();
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }, [ably.connected, roomId, myRole]);

    useEffect(() => {
      let active = true;
      let timer: ReturnType<typeof setTimeout>;
      async function syncLoop() {
        if (!active) return;
        try {
          const me = playersRef.current.get(myIdRef.current);
          const payload: Record<string, unknown> = {
            roomId,
            chatCursor: chatCursorRef.current,
            justKicked: justKickedInSessionRef.current,
          };
          // Saat mirror siswa tertentu, minta status jawaban siswa itu agar warna kotak real-time
          if (mirrorFetchTargetRef.current) {
            payload.targetId = mirrorFetchTargetRef.current;
          }
          // Saat WebSocket sudah terhubung, posisi sudah di-stream real-time & disimpan ke DB oleh ws-hub/pos,
          // sehingga room-sync tidak perlu mengirim duplikat payload koordinat lagi.
          if (me && !ably.connected) {
            const rx = Math.round(me.x * 10) / 10;
            const ry = Math.round(me.y * 10) / 10;
            const prev = lastSyncedPosRef.current;
            if (
              Math.abs(rx - prev.x) > 0.4 ||
              Math.abs(ry - prev.y) > 0.4 ||
              me.facing !== prev.facing ||
              Math.abs(me.vx) > 0.05 ||
              Boolean(me.isDying)
            ) {
              payload.x = rx;
              payload.y = ry;
              payload.vx = Math.round(me.vx * 100) / 100;
              payload.vy = Math.round(me.vy * 100) / 100;
              payload.onGround = me.onGround;
              payload.isDying = Boolean(me.isDying);
              payload.deathStartedAt = me.deathStartedAt;
              payload.burnUntil = me.burnUntil;
              payload.facing = me.facing;
              lastSyncedPosRef.current = { x: rx, y: ry, facing: me.facing };
            }
          }
          const res = await fetch('/api/game/room-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.status === 401) {
            active = false;
            handleSessionReplaced();
            return;
          }
          if (!res.ok || !active) return;
          const data = await res.json();
          if (data.roomDeleted || data.room === null || data.room?.status === 'deleted') {
            active = false;
            applyLiveRoomStatus('deleted');
            return;
          }
          if (data.kicked && !isStaffRole(myRoleRef.current)) {
            triggerForcedExit('kicked');
            return;
          }
          if (!data.kicked && exitNoticeRef.current === 'kicked') {
            handleRejoinApproved();
          }
          if (Array.isArray(data.rejoinRequests)) {
            setRejoinRequests(data.rejoinRequests);
          }

          if (typeof data.sessionId === 'string' && data.sessionId) {
            sessionIdRef.current = data.sessionId;
          }
          const serverPlayers: RoomPlayer[] = data.players ?? [];
          setScores((prev) => {
            const next = { ...prev };
            for (const p of serverPlayers) next[p.userId] = p.score ?? 0;
            return next;
          });
          const activeIds = new Set(serverPlayers.map((p) => p.userId));
          for (const id of Array.from(playersRef.current.keys())) {
            if (id !== myIdRef.current && !activeIds.has(id)) {
              playersRef.current.delete(id);
            }
          }
          const nowWall = Date.now();
          for (const p of serverPlayers) {
            if (p.userId === myIdRef.current) continue;
            const existing = playersRef.current.get(p.userId);
            if (existing) {
              // Jangan timpa posisi dari posLoop yang lebih segar (< 1500ms)
              if (nowWall - (existing.lastPacketAt ?? 0) > 1500) {
                if (p.lastX !== undefined) existing.targetX = p.lastX;
                if (p.lastY !== undefined) existing.targetY = p.lastY;
                if (p.lastFacing !== undefined) existing.facing = p.lastFacing as 1 | -1;
              }
              if (p.username) existing.username = p.username;
              if (p.fullName) existing.fullName = p.fullName;
              if (p.role) existing.role = p.role;
              if (typeof p.stage === 'number') existing.stage = p.stage;
            } else {
              const px = p.lastX ?? 120;
              const py = p.lastY ?? 600;
              playersRef.current.set(p.userId, {
                id: p.userId,
                username: p.username,
                fullName: p.fullName || undefined,
                avatar: p.avatar,
                role: p.role,
                stage: p.stage ?? 1,
                x: px,
                y: py,
                targetX: px,
                targetY: py,
                vx: p.vx ?? 0,
                vy: p.vy ?? 0,
                facing: (p.lastFacing as 1 | -1) ?? 1,
                onGround: p.onGround ?? false,
              });
            }
          }
          if (data.room?.status === 'completed') {
            active = false;
            applyLiveRoomStatus('completed');
            return;
          }
          if (typeof data.room?.status === 'string') {
            applyLiveRoomStatus(data.room.status);
          }
          setRoom((prev) => {
            if (!prev) return prev;
            const statusChanged = data.room?.status && data.room.status !== prev.status;
            const playersChanged =
              prev.players.length !== serverPlayers.length ||
              prev.players.some((pl, idx) => pl.userId !== serverPlayers[idx]?.userId) ||
              prev.players.some((pl, idx) => pl.username !== serverPlayers[idx]?.username || pl.fullName !== serverPlayers[idx]?.fullName);
            if (!statusChanged && !playersChanged) return prev;
            const updated = {
              ...prev,
              status: data.room?.status ?? prev.status,
              players: serverPlayers,
            };
            roomRef.current = updated;
            return updated;
          });
          if (typeof data.chatCursor === 'number' && data.chatCursor > chatCursorRef.current) {
            chatCursorRef.current = data.chatCursor;
          }
          if (Array.isArray(data.messages) && data.messages.length > 0) {
            ingestMessages(data.messages);
          }
          if (data.answerResults && typeof data.answerResults === 'object') {
            if (Array.isArray(data.answeredQuestionIds) && data.answeredQuestionIds.length === 0) {
              answerResultsRef.current.clear();
            } else {
              for (const [qid, okAns] of Object.entries(data.answerResults as Record<string, boolean | 'assisted'>)) {
                answerResultsRef.current.set(qid, okAns === 'assisted' ? 'assisted' : Boolean(okAns));
              }
            }
          }
          // Saat mirror siswa tertentu, jawaban yg masuk adalah milik siswa itu:
          // refresh jawaban siswa yang sudah dihapus dari server (misal habis /reset)
          if (mirrorFetchTargetRef.current && Array.isArray(data.answeredQuestionIds)) {
            const serverSet = new Set(data.answeredQuestionIds as string[]);
            for (const qid of Array.from(answerResultsRef.current.keys())) {
              if (!serverSet.has(qid)) answerResultsRef.current.delete(qid);
            }
          }
          if (Array.isArray(data.answeredQuestionIds)) {
            if (data.answeredQuestionIds.length === 0) {
              answeredIdsRef.current.clear();
              setAnsweredQuestionIds([]);
              setCorrectCount(0);
            } else {
              for (const qid of data.answeredQuestionIds) answeredIdsRef.current.add(qid);
              setAnsweredQuestionIds((prev) => (prev.length === answeredIdsRef.current.size ? prev : Array.from(answeredIdsRef.current)));
            }
          }
          if (typeof data.correctCount === 'number') {
            setCorrectCount(data.correctCount);
          }
          if (Array.isArray(data.rejoinRequests)) {
            setRejoinRequests(data.rejoinRequests);
          }
        } catch {
          // polling fallback failure is non-fatal
        } finally {
          // Saat WebSocket aktif, semua posisi/chat/skor/soal sudah real-time lewat WS,
          // sehingga room-sync cukup jalan setiap 4 detik sebagai heartbeat ringan (hemat bandwidth luar LAN 7x lipat!)
          const syncInterval = ably.connected ? 12000 : 2500;
          if (active) timer = setTimeout(syncLoop, syncInterval);
        }
      }
      syncLoop();
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }, [ably.connected, roomId, levelQuestions]);

    useEffect(() => {
      if (!ably.roomStatusEvent) return;
      applyLiveRoomStatus(ably.roomStatusEvent);
    }, [ably.roomStatusEvent]);

    useEffect(() => {
      if (!ably.rejoinRequestsEvent) return;
      setRejoinRequests(ably.rejoinRequestsEvent);
    }, [ably.rejoinRequestsEvent]);

    useEffect(() => {
      if (!ably.scoreEvent) return;
      setScores((prev) => ({ ...prev, [ably.scoreEvent!.userId]: ably.scoreEvent!.score }));
    }, [ably.scoreEvent]);

    useEffect(() => {
      if (!ably.kickedPlayerId) return;
      if (ably.kickedPlayerId === myIdRef.current || ably.kickedPlayerId === 'me') {
        if (!manualLeaveRef.current && !isStaffRole(myRoleRef.current)) {
          justKickedInSessionRef.current = true;
          triggerForcedExit('kicked');
        }
      } else {
        playersRef.current.delete(ably.kickedPlayerId);
        setRoom((prev) =>
          prev ? { ...prev, players: prev.players.filter((pl) => pl.userId !== ably.kickedPlayerId) } : prev,
        );
      }
    }, [ably.kickedPlayerId]);

    useEffect(() => {
      if (!ably.approvedPlayerId) return;
      if (ably.approvedPlayerId === myIdRef.current || ably.approvedPlayerId === 'me') {
        handleRejoinApproved();
      }
    }, [ably.approvedPlayerId]);

    useEffect(() => {
      if (!chatMinimized) {
        const box = chatBoxRef.current;
        if (box) box.scrollTop = box.scrollHeight;
      }
    }, [chat, chatMinimized]);

    useEffect(() => {
      if (ably.chatMessages.length > 0) {
        ingestMessages(ably.chatMessages as ChatMsg[]);
      }
    }, [ably.chatMessages]);

    function onPointerDown(e: React.PointerEvent) {
      draggingRef.current = { active: true, x: e.clientX, y: e.clientY, moved: false };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setChatMinimized(true);
    }
    function onPointerMove(e: React.PointerEvent) {
      if (!draggingRef.current.active || !cameraRef.current) return;
      const dx = e.clientX - draggingRef.current.x;
      const dy = e.clientY - draggingRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        draggingRef.current.moved = true;
        if (!isCameraFreePanningRef.current) {
          isCameraFreePanningRef.current = true;
          setIsCameraFreePanning(true);
        }
        if (spectateTargetIdRef.current) {
          spectateTargetIdRef.current = null;
          setSpectateTargetId(null);
        }
      }
      cameraRef.current.panBy(dx, dy);
      draggingRef.current = { active: true, x: e.clientX, y: e.clientY, moved: draggingRef.current.moved };
    }
    function onPointerUp(e: React.PointerEvent) {
      const wasDrag = draggingRef.current.moved;
      draggingRef.current.active = false;
      // Admin: klik (bukan drag) langsung pada kotak soal untuk membukanya
      if (
        wasDrag ||
        myRoleRef.current !== 'admin' ||
        questionRef.current ||
        questionBlocksRef.current.length === 0
      )
        return;
      const canvas = canvasRef.current;
      const cam = cameraRef.current;
      if (!canvas || !cam) return;
      const rect = canvas.getBoundingClientRect();
      const worldX = (e.clientX - rect.left) / cam.zoom + cam.x;
      const worldY = (e.clientY - rect.top) / cam.zoom + cam.y;
      const hit = questionBlocksRef.current.find(
        (b) => worldX >= b.x && worldX <= b.x + b.w && worldY >= b.y && worldY <= b.y + b.h,
      );
      if (!hit || !hit.questionId) return;
      const res = answerResultsRef.current.get(hit.questionId);
      if (res === true || res === 'assisted') return;
      const found = levelQuestionsRef.current.find((q) => q.id === hit.questionId);
      if (!found) return;
      soundEngine.playQuestionOpen();
      questionRef.current = found;
      setQuestion(found);
      setQuestionMinimized(false);
      setSelected('');
      setPanelOffsets((prev) => ({ ...prev, question: { x: 0, y: 0 } }));
    }
    function onWheel(e: React.WheelEvent) {
      e.preventDefault();
      cameraRef.current?.zoomBy(e.deltaY > 0 ? -0.1 : 0.1);
    }

    function startPanelDrag(key: string, e: React.PointerEvent, allowButtonDrag = false) {
      if (!allowButtonDrag && (e.target as HTMLElement).closest('button, input')) return;
      e.stopPropagation();
      const cur = panelOffsets[key] ?? { x: 0, y: 0 };
      panelDragRef.current = { key, startX: e.clientX, startY: e.clientY, origX: cur.x, origY: cur.y, moved: false };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }

    function movePanelDrag(e: React.PointerEvent) {
      const d = panelDragRef.current;
      if (!d) return;
      e.stopPropagation();
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
      let nx = d.origX + dx;
      let ny = d.origY + dy;
      if (d.key === 'question') {
        const maxW = typeof window !== 'undefined' ? window.innerWidth * 0.42 : 300;
        const maxH = typeof window !== 'undefined' ? window.innerHeight * 0.42 : 220;
        nx = Math.max(-maxW, Math.min(maxW, nx));
        ny = Math.max(-maxH, Math.min(maxH, ny));
      }
      setPanelOffsets((prev) => ({ ...prev, [d.key]: { x: nx, y: ny } }));
    }

    function endPanelDrag(e: React.PointerEvent, onClickFallback?: () => void) {
      const d = panelDragRef.current;
      if (!d) return;
      e.stopPropagation();
      const wasMoved = d.moved;
      panelDragRef.current = null;
      if (!wasMoved && onClickFallback) onClickFallback();
    }

    function panelStyle(key: string): React.CSSProperties | undefined {
      const o = panelOffsets[key];
      return o ? { transform: `translate(${o.x}px, ${o.y}px)` } : undefined;
    }

    const activePointersRef = useRef<Map<number, 'left' | 'right' | 'jump' | 'shoot'>>(new Map());

    const touchControl = useCallback((dir: 'left' | 'right' | 'jump', down: boolean) => {
      if (down) {
        soundEngine.unlockAndStartBgm();
        if (isCameraFreePanningRef.current || spectateTargetIdRef.current) {
          returnCameraToSelf();
        }
      }
      if (
        editingControlsLayout ||
        exitNoticeRef.current ||
        (roomRef.current?.status === 'paused' && !isStaffRole(myRoleRef.current))
      ) {
        keysRef.current.left = false;
        keysRef.current.right = false;
        keysRef.current.jump = false;
        return;
      }
      keysRef.current[dir] = down;
    }, [editingControlsLayout, returnCameraToSelf]);

    const handleTouchControlStart = useCallback(
      (action: 'left' | 'right' | 'jump' | 'shoot', e: React.PointerEvent) => {
        if (editingControlsLayout) return;
        e.preventDefault();
        e.stopPropagation();
        soundEngine.unlockAndStartBgm();
        if (isCameraFreePanningRef.current || spectateTargetIdRef.current) {
          returnCameraToSelf();
        }

        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch (_) { }

        activePointersRef.current.set(e.pointerId, action);

        if (action === 'shoot') {
          fireLaser();
        } else {
          touchControl(action, true);
        }
      },
      [editingControlsLayout, fireLaser, returnCameraToSelf, touchControl],
    );

    const handleTouchControlEnd = useCallback(
      (action: 'left' | 'right' | 'jump' | 'shoot', e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();

        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch (_) { }

        activePointersRef.current.delete(e.pointerId);

        let stillHeld = false;
        for (const act of activePointersRef.current.values()) {
          if (act === action) {
            stillHeld = true;
            break;
          }
        }
        if (!stillHeld && action !== 'shoot') {
          touchControl(action, false);
        }
      },
      [touchControl],
    );

    function startControlGroupDrag(group: 'dpad' | 'jump', e: React.PointerEvent) {
      if (!editingControlsLayout) return;
      e.preventDefault();
      e.stopPropagation();
      const origX = group === 'dpad' ? hudControls.dpadX : hudControls.jumpX;
      const origY = group === 'dpad' ? hudControls.dpadY : hudControls.jumpY;
      controlDragRef.current = {
        group,
        startX: e.clientX,
        startY: e.clientY,
        origX,
        origY,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }

    function moveControlGroupDrag(e: React.PointerEvent) {
      const d = controlDragRef.current;
      if (!d || !editingControlsLayout) return;
      e.preventDefault();
      e.stopPropagation();
      const nx = Math.round(Math.max(-360, Math.min(360, d.origX + (e.clientX - d.startX))));
      const ny = Math.round(Math.max(-420, Math.min(120, d.origY + (e.clientY - d.startY))));
      if (d.group === 'dpad') {
        updateHudControls({ dpadX: nx, dpadY: ny });
      } else {
        updateHudControls({ jumpX: nx, jumpY: ny });
      }
    }

    function endControlGroupDrag(e: React.PointerEvent) {
      if (!controlDragRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      controlDragRef.current = null;
    }

    function addSystemChatMessage(text: string) {
      const sysMsg: ChatMsg = {
        id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        senderName: 'SYSTEM',
        text,
        createdAt: new Date().toISOString(),
      };
      ingestMessages([sysMsg]);
    }

    // Chat command access control (fitur /enable cmd & /disable cmd):
    // - admin & guru: bisa pakai perintah, kontrol room
    // - student: default tidak bisa. Kalau di-enable admin/guru via /enable cmd <user|all>,
    //   bisa pakai cmd dengan target DIRI SENDIRI (me) saja (sementara di room tsb,
    //   rejoin / refresh = akses otomatis hilang). /disable cmd <user|all> mencabut akses.
    const cmdEnabledUsersRef = useRef<Set<string>>(new Set());
    const isStudentCmdAllowed = (uid: string) =>
      cmdEnabledUsersRef.current.has(uid) || cmdEnabledUsersRef.current.has('__ALL_STUDENTS__');

    async function handleChatCommand(rawText: string) {
      const isStaff = isStaffRole(myRoleRef.current);
      const isAdmin = myRoleRef.current === 'admin';

      if (!isStaff && !isStudentCmdAllowed(myIdRef.current)) {
        // Siswa yang belum di-enable: ketik '/' dianggap chat biasa, tanpa pesan error
        return;
      }

      const parts = rawText.slice(1).trim().split(/\s+/);
      const cmd = parts[0]?.toLowerCase();
      const arg1 = parts[1]?.toLowerCase();
      const arg2 = parts[2]?.toLowerCase();

      // Helper to find player by username or 'me'
      const findPlayer = (nameQuery?: string) => {
        if (!nameQuery) return null;
        if (nameQuery === 'me') {
          const myP = playersRef.current.get(myIdRef.current);
          return myP ? { id: myIdRef.current, username: myUsernameRef.current || 'Me' } : null;
        }
        for (const p of playersRef.current.values()) {
          if (p.username.toLowerCase() === nameQuery) {
            return { id: p.id, username: p.username };
          }
        }
        const foundInRoom = roomRef.current?.players?.find((pl) => pl.username.toLowerCase() === nameQuery);
        if (foundInRoom) {
          return { id: foundInRoom.userId, username: foundInRoom.username };
        }
        return null;
      };

      // Batasi target untuk non-admin:
      // - student yang di-enable: cuman bisa target diri sendri
      // - teacher: bebas target kecuali role admin
      const resolveTarget = (targetQuery?: string) => {
        const target = findPlayer(targetQuery);
        if (!target) {
          addSystemChatMessage(`Player '${targetQuery || ''}' tidak ditemukan di room.`);
          return null;
        }
        const targetRole = target.id === myIdRef.current
          ? myRoleRef.current
          : (playersRef.current.get(target.id)?.role ?? roomRef.current?.players?.find((pl) => pl.userId === target.id)?.role);
        if (!isAdmin) {
          if (target.id !== myIdRef.current && targetRole === 'admin') {
            addSystemChatMessage('Tidak bisa menargetkan Administrator.');
            return null;
          }
          if (myRoleRef.current === 'student' && target.id !== myIdRef.current) {
            addSystemChatMessage('Kamu cuman bisa pakai perintah ke diri sendiri.');
            return null;
          }
        }
        return target;
      };

      // /enable cmd <target|all> & /disable cmd <target|all>: khusus Admin & Guru
      if (cmd === 'enable' && arg1 === 'cmd') {
        if (!isStaff) {
          addSystemChatMessage('Perintah /enable cmd hanya untuk Guru dan Administrator.');
          return;
        }
        const targetQuery = arg2;
        if (!targetQuery) {
          addSystemChatMessage('Format: /enable cmd <target|all>');
          return;
        }
        if (targetQuery === 'here') {
          const curStg = currentStageRef.current;
          for (const p of playersRef.current.values()) {
            const role = p.role ?? roomRef.current?.players?.find((pl) => pl.userId === p.id)?.role;
            if ((role === 'student' || (!role && p.id !== myIdRef.current)) && (p.stage ?? 1) === curStg) {
              cmdEnabledUsersRef.current.add(p.id);
              ably.publishCommand({ op: 'cmd_access', targetId: p.id, value: true });
            }
          }
          addSystemChatMessage(`✅ Akses perintah chat DIAKTIFKAN untuk siswa di Stage ${curStg}.`);
          soundEngine.playPowerUp();
          return;
        }

        if (targetQuery === 'all') {
          cmdEnabledUsersRef.current.add('__ALL_STUDENTS__');
          for (const p of playersRef.current.values()) {
            const role = p.role ?? roomRef.current?.players?.find((pl) => pl.userId === p.id)?.role;
            if (role === 'student' || (!role && p.id !== myIdRef.current)) {
              cmdEnabledUsersRef.current.add(p.id);
            }
          }
          if (roomRef.current?.players) {
            for (const pl of roomRef.current.players) {
              if (pl.role === 'student') cmdEnabledUsersRef.current.add(pl.userId);
            }
          }
          ably.publishCommand({ op: 'cmd_access', targetId: 'all', value: true });
          addSystemChatMessage('✅ Akses perintah chat DIAKTIFKAN untuk SEMUA siswa di room ini. Berlaku sementara sampai rejoin / di-disable.');
          soundEngine.playPowerUp();
          return;
        }

        const target = findPlayer(targetQuery);
        if (!target) {
          addSystemChatMessage(`Player '${targetQuery}' tidak ditemukan di room.`);
          return;
        }
        const targetRole = playersRef.current.get(target.id)?.role ?? roomRef.current?.players?.find((pl) => pl.userId === target.id)?.role;
        if (targetRole === 'admin' || targetRole === 'teacher') {
          addSystemChatMessage('Admin & guru sudah otomatis memiliki akses semua perintah.');
          return;
        }
        cmdEnabledUsersRef.current.add(target.id);
        ably.publishCommand({ op: 'cmd_access', targetId: target.id, value: true });
        addSystemChatMessage(`✅ '${target.username}' sekarang bisa pakai perintah chat (khusus target diri sendiri). Berlaku sementara sampai rejoin / di-disable.`);
        soundEngine.playPowerUp();
        return;
      }

      if ((cmd === 'disable' && arg1 === 'cmd') || (cmd === 'cmd' && arg1 === 'disable')) {
        if (!isStaff) {
          addSystemChatMessage('Perintah /disable cmd hanya untuk Guru dan Administrator.');
          return;
        }
        const targetQuery = arg2;
        if (!targetQuery) {
          addSystemChatMessage('Format: /disable cmd <target|all>');
          return;
        }
        if (targetQuery === 'here') {
          const curStg = currentStageRef.current;
          for (const p of playersRef.current.values()) {
            const role = p.role ?? roomRef.current?.players?.find((pl) => pl.userId === p.id)?.role;
            if ((role === 'student' || (!role && p.id !== myIdRef.current)) && (p.stage ?? 1) === curStg) {
              cmdEnabledUsersRef.current.delete(p.id);
              ably.publishCommand({ op: 'cmd_access', targetId: p.id, value: false });
            }
          }
          addSystemChatMessage(`⛔ Akses perintah chat untuk siswa di Stage ${curStg} telah dicabut.`);
          soundEngine.playDeath();
          return;
        }

        if (targetQuery === 'all') {
          cmdEnabledUsersRef.current.clear();
          ably.publishCommand({ op: 'cmd_access', targetId: 'all', value: false });
          addSystemChatMessage('⛔ Akses perintah chat untuk SEMUA siswa di room telah dicabut.');
          soundEngine.playDeath();
          return;
        }

        const target = findPlayer(targetQuery);
        if (!target) {
          addSystemChatMessage(`Player '${targetQuery}' tidak ditemukan di room.`);
          return;
        }
        const targetRole = playersRef.current.get(target.id)?.role ?? roomRef.current?.players?.find((pl) => pl.userId === target.id)?.role;
        if (targetRole === 'admin' || targetRole === 'teacher') {
          addSystemChatMessage('Akses perintah admin & guru tidak bisa dicabut.');
          return;
        }
        cmdEnabledUsersRef.current.delete(target.id);
        cmdEnabledUsersRef.current.delete('__ALL_STUDENTS__');
        ably.publishCommand({ op: 'cmd_access', targetId: target.id, value: false });
        addSystemChatMessage(`⛔ Akses perintah chat '${target.username}' telah dicabut.`);
        soundEngine.playDeath();
        return;
      }

      const ALL_COMMANDS: { prefix: string; usage: string; adminOnly?: boolean; staffOnly?: boolean; staffStrict?: boolean }[] = [
        { prefix: 'cls', usage: '• /cls : Bersihkan seluruh chat di layar' },
        { prefix: 'set', usage: '• /set god <user|me|here|all> : Aktifkan God Mode (here = di stagemu, all = se-game)' },
        { prefix: 'unset', usage: '• /unset god <user|me|here|all> : Nonaktifkan God Mode' },
        { prefix: 'teleport', usage: '• /teleport <username> : Nyamperin player (pindah ke stage & posisinya)', adminOnly: true },
        { prefix: 'teleport', usage: '• /teleport here [me|<stage>] : Tarik player di stagemu ke posisimu / lempar ke stage lain', adminOnly: true },
        { prefix: 'teleport', usage: '• /teleport all <me|here|<stage>> : Tarik SELURUH siswa ke posisimu / lempar ke stage', adminOnly: true },
        { prefix: 'teleport', usage: '• /teleport <user|me> me : Tarik player ke posisimu' },
        { prefix: 'teleport', usage: `• /teleport <user|me> <stage> : Lempar player ke Stage tertentu (1-${totalStagesRef.current} atau ID S1-S20)` },
        { prefix: 'mirror', usage: '• /mirror <username> : Tampilkan & bantu jawab kotak soal siswa', staffOnly: true },
        { prefix: 'mirror', usage: '• /mirror all : Mode soal bonus untuk seluruh kelas', staffOnly: true },
        { prefix: 'unset', usage: '• /unset mirror : Sembunyikan kembali kotak soal', staffOnly: true },
        { prefix: 'reset', usage: '• /reset <user|me> : Reset jawaban & skor player ke Stage 1' },
        { prefix: 'reset', usage: '• /reset all : Reset SEMUA jawaban 1 room ke Stage 1', adminOnly: true },
        { prefix: 'spawn', usage: '• /spawn gun <minigun|laser|megalaser|ice|stunt|none> [user|me|here|all] : Beri / cabut senjata', staffOnly: true },
        { prefix: 'jail', usage: '• /jail on|off [user|me] : Bekukan player selama 15 detik', staffOnly: true },
        { prefix: 'set', usage: '• /set tag <1|2|3> <user|me> <title> : Atur title/tag permanen 3 tingkat (1=bawah, 2=tengah, 3=atas)', staffOnly: true },
        { prefix: 'unset', usage: '• /unset tag <1|2|3|all> <user|me> : Hapus title/tag di posisi 1/2/3 atau all', staffOnly: true },
        { prefix: 'set', usage: '• /set nick <user|me> <nama> : Ganti nickname permanen di atas kepala', staffOnly: true },
        { prefix: 'unset', usage: '• /unset nick <user|me> : Kembalikan nickname ke nama asli', staffOnly: true },
        { prefix: 'change', usage: '• /change color <user|me> body|tag|tag1|tag2|tag3|nick <warna> : Ganti warna (bisa per tag: tag1, tag2, tag3, atau tag)', staffOnly: true },
        { prefix: 'change', usage: '• /change body [user|me] <virus|cacing|burung|ayam|sapi|domba|cat> : Ganti model karakter animasi (virus rolling, cacing melar, burung mengepak, dll)' },
        { prefix: 'change', usage: '• /change tag <user|me> <title> : Shortcut atur tag level 1', staffOnly: true },
        { prefix: 'take', usage: '• /take rope <user|here|all> : Ikat player dengan tali (ikut admin & kebal rintangan)', adminOnly: true },
        { prefix: 'untake', usage: '• /untake rope <user|here|all> : Lepas tali player', adminOnly: true },
        { prefix: 'skip', usage: '• /skip stage <username|here|all|rope> : Tandai soal tersisa selesai (here = stagemu, all = se-game)', adminOnly: true },
        { prefix: 'enable', usage: '• /enable cmd <target|all> : Izinkan siswa di room pakai perintah chat (sementara)', staffStrict: true },
        { prefix: 'disable', usage: '• /disable cmd <target|all> : Cabut akses perintah chat siswa di room', staffStrict: true },
      ];

      if (cmd === 'help' || cmd === 'cmd') {
        const sub = (arg1 || parts[1])?.toLowerCase();
        if (sub && sub !== 'all') {
          const matching = ALL_COMMANDS.filter((c) => {
            if (c.adminOnly && !isAdmin) return false;
            if (c.staffStrict && !isStaff) return false;
            if (c.staffOnly && !isStaff && !isStudentCmdAllowed(myIdRef.current)) return false;
            return c.prefix === sub || c.prefix.startsWith(sub);
          });
          if (matching.length > 0) {
            addSystemChatMessage(`Format perintah /${sub}:`);
            for (const m of matching) {
              addSystemChatMessage(m.usage);
            }
            return;
          }
        }
        // Ringkas: tidak banjir chat menjelaskan semuanya sekaligus
        addSystemChatMessage('--- DAFTAR PERINTAH CHAT ---');
        addSystemChatMessage('Ketik perintah untuk melihat format syntaxnya (contoh: /skip):');
        addSystemChatMessage('• /set, /unset, /teleport, /mirror, /reset');
        addSystemChatMessage('• /follow <user>, /unfollow');
        if (isAdmin || isStaff) {
          addSystemChatMessage('• /spawn, /jail, /enable, /disable, /take, /untake');
        }
        if (isAdmin) {
          addSystemChatMessage('• /skip');
        }
        addSystemChatMessage('• /change, /cls');
        return;
      }
      // /follow <target> & /unfollow
      if (cmd === 'follow') {
        const targetQuery = arg1 || parts[1];
        if (!targetQuery) {
          addSystemChatMessage('Format: /follow <username>');
          return;
        }
        const target = findPlayer(targetQuery);
        if (!target) {
          addSystemChatMessage(`Player '${targetQuery}' tidak ditemukan di room.`);
          return;
        }
        if (target.id === myIdRef.current) {
          addSystemChatMessage('Kamu tidak bisa mengikuti dirimu sendiri.');
          return;
        }
        const me = playersRef.current.get(myIdRef.current);
        if (me) {
          me.ropedById = target.id;
          const targetP = playersRef.current.get(target.id);
          if (targetP) {
            meAdminAnchorRef.current = { x: targetP.x, y: targetP.y };
            meAdminFacingRef.current = targetP.facing ?? 1;
          }
        }
        setRopedByUserId(target.id);
        // Mode Follow: otomatis aktifkan mode mirror ke player yang diikuti
        mirrorTargetRef.current = { userId: target.id, username: target.username };
        mirrorFetchTargetRef.current = target.id;
        setMirrorTarget(target.username);
        const targetP = playersRef.current.get(target.id);
        const followStg = targetP?.stage ?? currentStageRef.current;
        const followStageQs = getStageQuestions(levelQuestionsRef.current, followStg, totalStagesRef.current);
        questionBlocksRef.current = generateQuestionBlocks(
          followStageQs.map((q) => q.id),
          `${target.id}:${roomId}:s${followStg}`,
          followStg,
        );
        answerResultsRef.current.clear();
        studentChosenAnswersRef.current.clear();
        fetch('/api/game/room-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, targetId: target.id }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (!d) return;
            if (d.answerResults) {
              for (const [qid, okAns] of Object.entries(d.answerResults)) {
                answerResultsRef.current.set(qid, okAns === 'assisted' ? 'assisted' : Boolean(okAns));
              }
            }
            if (d.chosenAnswers) {
              for (const [qid, ans] of Object.entries(d.chosenAnswers)) {
                studentChosenAnswersRef.current.set(qid, String(ans));
              }
              setStudentChosenAnswers(new Map(studentChosenAnswersRef.current));
            }
          })
          .catch(() => { });

        ably.publishCommand({
          op: 'rope',
          targetId: myIdRef.current,
          value: true,
          byId: target.id,
          byName: target.username,
        });
        addSystemChatMessage(`🪢 Kamu sekarang mengikuti '${target.username}'! Gerakan & soalnya otomatis di-mirror ke layarmu. Ketik /unfollow untuk melepas.`);
        soundEngine.playPowerUp();
        return;
      }

      if (cmd === 'unfollow') {
        const me = playersRef.current.get(myIdRef.current);
        if (!me?.ropedById && !ropedByUserId) {
          addSystemChatMessage('Kamu sedang tidak mengikuti player siapa pun.');
          return;
        }
        if (me) {
          me.ropedById = null;
          me.adminAnchor = undefined;
          me.adminFacing = undefined;
        }
        meAdminAnchorRef.current = null;
        meAdminFacingRef.current = 1;
        setRopedByUserId(null);
        if (mirrorTargetRef.current && mirrorTargetRef.current !== 'all') {
          mirrorTargetRef.current = null;
          mirrorFetchTargetRef.current = null;
          setMirrorTarget(null);
          questionBlocksRef.current = [];
        }
        ably.publishCommand({
          op: 'rope',
          targetId: myIdRef.current,
          value: false,
        });
        addSystemChatMessage('🪢 Kamu telah berhenti mengikuti player (Unfollow). Bebas bergerak kembali!');
        soundEngine.playBounce();
        return;
      }

      if (cmd === 'cls' || cmd === 'clear') {
        setChat([]);
        seenMsgIdsRef.current.clear();
        setUnreadCount(0);
        return;
      }

      // /set semiadmin <target> & /unset semiadmin <target>
      if ((cmd === 'set' || cmd === 'unset') && (arg1 === 'semiadmin' || arg1 === 'ketua')) {
        if (!isStaff) {
          addSystemChatMessage('Perintah Semi-Admin hanya dapat diatur oleh Guru atau Administrator.');
          return;
        }
        const targetQuery = (arg2 || parts[2])?.toLowerCase();
        if (!targetQuery) {
          addSystemChatMessage(`Format: /${cmd} semiadmin <target>`);
          return;
        }
        const target = resolveTarget(targetQuery);
        if (!target) return;
        const isTurnOn = cmd === 'set';
        const p = playersRef.current.get(target.id);
        if (p) {
          p.tag = isTurnOn ? '⭐ SEMI-ADMIN' : undefined;
          p.gun = isTurnOn ? 'ice' : null;
          p.blasterAmmo = isTurnOn ? Infinity : 0;
          p.hasAdminGun = isTurnOn;
          p.blasterUntil = undefined;
        }
        if (target.id === myIdRef.current) {
          setAmmoCount(isTurnOn ? Infinity : 0);
        }
        ably.publishCommand({ op: 'cosmetics', targetId: target.id, tag: isTurnOn ? '⭐ SEMI-ADMIN' : '' });
        ably.publishCommand({ op: 'gun', targetId: target.id, value: isTurnOn, weapon: isTurnOn ? 'ice' : 'none' });
        addSystemChatMessage(
          isTurnOn
            ? `⭐ '${target.username}' sekarang diangkat menjadi SEMI-ADMIN (Ketua Kelas) dan dibekali Ice Gun!`
            : `⭐ Status Semi-Admin '${target.username}' telah dicabut.`,
        );
        if (isTurnOn) soundEngine.playPowerUp();
        else soundEngine.playBounce();
        return;
      }

      // /set pvp <on|off> & /unset pvp
      if ((cmd === 'set' && arg1 === 'pvp') || (cmd === 'unset' && arg1 === 'pvp')) {
        if (!isStaff) {
          addSystemChatMessage('Pengaturan PvP hanya dapat diatur oleh Guru atau Administrator.');
          return;
        }
        const isTurnOn = cmd === 'set' && (arg2 === 'on' || !arg2 || arg2 === 'true');
        isStudentPvpEnabledRef.current = isTurnOn;
        setIsStudentPvpEnabled(isTurnOn);
        ably.publishCommand({ op: 'pvp_mode', value: isTurnOn });
        addSystemChatMessage(
          isTurnOn
            ? '⚔️ Mode Tawuran Siswa DIAKTIFKAN oleh Guru/Admin! Siswa sekarang bisa saling tembak/prank.'
            : '🕊️ Mode Damai DIAKTIFKAN. Tembakan antar siswa dinonaktifkan.',
        );
        if (isTurnOn) soundEngine.playPowerUp();
        else soundEngine.playBounce();
        return;
      }

      if ((cmd === 'set' || cmd === 'unset') && arg1 === 'god') {
        const isTurnOn = cmd === 'set';
        const targetQuery = (arg2 || parts[2])?.toLowerCase();
        if (!targetQuery) {
          addSystemChatMessage(`Format: /${cmd} god <user|me|here|all>`);
          return;
        }

        if (targetQuery === 'all') {
          if (!isAdmin) {
            addSystemChatMessage("Target 'all' hanya dapat digunakan oleh Administrator.");
            return;
          }
          for (const p of playersRef.current.values()) {
            p.isGodMode = isTurnOn;
          }
          isGodModeRef.current = isTurnOn;
          setIsGodMode(isTurnOn);
          ably.publishCommand({ op: 'god', targetId: 'all', value: isTurnOn });
          addSystemChatMessage(
            isTurnOn
              ? '👑 God Mode DIAKTIFKAN untuk SEMUA player di game. (Kebal & Infinite Laser)'
              : '🛡️ God Mode DINONAKTIFKAN untuk SEMUA player di game.',
          );
          if (isTurnOn) soundEngine.playPowerUp();
          else soundEngine.playBounce();
          return;
        }

        if (targetQuery === 'here') {
          if (!isAdmin) {
            addSystemChatMessage("Target 'here' hanya dapat digunakan oleh Administrator.");
            return;
          }
          const adminStage = currentStageRef.current;
          const targets: { id: string; username: string }[] = [];
          for (const p of playersRef.current.values()) {
            if ((p.stage ?? 1) === adminStage) {
              targets.push({ id: p.id, username: p.username });
            }
          }
          for (const t of targets) {
            const p = playersRef.current.get(t.id);
            if (p) p.isGodMode = isTurnOn;
            if (t.id === myIdRef.current) {
              isGodModeRef.current = isTurnOn;
              setIsGodMode(isTurnOn);
            } else {
              ably.publishCommand({ op: 'god', targetId: t.id, value: isTurnOn, targetName: t.username });
            }
          }
          addSystemChatMessage(
            isTurnOn
              ? `👑 God Mode DIAKTIFKAN untuk SEMUA player di Stage ${adminStage} (${targets.length} player).`
              : `🛡️ God Mode DINONAKTIFKAN untuk SEMUA player di Stage ${adminStage} (${targets.length} player).`,
          );
          if (isTurnOn) soundEngine.playPowerUp();
          else soundEngine.playBounce();
          return;
        }

        const target = resolveTarget(targetQuery);
        if (!target) return;
        const p = playersRef.current.get(target.id);
        if (p) p.isGodMode = isTurnOn;
        if (target.id === myIdRef.current) {
          isGodModeRef.current = isTurnOn;
          setIsGodMode(isTurnOn);
        }
        ably.publishCommand({ op: 'god', targetId: target.id, value: isTurnOn, targetName: target.username });
        addSystemChatMessage(
          isTurnOn
            ? `👑 God Mode DIAKTIFKAN untuk '${target.username}'. (Kebal & Infinite Laser)`
            : `🛡️ God Mode DINONAKTIFKAN untuk '${target.username}'.`,
        );
        if (isTurnOn) soundEngine.playPowerUp();
        else soundEngine.playBounce();
        return;
      }

      if (cmd === 'teleport') {
        const targetQuery = arg1;
        const dest = arg2;

        if (!targetQuery) {
          addSystemChatMessage('Format: /teleport <username>, /teleport <user|here|all> [me|<stage>]');
          return;
        }

        if (targetQuery === 'here') {
          if (!isAdmin) {
            addSystemChatMessage('Perintah /teleport here hanya dapat digunakan oleh Administrator.');
            return;
          }
          const adminStage = currentStageRef.current;
          const targets: { id: string; username: string }[] = [];
          for (const p of playersRef.current.values()) {
            if (p.id === myIdRef.current) continue;
            if ((p.stage ?? 1) === adminStage) {
              targets.push({ id: p.id, username: p.username });
            }
          }
          if (targets.length === 0) {
            addSystemChatMessage(`Tidak ada player lain di Stage ${adminStage}.`);
            return;
          }
          if (!dest || dest === 'me') {
            const me = playersRef.current.get(myIdRef.current);
            for (const t of targets) {
              ably.publishCommand({
                op: 'teleport',
                targetId: t.id,
                stage: adminStage,
                x: me?.x ?? 120,
                y: me?.y ?? 600,
              });
            }
            addSystemChatMessage(`🌀 Berhasil teleport SEMUA player di Stage ${adminStage} (${targets.length} player) ke posisimu.`);
          } else {
            const parsed = parseStageInput(dest, totalStagesRef.current, selectedStagesRef.current);
            if (parsed) {
              for (const t of targets) {
                ably.publishCommand({ op: 'teleport', targetId: t.id, stage: parsed.stageOrder });
              }
              addSystemChatMessage(`🌀 Berhasil teleport SEMUA player di Stage ${adminStage} (${targets.length} player) ke Stage ${parsed.realStageId} (${getStageShortName(parsed.realStageId)}).`);
            } else {
              const choices = selectedStagesRef.current.map((s, i) => `${i + 1} (S${s})`).join(', ');
              addSystemChatMessage(`Nomor stage tidak valid (Pilihan urutan 1-${totalStagesRef.current} atau ID: ${choices}).`);
            }
          }
          soundEngine.playBounce();
          return;
        }

        if (targetQuery === 'all') {
          if (!isAdmin) {
            addSystemChatMessage('Perintah /teleport all hanya dapat digunakan oleh Administrator.');
            return;
          }
          if (dest === 'me' || dest === 'here' || !dest) {
            const me = playersRef.current.get(myIdRef.current);
            ably.publishCommand({
              op: 'teleport',
              targetId: 'all',
              stage: currentStageRef.current,
              x: me?.x ?? 120,
              y: me?.y ?? 600,
            });
            addSystemChatMessage(`Berhasil teleport SELURUH siswa ke posisimu di Stage ${currentStageRef.current}.`);
          } else {
            const parsed = parseStageInput(dest, totalStagesRef.current, selectedStagesRef.current);
            if (parsed) {
              ably.publishCommand({ op: 'teleport', targetId: 'all', stage: parsed.stageOrder });
              addSystemChatMessage(`Berhasil teleport SELURUH siswa ke Stage ${parsed.realStageId} (${getStageShortName(parsed.realStageId)}).`);
            } else {
              const choices = selectedStagesRef.current.map((s, i) => `${i + 1} (S${s})`).join(', ');
              addSystemChatMessage(`Nomor stage tidak valid (Pilihan urutan 1-${totalStagesRef.current} atau ID: ${choices}).`);
            }
          }
          soundEngine.playBounce();
          return;
        }

        // /teleport <username> : admin nyamperin player tersebut (ganti stage + posisi persis)
        if (!dest) {
          if (!isAdmin) {
            addSystemChatMessage('Perintah /teleport hanya dapat digunakan oleh Administrator.');
            return;
          }
          const target = resolveTarget(targetQuery);
          if (!target) return;
          const me = playersRef.current.get(myIdRef.current);
          if (!me) {
            addSystemChatMessage('Karaktermu belum siap, coba lagi.');
            return;
          }
          const targetLive = playersRef.current.get(target.id);
          const targetStage =
            typeof targetLive?.stage === 'number' && targetLive.stage >= 1
              ? targetLive.stage
              : currentStageRef.current;
          const targetX = targetLive?.x ?? 120;
          const targetY = targetLive?.y ?? 600;
          if (targetStage !== currentStageRef.current) {
            applyStage(targetStage, { respawnPlayer: true, showToast: true });
          }
          me.x = targetX;
          me.y = targetY;
          me.vx = 0;
          me.vy = 0;
          me.stage = targetStage;
          soundEngine.playBounce();
          const realTargetStageId = selectedStagesRef.current[targetStage - 1] ?? targetStage;
          showBanner(`🌀 Teleport ke '${target.username}' (Stage ${realTargetStageId}: ${getStageShortName(realTargetStageId)}).`);
          addSystemChatMessage(`Berhasil teleport ke '${target.username}' di Stage ${realTargetStageId} (${getStageShortName(realTargetStageId)}).`);
          return;
        }

        const target = resolveTarget(targetQuery);
        if (!target) return;

        if (dest === 'me') {
          const me = playersRef.current.get(myIdRef.current);
          ably.publishCommand({
            op: 'teleport',
            targetId: target.id,
            stage: currentStageRef.current,
            x: me?.x ?? 120,
            y: me?.y ?? 600,
          });
          addSystemChatMessage(`Berhasil teleport '${target.username}' ke posisimu.`);
        } else {
          const parsed = parseStageInput(dest, totalStagesRef.current, selectedStagesRef.current);
          if (parsed) {
            if (target.id === myIdRef.current) {
              applyStage(parsed.stageOrder, { respawnPlayer: true, showToast: true });
            } else {
              ably.publishCommand({ op: 'teleport', targetId: target.id, stage: parsed.stageOrder });
            }
            addSystemChatMessage(`Berhasil teleport '${target.username}' ke Stage ${parsed.realStageId} (${getStageShortName(parsed.realStageId)}).`);
          } else {
            const choices = selectedStagesRef.current.map((s, i) => `${i + 1} (S${s})`).join(', ');
            addSystemChatMessage(`Nomor stage tidak valid (Pilihan urutan 1-${totalStagesRef.current} atau ID: ${choices}).`);
          }
        }
        soundEngine.playBounce();
        return;
      }

      if ((cmd === 'take' || cmd === 'untake') && arg1 === 'rope') {
        if (!isAdmin) {
          addSystemChatMessage('Perintah rope hanya dapat digunakan oleh Administrator.');
          return;
        }
        const wantRope = cmd === 'take';
        const targetQuery = arg2;
        if (!targetQuery) {
          addSystemChatMessage(`Format: /${cmd} rope <username|here|all>`);
          return;
        }
        const me = playersRef.current.get(myIdRef.current);
        if (!me) {
          addSystemChatMessage('Karaktermu belum siap, coba lagi.');
          return;
        }
        const adminStage = currentStageRef.current;
        const targets: { id: string; username: string }[] = [];
        if (targetQuery === 'all') {
          for (const p of playersRef.current.values()) {
            if (p.id === myIdRef.current) continue;
            targets.push({ id: p.id, username: p.username });
          }
          if (wantRope && targets.length === 0) {
            addSystemChatMessage('Tidak ada player untuk diikat.');
            return;
          }
        } else if (targetQuery === 'here') {
          for (const p of playersRef.current.values()) {
            if (p.id === myIdRef.current) continue;
            if ((p.stage ?? 1) === adminStage) {
              targets.push({ id: p.id, username: p.username });
            }
          }
          if (targets.length === 0) {
            addSystemChatMessage(`Tidak ada player lain di Stage ${adminStage}.`);
            return;
          }
        } else {
          const target = resolveTarget(targetQuery);
          if (!target) return;
          if (target.id === myIdRef.current) {
            addSystemChatMessage('Tidak bisa mengikat diri sendiri. 🪢');
            return;
          }
          targets.push(target);
        }
        if (!wantRope && targetQuery === 'all') {
          // Paksa lepas SEMUA tali di semua client sekaligus (broadcast rope_all_clear).
          // Ini menormalkan player yang mungkin sudah pergi / rejoin / pindah stage.
          ably.publishCommand({ op: 'rope_all_clear' });
          for (const p of playersRef.current.values()) {
            p.ropedById = null;
            p.adminAnchor = undefined;
            p.adminFacing = undefined;
          }
          meAdminAnchorRef.current = null;
          addSystemChatMessage('🪢 Semua tali dilepas, semua player dinormalkan.');
          soundEngine.playBounce();
          return;
        }
        for (const t of targets) {
          const p = playersRef.current.get(t.id);
          if (p) {
            p.ropedById = wantRope ? myIdRef.current : null;
            if (!wantRope) {
              p.adminAnchor = undefined;
              p.adminFacing = undefined;
            }
          }
          ably.publishCommand({
            op: 'rope',
            targetId: t.id,
            value: wantRope,
            byId: myIdRef.current,
            byName: myUsernameRef.current || 'Admin',
          });
        }
        const names = targetQuery === 'here'
          ? `SEMUA player di Stage ${adminStage} (${targets.length} player)`
          : targetQuery === 'all'
            ? `SEMUA player di game (${targets.length} player)`
            : `'${targets.map((t) => t.username).join(', ')}'`;
        addSystemChatMessage(
          wantRope
            ? `🪢 Mengikat ${names} dengan tali. Mereka akan mengikutimu & kebal rintangan.`
            : `🪢 Melepas tali ${names}.`,
        );
        if (wantRope) soundEngine.playPowerUp();
        else soundEngine.playBounce();
        return;
      }

      if (cmd === 'skip') {
        if (!isAdmin) {
          addSystemChatMessage('Perintah /skip stage hanya dapat digunakan oleh Administrator.');
          return;
        }
        if (arg1 !== 'stage' || !arg2) {
          addSystemChatMessage('Perintah tidak lengkap. Format:');
          addSystemChatMessage('• /skip stage <username|here|all|rope> : Tandai soal tersisa selesai (here = stagemu, all = se-game, rope = diikat tali).');
          return;
        }
        const targetQuery = arg2?.toLowerCase();

        // /skip stage rope: bypass SEMUA player yang sedang diikat tali oleh admin
        if (targetQuery === 'rope') {
          const targets: { id: string; username: string; stage: number }[] = [];
          for (const p of playersRef.current.values()) {
            if (p.id === myIdRef.current) continue;
            if (p.ropedById !== myIdRef.current) continue;
            targets.push({ id: p.id, username: p.username, stage: p.stage ?? 1 });
          }
          if (targets.length === 0) {
            addSystemChatMessage('Tidak ada player yang sedang diikat tali. 🪢');
            return;
          }
          try {
            let totalMarked = 0;
            for (const t of targets) {
              const stageQs = getStageQuestions(levelQuestionsRef.current, t.stage, totalStagesRef.current);
              if (stageQs.length === 0) continue;
              const res = await fetch('/api/game/room-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId, targetId: t.id }),
              });
              const data = await res.json();
              const serverSet = new Set<string>(Array.isArray(data?.answeredQuestionIds) ? data.answeredQuestionIds : []);
              const unanswered = stageQs.filter((q) => !serverSet.has(q.id));
              if (unanswered.length === 0) continue;
              const qids = unanswered.map((q) => q.id);
              await fetch('/api/game/skip-stage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId, targetId: t.id, stage: t.stage, questionIds: qids }),
              });
              ably.publishCommand({ op: 'skip_stage', targetId: t.id, qids, stage: t.stage });
              totalMarked += qids.length;
            }
            addSystemChatMessage(`⏭️ Skip stage rope (${targets.length} player diikat): ${totalMarked} soal ditandai selesai (tanpa poin).`);
            soundEngine.playPowerUp();
          } catch {
            addSystemChatMessage('Gagal skip stage rope, coba lagi.');
          }
          return;
        }

        // /skip stage here: bypass SEMUA player yang ada di stage yang sama dengan admin
        if (targetQuery === 'here') {
          const adminStage = currentStageRef.current;
          const stageQs = getStageQuestions(levelQuestionsRef.current, adminStage, totalStagesRef.current);
          if (stageQs.length === 0) {
            addSystemChatMessage(`Tidak ada soal di stage ${adminStage}.`);
            return;
          }
          const targets: { id: string; username: string }[] = [];
          for (const p of playersRef.current.values()) {
            if (p.id === myIdRef.current) continue;
            if ((p.stage ?? 1) !== adminStage) continue;
            targets.push({ id: p.id, username: p.username });
          }
          if (targets.length === 0) {
            addSystemChatMessage(`Tidak ada player lain di Stage ${adminStage}.`);
            return;
          }
          try {
            let totalMarked = 0;
            for (const t of targets) {
              const res = await fetch('/api/game/room-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId, targetId: t.id }),
              });
              const data = await res.json();
              const serverSet = new Set<string>(Array.isArray(data?.answeredQuestionIds) ? data.answeredQuestionIds : []);
              const unanswered = stageQs.filter((q) => !serverSet.has(q.id));
              if (unanswered.length === 0) continue;
              const qids = unanswered.map((q) => q.id);
              await fetch('/api/game/skip-stage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId, targetId: t.id, stage: adminStage, questionIds: qids }),
              });
              ably.publishCommand({ op: 'skip_stage', targetId: t.id, qids, stage: adminStage });
              totalMarked += qids.length;
            }
            addSystemChatMessage(`⏭️ Skip stage here (${targets.length} player di Stage ${adminStage}): ${totalMarked} soal ditandai selesai (tanpa poin).`);
            soundEngine.playPowerUp();
          } catch {
            addSystemChatMessage('Gagal skip stage here, coba lagi.');
          }
          return;
        }

        // /skip stage all: bypass SEMUA player di seluruh game
        if (targetQuery === 'all') {
          const targets: { id: string; username: string; stage: number }[] = [];
          for (const p of playersRef.current.values()) {
            if (p.id === myIdRef.current) continue;
            targets.push({ id: p.id, username: p.username, stage: p.stage ?? 1 });
          }
          if (targets.length === 0) {
            addSystemChatMessage('Tidak ada player lain di game.');
            return;
          }
          try {
            let totalMarked = 0;
            for (const t of targets) {
              const stageQs = getStageQuestions(levelQuestionsRef.current, t.stage, totalStagesRef.current);
              if (stageQs.length === 0) continue;
              const res = await fetch('/api/game/room-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId, targetId: t.id }),
              });
              const data = await res.json();
              const serverSet = new Set<string>(Array.isArray(data?.answeredQuestionIds) ? data.answeredQuestionIds : []);
              const unanswered = stageQs.filter((q) => !serverSet.has(q.id));
              if (unanswered.length === 0) continue;
              const qids = unanswered.map((q) => q.id);
              await fetch('/api/game/skip-stage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId, targetId: t.id, stage: t.stage, questionIds: qids }),
              });
              ably.publishCommand({ op: 'skip_stage', targetId: t.id, qids, stage: t.stage });
              totalMarked += qids.length;
            }
            addSystemChatMessage(`⏭️ Skip stage all (${targets.length} player di seluruh game): ${totalMarked} soal ditandai selesai (tanpa poin).`);
            soundEngine.playPowerUp();
          } catch {
            addSystemChatMessage('Gagal skip stage all, coba lagi.');
          }
          return;
        }
        const target = resolveTarget(targetQuery);
        if (!target) return;
        if (target.id === myIdRef.current) {
          addSystemChatMessage('Tidak bisa skip stage diri sendiri.');
          return;
        }
        const targetStage = playersRef.current.get(target.id)?.stage ?? currentStageRef.current;
        const stageQs = getStageQuestions(levelQuestionsRef.current, targetStage, totalStagesRef.current);
        if (stageQs.length === 0) {
          addSystemChatMessage(`Tidak ada soal di stage ${targetStage}.`);
          return;
        }
        try {
          const res = await fetch('/api/game/room-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, targetId: target.id }),
          });
          const data = await res.json();
          const serverSet = new Set<string>(Array.isArray(data?.answeredQuestionIds) ? data.answeredQuestionIds : []);
          const unanswered = stageQs.filter((q) => !serverSet.has(q.id));
          if (unanswered.length === 0) {
            addSystemChatMessage(`Semua soal '${target.username}' di stage ${targetStage} sudah terjawab.`);
            return;
          }
          const qids = unanswered.map((q) => q.id);
          await fetch('/api/game/skip-stage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, targetId: target.id, stage: targetStage, questionIds: qids }),
          });
          ably.publishCommand({ op: 'skip_stage', targetId: target.id, qids, stage: targetStage });
          addSystemChatMessage(`⏭️ Skip stage untuk '${target.username}': ${unanswered.length} soal ditandai selesai (tanpa poin). Gerbang terbuka, lanjut ke stage berikutnya!`);
          soundEngine.playPowerUp();
        } catch {
          addSystemChatMessage('Gagal skip stage, coba lagi.');
        }
        return;
      }

      if (cmd === 'reset' && arg1 === 'item') {
        if (!isStaff) {
          addSystemChatMessage('Perintah reset item hanya dapat dijalankan oleh Guru atau Admin.');
          return;
        }
        const itemType = (arg2 || 'all').toLowerCase();
        const targetQuery = parts[3] ? parts[3].toLowerCase() : (arg2 === 'body' || arg2 === 'tag' || arg2 === 'all' ? 'all' : arg2);
        if (!['body', 'tag', 'color', 'all'].includes(itemType)) {
          addSystemChatMessage('Format: /reset item <body|tag|color|all> <username|all>');
          return;
        }
        fetch('/api/game/shop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reset_items',
            itemType,
            target: targetQuery,
            roomId,
          }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.ok) {
              addSystemChatMessage(`🔄 ${d.message}`);
              soundEngine.playPowerUp();
            } else {
              addSystemChatMessage(`❌ Gagal reset item: ${d.error || 'Terjadi kesalahan'}`);
            }
          })
          .catch(() => addSystemChatMessage('❌ Gagal menghubungi server shop.'));
        return;
      }

      if (cmd === 'reset') {
        const targetQuery = arg1;
        if (!targetQuery) {
          addSystemChatMessage('Format salah. Contoh: /reset bims atau /reset all');
          return;
        }
        if (targetQuery === 'all') {
          if (!isAdmin) {
            addSystemChatMessage('Perintah /reset all hanya dapat digunakan oleh Administrator.');
            return;
          }
          fetch('/api/game/reset-progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, targetId: 'all' }),
          }).catch(() => { });
          ably.publishCommand({ op: 'reset', targetId: 'all' });
          if (mirrorTargetRef.current) {
            answerResultsRef.current.clear();
            const curStg = currentStageRef.current;
            const stageQs = getStageQuestions(levelQuestionsRef.current, curStg, totalStagesRef.current);
            questionBlocksRef.current = generateQuestionBlocks(
              stageQs.map((q) => q.id),
              `all:${roomId}:s${curStg}`,
              curStg,
            );
          }
          addSystemChatMessage('Berhasil me-reset jawaban seluruh siswa ke Stage 1.');
          soundEngine.playDeath();
          return;
        }
        const target = resolveTarget(targetQuery);
        if (!target) return;
        fetch('/api/game/reset-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, targetId: target.id }),
        }).catch(() => { });
        ably.publishCommand({ op: 'reset', targetId: target.id });
        const curMirror = mirrorTargetRef.current;
        if (curMirror && (curMirror === 'all' || curMirror.userId === target.id)) {
          answerResultsRef.current.clear();
          const curStg = currentStageRef.current;
          const stageQs = getStageQuestions(levelQuestionsRef.current, curStg, totalStagesRef.current);
          questionBlocksRef.current = generateQuestionBlocks(
            stageQs.map((q) => q.id),
            `${target.id}:${roomId}:s${curStg}`,
            curStg,
          );
        }
        addSystemChatMessage(`Berhasil me-reset jawaban '${target.username}' ke Stage 1.`);
        soundEngine.playDeath();
        return;
      }

      if (cmd === 'mirror') {
        const targetQuery = arg1;
        if (!targetQuery) {
          addSystemChatMessage('Format: /mirror <username> atau /mirror all');
          return;
        }
        if (targetQuery === 'all') {
          mirrorTargetRef.current = 'all';
          mirrorFetchTargetRef.current = null;
          answerResultsRef.current.clear();
          setMirrorTarget('Seluruh Kelas (Bonus)');
          const curStg = currentStageRef.current;
          const curStageQs = getStageQuestions(levelQuestionsRef.current, curStg, totalStagesRef.current);
          questionBlocksRef.current = generateQuestionBlocks(
            curStageQs.map((q) => q.id),
            `all:${roomId}:s${curStg}`,
            curStg,
          );
          addSystemChatMessage('🔍 Mode Mirror ALL aktif! Kotak soal bonus sekelas dimunculkan di map.');
          soundEngine.playPowerUp();
          return;
        }

        const target = resolveTarget(targetQuery);
        if (!target) return;

        mirrorTargetRef.current = { userId: target.id, username: target.username };
        mirrorFetchTargetRef.current = target.id;
        setMirrorTarget(target.username);
        const curStg = currentStageRef.current;
        const curStageQs = getStageQuestions(levelQuestionsRef.current, curStg, totalStagesRef.current);
        questionBlocksRef.current = generateQuestionBlocks(
          curStageQs.map((q) => q.id),
          `${target.id}:${roomId}:s${curStg}`,
          curStg,
        );
        // Ambil status jawaban asli siswa ini: hijau = benar, merah = salah, biru = dibantuin, kuning = belum
        answerResultsRef.current.clear();
        fetch('/api/game/room-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, targetId: target.id }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (!d) return;
            const results = (d.answerResults ?? {}) as Record<string, boolean | 'assisted'>;
            for (const [qid, okAns] of Object.entries(results)) {
              answerResultsRef.current.set(qid, okAns === 'assisted' ? 'assisted' : Boolean(okAns));
            }
            if (d.chosenAnswers) {
              for (const [qid, ans] of Object.entries(d.chosenAnswers)) {
                studentChosenAnswersRef.current.set(qid, String(ans));
              }
              setStudentChosenAnswers(new Map(studentChosenAnswersRef.current));
            }
          })
          .catch(() => { });
        addSystemChatMessage(`🔍 Mode Mirroring '${target.username}' aktif! Kotak soal siswa dimunculkan di map.`);
        soundEngine.playPowerUp();
        return;
      }

      if (cmd === 'unset' && arg1 === 'mirror') {
        mirrorTargetRef.current = null;
        mirrorFetchTargetRef.current = null;
        setMirrorTarget(null);
        questionBlocksRef.current = [];
        addSystemChatMessage('Mode Mirror dimatikan. Kotak soal disembunyikan kembali dari pandangan.');
        soundEngine.playBounce();
        return;
      }

      if (cmd === 'set' && arg1 === 'nick') {
        // Format: /set nick <user|me> <nama baru>
        if (!isStaff && !isStudentCmdAllowed(myIdRef.current)) {
          addSystemChatMessage('Perintah ini hanya untuk Administrator, Guru, atau siswa yang diizinkan.');
          return;
        }
        const targetQuery = arg2 || 'me';
        const newName = parts.slice(3).join(' ').trim();
        const target = resolveTarget(targetQuery);
        if (!target) return;
        if (!newName) {
          addSystemChatMessage('Format: /set nick <user|me> <nama baru>');
          return;
        }
        const nickValue = newName.slice(0, 24);
        // Persist ke DB ke kolom custom_nick
        fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set-nick', targetId: target.id, nick: nickValue }),
        }).catch(() => { });
        ably.publishCommand({ op: 'change_nick', targetId: target.id, value: nickValue });
        const pTarget = playersRef.current.get(target.id);
        if (pTarget) {
          if (!pTarget.originalFullName) pTarget.originalFullName = pTarget.fullName || pTarget.username;
          pTarget.customNick = nickValue;
          pTarget.fullName = nickValue;
        }
        if (target.id === myIdRef.current) {
          myUsernameRef.current = nickValue;
          myFullNameRef.current = nickValue;
          try { window.localStorage.setItem('llys_custom_nick', nickValue); } catch { }
        }
        addSystemChatMessage(`🏷️ Nickname '${target.username}' diganti jadi "${nickValue}" (tersimpan permanen).`);
        soundEngine.playPowerUp();
        return;
      }

      if (cmd === 'unset' && arg1 === 'nick') {
        // Format: /unset nick <user|me>
        if (!isStaff && !isStudentCmdAllowed(myIdRef.current)) {
          addSystemChatMessage('Perintah ini hanya untuk Administrator, Guru, atau siswa yang diizinkan.');
          return;
        }
        const targetQuery = arg2 || 'me';
        const target = resolveTarget(targetQuery) as { id: string; username: string; fullName?: string | null } | null;
        if (!target) return;
        const targetP = playersRef.current.get(target.id);
        const originalName = (targetP?.originalFullName || target.fullName || target.username).trim().slice(0, 24);
        fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set-nick', targetId: target.id, nick: null }),
        }).catch(() => { });
        ably.publishCommand({ op: 'change_nick', targetId: target.id, value: '' });
        if (targetP) {
          targetP.customNick = undefined;
          targetP.fullName = originalName;
        }
        if (target.id === myIdRef.current) {
          myUsernameRef.current = originalName;
          myFullNameRef.current = originalName;
          try { window.localStorage.removeItem('llys_custom_nick'); } catch { }
        }
        addSystemChatMessage(`🏷️ Nickname '${target.username}' dikembalikan ke nama asli "${originalName}".`);
        soundEngine.playBounce();
        return;
      }

      if (cmd === 'set' && arg1 === 'shop') {
        if (!isStaff) {
          addSystemChatMessage('Perintah /set shop hanya dapat dijalankan oleh Guru atau Admin.');
          return;
        }
        if (arg2 === 'tag') {
          const price = parseInt(parts[3]);
          if (!Number.isFinite(price) || price < 0) {
            addSystemChatMessage('Format: /set shop tag <harga_poin> (contoh: /set shop tag 5000)');
            return;
          }
          fetch('/api/game/shop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_price', category: 'tag', price, roomId }),
          })
            .then((r) => r.json())
            .then((d) => {
              if (d.ok) {
                setShopPrices(d.prices);
                shopPricesRef.current = d.prices;
                addSystemChatMessage(`🏷️ Harga ganti Tag 1 berhasil diatur menjadi 💰 ${price.toLocaleString()} Poin!`);
                soundEngine.playPowerUp();
              }
            });
          return;
        }
        if (arg2 === 'body') {
          const item = parts[3];
          const price = parseInt(parts[4]);
          if (!item || !Number.isFinite(price) || price < 0) {
            addSystemChatMessage('Format: /set shop body <item1..item6|ulat|burung|ayam|sapi|domba|virus> <harga_poin>');
            addSystemChatMessage('Contoh: /set shop body item1 5000  atau  /set shop body ulat 5000');
            return;
          }
          fetch('/api/game/shop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_price', category: 'body', item, price, roomId }),
          })
            .then((r) => r.json())
            .then((d) => {
              if (d.ok) {
                setShopPrices(d.prices);
                shopPricesRef.current = d.prices;
                addSystemChatMessage(`🎭 Harga karakter [${item.toUpperCase()}] berhasil diatur menjadi 💰 ${price.toLocaleString()} Poin!`);
                soundEngine.playPowerUp();
              }
            });
          return;
        }
        if (arg2 === 'color') {
          const item = (parts[3] || '').toLowerCase();
          const mode = (parts[4] || '').toLowerCase();
          const price = parseInt(parts[5]);
          if (!['body', 'tag1', 'nick'].includes(item) || !['static', 'rgb'].includes(mode) || !Number.isFinite(price) || price < 0) {
            addSystemChatMessage('Format: /set shop color <body|tag1|nick> <static|rgb> <harga_poin>');
            addSystemChatMessage('Contoh: /set shop color body rgb 5000  atau  /set shop color nick static 2000');
            return;
          }
          fetch('/api/game/shop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_price', category: 'color', item, mode, price, roomId }),
          })
            .then((r) => r.json())
            .then((d) => {
              if (d.ok) {
                setShopPrices(d.prices);
                shopPricesRef.current = d.prices;
                addSystemChatMessage(`🎨 Harga warna [${item.toUpperCase()} ${mode.toUpperCase()}] berhasil diatur menjadi 💰 ${price.toLocaleString()} Poin!`);
                soundEngine.playPowerUp();
              }
            });
          return;
        }
        if (arg2 === 'list' || !arg2) {
          addSystemChatMessage(`🛍️ DAFTAR HARGA TOKO: Tag 1: 💰 ${shopPrices.tag.toLocaleString()} Pts | Karakter: 💰 5,000 Pts | Warna RGB: 💰 5,000 Pts | Warna Statis: 💰 1,000 Pts`);
          return;
        }
      }

      if (cmd === 'shop') {
        if (arg1 === 'prices' || arg1 === 'list') {
          addSystemChatMessage(`🛍️ DAFTAR HARGA TOKO: Tag 1: 💰 ${shopPrices.tag.toLocaleString()} Pts | Karakter: 💰 5,000 Pts | Warna RGB: 💰 5,000 Pts | Warna Statis: 💰 1,000 Pts`);
        } else {
          setShowShopModal(true);
        }
        return;
      }

      if (cmd === 'set' && arg1 === 'tag') {
        // Format: /set tag <1|2|3> <user|me> <title>
        if (!isStaff && !isStudentCmdAllowed(myIdRef.current)) {
          addSystemChatMessage('Perintah ini hanya untuk Administrator, Guru, atau siswa yang diizinkan.');
          return;
        }
        const posStr = parts[2];
        if (!posStr || !['1', '2', '3'].includes(posStr)) {
          addSystemChatMessage('Format: /set tag <1|2|3> <user|me> <title>');
          addSystemChatMessage('Posisi tag: 1 = Bawah (tepat diatas nick), 2 = Tengah, 3 = Atas');
          return;
        }
        const targetQuery = parts[3] || 'me';
        const title = parts.slice(4).join(' ').trim();
        const target = resolveTarget(targetQuery);
        if (!target) return;
        if (!title) {
          addSystemChatMessage(`Format: /set tag ${posStr} <user|me> <title>`);
          return;
        }
        const tagValue = title.slice(0, 24);
        const p = playersRef.current.get(target.id);
        if (p) {
          if (posStr === '1') { p.tag1 = tagValue; p.tag = tagValue; }
          else if (posStr === '2') { p.tag2 = tagValue; }
          else if (posStr === '3') { p.tag3 = tagValue; }
        }
        if (target.id === myIdRef.current) {
          try {
            if (posStr === '1') window.localStorage.setItem('llys_custom_tag1', tagValue);
            else if (posStr === '2') window.localStorage.setItem('llys_custom_tag2', tagValue);
            else if (posStr === '3') window.localStorage.setItem('llys_custom_tag3', tagValue);
          } catch { }
        }
        // Persist ke DB
        fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set-tag', targetId: target.id, position: posStr, tag: tagValue }),
        }).catch(() => { });
        ably.publishCommand({
          op: 'cosmetics',
          targetId: target.id,
          tag1: p?.tag1,
          tag2: p?.tag2,
          tag3: p?.tag3,
        });
        addSystemChatMessage(`🏷️ Tag level ${posStr} '${target.username}' diatur jadi "${tagValue}" (tersimpan permanen).`);
        soundEngine.playPowerUp();
        return;
      }

      if (cmd === 'unset' && arg1 === 'tag') {
        // Format: /unset tag <1|2|3|all> <user|me>
        if (!isStaff && !isStudentCmdAllowed(myIdRef.current)) {
          addSystemChatMessage('Perintah ini hanya untuk Administrator, Guru, atau siswa yang diizinkan.');
          return;
        }
        const posStr = parts[2]?.toLowerCase();
        if (!posStr || !['1', '2', '3', 'all'].includes(posStr)) {
          addSystemChatMessage('Format: /unset tag <1|2|3|all> <user|me>');
          return;
        }
        const targetQuery = parts[3] || 'me';
        const target = resolveTarget(targetQuery);
        if (!target) return;
        const p = playersRef.current.get(target.id);
        if (p) {
          if (posStr === 'all') {
            p.tag = undefined;
            p.tag1 = undefined;
            p.tag2 = undefined;
            p.tag3 = undefined;
          } else if (posStr === '1') {
            p.tag1 = undefined;
            p.tag = undefined;
          } else if (posStr === '2') {
            p.tag2 = undefined;
          } else if (posStr === '3') {
            p.tag3 = undefined;
          }
        }
        if (target.id === myIdRef.current) {
          try {
            if (posStr === 'all') {
              window.localStorage.removeItem('llys_custom_tag1');
              window.localStorage.removeItem('llys_custom_tag2');
              window.localStorage.removeItem('llys_custom_tag3');
            } else {
              window.localStorage.removeItem(`llys_custom_tag${posStr}`);
            }
          } catch { }
        }
        fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set-tag', targetId: target.id, position: posStr, tag: null }),
        }).catch(() => { });
        ably.publishCommand({
          op: 'cosmetics',
          targetId: target.id,
          tag1: p?.tag1,
          tag2: p?.tag2,
          tag3: p?.tag3,
        });
        addSystemChatMessage(posStr === 'all' ? `🏷️ Semua tag '${target.username}' dihapus.` : `🏷️ Tag ${posStr} '${target.username}' dihapus.`);
        soundEngine.playBounce();
        return;
      }

      if (cmd === 'spawn' && arg1 === 'gun') {
        if (!isStaff && !isStudentCmdAllowed(myIdRef.current)) {
          addSystemChatMessage('Perintah ini hanya untuk Administrator, Guru, atau siswa yang di-enable Admin/Guru.');
          return;
        }
        const weaponArg = parts[2]?.toLowerCase();
        const weaponType = parseWeaponType(parts[2]);
        const targetQuery = parts[3]?.toLowerCase() || 'me';
        const isUnset = !weaponType && weaponArg && ['none', 'off', 'unset'].includes(weaponArg);

        if (!weaponType && !isUnset) {
          addSystemChatMessage('Format: /spawn gun <minigun|laser|megalaser|ice|stunt|none> [user|me|here|all]');
          return;
        }

        if (targetQuery === 'all') {
          if (!isAdmin) {
            addSystemChatMessage("Target 'all' hanya dapat digunakan oleh Administrator.");
            return;
          }
          if (isUnset) {
            setAmmoCount(0);
            for (const p of playersRef.current.values()) {
              p.gun = null;
              p.blasterAmmo = 0;
              p.hasAdminGun = false;
              p.blasterUntil = undefined;
            }
            ably.publishCommand({ op: 'gun', targetId: 'all', value: false });
            addSystemChatMessage('🔫 Senjata SEMUA player di game dicabut.');
            soundEngine.playBounce();
            return;
          }
          if (weaponType) {
            const spec = WEAPONS[weaponType];
            setAmmoCount(Infinity);
            for (const p of playersRef.current.values()) {
              p.gun = weaponType;
              p.blasterAmmo = Infinity;
              p.hasAdminGun = true;
              p.blasterUntil = undefined;
            }
            ably.publishCommand({ op: 'gun', targetId: 'all', value: true, weapon: weaponType });
            addSystemChatMessage(`🔫 ${spec.label} diberikan ke SEMUA player di game (peluru unlimited).`);
            soundEngine.playPowerUp();
            return;
          }
        }

        if (targetQuery === 'here') {
          if (!isAdmin) {
            addSystemChatMessage("Target 'here' hanya dapat digunakan oleh Administrator.");
            return;
          }
          const adminStage = currentStageRef.current;
          const targets: { id: string; username: string }[] = [];
          for (const p of playersRef.current.values()) {
            if ((p.stage ?? 1) === adminStage) {
              targets.push({ id: p.id, username: p.username });
            }
          }
          if (isUnset) {
            for (const t of targets) {
              const p = playersRef.current.get(t.id);
              if (p) {
                p.gun = null;
                p.blasterAmmo = 0;
                p.hasAdminGun = false;
                p.blasterUntil = undefined;
              }
              if (t.id === myIdRef.current) setAmmoCount(0);
              else ably.publishCommand({ op: 'gun', targetId: t.id, value: false });
            }
            addSystemChatMessage(`🔫 Senjata SEMUA player di Stage ${adminStage} dicabut (${targets.length} player).`);
            soundEngine.playBounce();
            return;
          }
          if (weaponType) {
            const spec = WEAPONS[weaponType];
            for (const t of targets) {
              const p = playersRef.current.get(t.id);
              if (p) {
                p.gun = weaponType;
                p.blasterAmmo = Infinity;
                p.hasAdminGun = true;
                p.blasterUntil = undefined;
              }
              if (t.id === myIdRef.current) setAmmoCount(Infinity);
              else ably.publishCommand({ op: 'gun', targetId: t.id, value: true, weapon: weaponType });
            }
            addSystemChatMessage(`🔫 ${spec.label} diberikan ke SEMUA player di Stage ${adminStage} (${targets.length} player, peluru unlimited).`);
            soundEngine.playPowerUp();
            return;
          }
        }

        // Single target
        if (isUnset) {
          const target = resolveTarget(targetQuery);
          if (!target) return;
          const p = playersRef.current.get(target.id);
          if (p) {
            p.gun = null;
            p.blasterAmmo = 0;
            p.hasAdminGun = false;
            p.blasterUntil = undefined;
          }
          if (target.id === myIdRef.current) setAmmoCount(0);
          ably.publishCommand({ op: 'gun', targetId: target.id, value: false });
          addSystemChatMessage(`🔫 Senjata '${target.username}' dicabut.`);
          soundEngine.playBounce();
          return;
        }

        if (weaponType) {
          const spec = WEAPONS[weaponType];
          const target = resolveTarget(targetQuery);
          if (!target) return;
          const p = playersRef.current.get(target.id);
          if (p) {
            p.gun = weaponType;
            p.blasterAmmo = Infinity;
            p.hasAdminGun = true;
            p.blasterUntil = undefined;
          }
          if (target.id === myIdRef.current) setAmmoCount(Infinity);
          ably.publishCommand({ op: 'gun', targetId: target.id, value: true, weapon: weaponType });
          addSystemChatMessage(`🔫 ${spec.label} diberikan ke '${target.username}' (peluru unlimited).`);
          soundEngine.playPowerUp();
          return;
        }
      }

      if (cmd === 'jail') {
        if (!isStaff && !isStudentCmdAllowed(myIdRef.current)) {
          addSystemChatMessage('Perintah ini hanya untuk Administrator, Guru, atau siswa yang di-enable Admin/Guru.');
          return;
        }
        const turnOn = arg1 !== 'off';
        if (arg1 !== 'on' && arg1 !== 'off') {
          addSystemChatMessage('Format: /jail on [user|me] atau /jail off [user|me]');
          return;
        }
        const targetQuery = parts[3]?.toLowerCase() || parts[2]?.toLowerCase() || 'me';
        const target = resolveTarget(targetQuery);
        if (!target) return;
        const p = playersRef.current.get(target.id);
        if (p) p.jailedUntil = turnOn ? Date.now() + JAIL_FREEZE_MS : undefined;
        ably.publishCommand({ op: 'jail', targetId: target.id, value: turnOn });
        addSystemChatMessage(turnOn ? `⛓️ '${target.username}' dibekukan selama 15 detik.` : `⛓️ Bekukan '${target.username}' dilepas.`);
        soundEngine.playPowerUp();
        return;
      }

      if (cmd === 'change' && (arg1 === 'body' || arg1 === 'avatar' || arg1 === 'skin')) {
        // Format: /change body [user|me] <model>  ATAU  /change body <model>
        const ALL_AVATARS = ['virus', 'cacing', 'ulat', 'burung', 'ayam', 'sapi', 'domba', 'cat-blue', 'cat-pink', 'cat-green', 'cat-orange', 'cat-purple', 'cat', 'kucing'];
        let targetQuery = 'me';
        let avatarChoice = '';
        if (parts[2] && ALL_AVATARS.includes(parts[2].toLowerCase())) {
          avatarChoice = parts[2].toLowerCase();
        } else if (parts[2] && parts[3]) {
          targetQuery = parts[2].toLowerCase();
          avatarChoice = parts[3].toLowerCase();
        } else if (parts[2]) {
          avatarChoice = parts[2].toLowerCase();
        }

        if (avatarChoice === 'cat' || avatarChoice === 'kucing') avatarChoice = 'cat-blue';
        if (avatarChoice === 'ulat') avatarChoice = 'cacing';

        if (!ALL_AVATARS.includes(avatarChoice)) {
          addSystemChatMessage('Format: /change body [user|me] <virus|cacing|burung|ayam|sapi|domba|cat-blue|cat-pink|cat-green>');
          addSystemChatMessage('Pilihan karakter animasi: virus (muter saat jalan), cacing/ulat (melar), burung (mengepak), ayam (mengangguk), sapi (menotok), domba (mantul), cat');
          return;
        }

        const target = resolveTarget(targetQuery);
        if (!target) return;
        if (!isStaff && !isStudentCmdAllowed(myIdRef.current) && target.id !== myIdRef.current) {
          addSystemChatMessage('Hanya Administrator atau Guru yang bisa mengganti karakter user lain.');
          return;
        }

        const pTarget = playersRef.current.get(target.id);
        const targetBody = avatarChoice.startsWith('cat') ? 'cat' : avatarChoice;
        if (pTarget) {
          pTarget.avatar = avatarChoice;
          pTarget.bodyModel = targetBody;
        }
        if (target.id === myIdRef.current) {
          equippedBodyRef.current = targetBody;
          setEquippedBody(targetBody);
          try {
            window.localStorage.setItem('llys_avatar', avatarChoice);
            window.localStorage.setItem('llys_body', targetBody);
          } catch { }
        }

        fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'avatar', avatar: avatarChoice, targetId: target.id }),
        }).catch(() => { });

        ably.publishCommand({ op: 'cosmetics', targetId: target.id, avatar: avatarChoice, bodyModel: targetBody });
        addSystemChatMessage(`🎭 Karakter '${target.username}' diubah jadi [${avatarChoice.toUpperCase()}]!`);
        soundEngine.playPowerUp();
        return;
      }

      if (cmd === 'change' && arg1 === 'tag') {
        if (!isStaff && !isStudentCmdAllowed(myIdRef.current)) {
          addSystemChatMessage('Perintah ini hanya untuk Administrator, Guru, atau siswa yang di-enable Admin/Guru.');
          return;
        }
        const targetQuery = arg2 || 'me';
        const title = parts.slice(3).join(' ').trim();
        const target = resolveTarget(targetQuery);
        if (!target) return;
        const tagValue = title ? title.slice(0, 24) : undefined;
        const p = playersRef.current.get(target.id);
        if (p) {
          p.tag1 = tagValue;
          p.tag = tagValue;
        }
        if (target.id === myIdRef.current) {
          try {
            if (tagValue) window.localStorage.setItem('llys_custom_tag1', tagValue);
            else window.localStorage.removeItem('llys_custom_tag1');
          } catch { }
        }
        fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set-tag', targetId: target.id, position: '1', tag: tagValue || null }),
        }).catch(() => { });
        ably.publishCommand({ op: 'cosmetics', targetId: target.id, tag1: tagValue, tag: tagValue });
        addSystemChatMessage(tagValue ? `🏷️ Tag 1 '${target.username}' diubah jadi "${tagValue}" (tersimpan permanen). Tips: gunakan /set tag <1|2|3> <user|me> <title> untuk 3 tingkat title.` : `🏷️ Tag 1 '${target.username}' direset.`);
        soundEngine.playPowerUp();
        return;
      }

      if (cmd === 'change' && arg1 === 'color') {
        if (!isStaff && !isStudentCmdAllowed(myIdRef.current)) {
          addSystemChatMessage('Perintah ini hanya untuk Administrator, Guru, atau siswa yang di-enable Admin/Guru.');
          return;
        }
        const targetQuery = arg2 || 'me';
        const channel = (parts[3]?.toLowerCase() || '') as 'body' | 'tag' | 'tag1' | 'tag2' | 'tag3' | 'nick';
        const colorRaw = parts.slice(4).join(' ');
        if (!['body', 'tag', 'tag1', 'tag2', 'tag3', 'nick'].includes(channel) || !colorRaw) {
          addSystemChatMessage('Format: /change color <user|me> body|tag|tag1|tag2|tag3|nick <warna>');
          addSystemChatMessage('Tips: gunakan tag1, tag2, atau tag3 untuk mewarnai title tertentu, atau tag untuk warna dasar semua title.');
          addSystemChatMessage('Warna: hex (#ff0000), nama (red), atau mode animasi: rgb, swap, spiral, spin, pulse, wave, strobe, candy, fire, ice, glitch, blink. Ketik none/reset buat balikin normal.');
          return;
        }
        const target = resolveTarget(targetQuery);
        if (!target) return;
        let colorSpec: string | undefined;
        if (colorRaw.toLowerCase() !== 'none' && colorRaw.toLowerCase() !== 'reset') {
          const parsed = parseColorArg(colorRaw);
          if (!parsed) {
            addSystemChatMessage(`Warna '${colorRaw}' tidak dikenal. Pakai hex, nama warna, atau mode animasi (rgb, swap, spiral, spin, pulse, wave, strobe, candy, fire, ice, glitch, blink).`);
            return;
          }
          colorSpec = parsed.value;
        }
        const p = playersRef.current.get(target.id);
        if (p) {
          p.colors = { ...(p.colors ?? {}) };
          if (channel === 'body') p.colors.body = colorSpec;
          else if (channel === 'tag') {
            p.colors.tag = colorSpec;
            if (!colorSpec) {
              delete p.colors.tag1;
              delete p.colors.tag2;
              delete p.colors.tag3;
            }
          }
          else if (channel === 'tag1') p.colors.tag1 = colorSpec;
          else if (channel === 'tag2') p.colors.tag2 = colorSpec;
          else if (channel === 'tag3') p.colors.tag3 = colorSpec;
          else p.colors.nick = colorSpec;
        }
        if (target.id === myIdRef.current) {
          try {
            const meP = playersRef.current.get(myIdRef.current);
            window.localStorage.setItem('llys_custom_colors', JSON.stringify(meP?.colors ?? {}));
          } catch { }
        }
        // Persist ke DB agar warna siswa/guru disimpan permanen!
        fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set-colors', targetId: target.id, channel, color: colorSpec || null }),
        }).catch(() => { });
        ably.publishCommand({
          op: 'cosmetics',
          targetId: target.id,
          colors: { [channel]: colorSpec },
        });
        addSystemChatMessage(colorSpec ? `🎨 ${channel} '${target.username}' diubah jadi ${colorSpec} (tersimpan permanen).` : `🎨 ${channel} '${target.username}' direset ke default.`);
        soundEngine.playPowerUp();
        return;
      }

      // Jika user mengetik incomplete command (misal /take, /untake, /spawn, /set):
      const matchingIncomplete = ALL_COMMANDS.filter((c) => {
        if (c.adminOnly && !isAdmin) return false;
        if (c.staffStrict && !isStaff) return false;
        if (c.staffOnly && !isStaff && !isStudentCmdAllowed(myIdRef.current)) return false;
        return c.prefix === cmd || c.prefix.startsWith(cmd);
      });
      if (matchingIncomplete.length > 0) {
        addSystemChatMessage(`Perintah /${cmd} tidak lengkap. Format:`);
        for (const m of matchingIncomplete) {
          addSystemChatMessage(m.usage);
        }
        return;
      }

      addSystemChatMessage(`Perintah '/${cmd}' tidak dikenali. Ketik /help untuk melihat daftar perintah.`);
    }

    async function sendChat(e: React.FormEvent) {
      e.preventDefault();
      if (exitNoticeRef.current || (roomRef.current?.status === 'paused' && !isStaffRole(myRoleRef.current))) return;
      const text = chatInput.trim();
      if (!text) return;
      setChatInput('');

      if (text.toLowerCase() === '/cls' || text.toLowerCase() === '/clear') {
        setChat([]);
        seenMsgIdsRef.current.clear();
        setUnreadCount(0);
        return;
      }

      if (text.startsWith('/')) {
        handleChatCommand(text);
        return;
      }

      if (myIdRef.current) {
        bubblesRef.current.set(myIdRef.current, { text, at: Date.now() });
      }
      const res = await fetch('/api/game/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, text }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          if (typeof data.message.seq === 'number' && data.message.seq > chatCursorRef.current) {
            chatCursorRef.current = data.message.seq;
          }
          ingestMessages([data.message]);
        }
      }
    }

    const displayChat = chat;
    const players = room?.players ?? [];
    const totalSteps = Math.max(levelQuestions.length, 1);
    // Hitung semua soal yang sudah dijawab oleh player (baik benar maupun salah) ke dalam progres misi
    const doneSteps = Math.min(Math.max(answeredQuestionIds.length, correctCount), totalSteps);
    const sortedPlayers = [...players].sort((a, b) => (scores[b.userId] ?? 0) - (scores[a.userId] ?? 0) || a.username.localeCompare(b.username));
    const hasVisibleQuestion = Boolean(question && (!isStaff ? !answeredQuestionIds.includes(question.id) : Boolean(mirrorTargetRef.current)));
    const questionActive = hasVisibleQuestion;
    const allBottomMinimized = panelsHidden || !hasVisibleQuestion;
    const controlsPosClass = allBottomMinimized ? '' : ' mp-elevated';

    async function togglePauseGame() {
      if (!room) return;
      const nextStatus = room.status === 'paused' ? 'in_progress' : 'paused';
      applyLiveRoomStatus(nextStatus);
      await fetch('/api/rooms/' + roomId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
    }

    async function endGame() {
      hasLeftRef.current = true;
      const res = await fetch('/api/rooms/' + roomId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (res.ok) {
        router.replace('/dashboard/teacher/rooms');
      }
    }

    async function kickPlayer(playerId: string) {
      const res = await fetch('/api/game/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, playerId }),
      });
      if (res.ok) {
        playersRef.current.delete(playerId);
        setRoom((prev) => (prev ? { ...prev, players: prev.players.filter((pl) => pl.userId !== playerId) } : prev));
      }
    }

    async function kickAllPlayers() {
      if (!confirm('Keluarkan semua siswa dari ruang permainan ini?')) return;
      const res = await fetch('/api/game/kick-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId }),
      });
      if (res.ok) {
        const data = await res.json();
        const kickedSet = new Set<string>(Array.isArray(data.kickedIds) ? data.kickedIds : []);
        for (const pid of kickedSet) {
          playersRef.current.delete(pid);
        }
        setRoom((prev) =>
          prev ? { ...prev, players: prev.players.filter((pl) => !kickedSet.has(pl.userId)) } : prev,
        );
      }
    }

    async function approveRejoin(playerId: string) {
      setRejoinRequests((prev) => prev.filter((r) => r.userId !== playerId));
      const res = await fetch('/api/game/approve-rejoin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, playerId }),
      });
      if (res.ok) {
        const data = await res.json();
        setScores((prev) => ({ ...prev, [playerId]: 0 }));
        if (Array.isArray(data.rejoinRequests)) {
          setRejoinRequests(data.rejoinRequests);
        }
      }
    }

    async function rejectRejoin(playerId: string) {
      setRejoinRequests((prev) => prev.filter((r) => r.userId !== playerId));
      const res = await fetch('/api/game/reject-rejoin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, playerId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.rejoinRequests)) {
          setRejoinRequests(data.rejoinRequests);
        }
      }
    }
    async function submitAnswer(e: React.FormEvent) {
      e.preventDefault();
      if (exitNoticeRef.current || (roomRef.current?.status === 'paused' && !isStaffRole(myRoleRef.current))) return;
      if (!question || !selected || submitting) return;

      if (isStaffRole(myRoleRef.current) && mirrorTargetRef.current) {
        const answeredId = question.id;
        const targetId = mirrorTargetRef.current === 'all' ? 'all' : mirrorTargetRef.current.userId;
        const targetName = mirrorTargetRef.current === 'all' ? 'Seluruh Siswa' : mirrorTargetRef.current.username;

        answerResultsRef.current.set(answeredId, 'assisted');
        answeredIdsRef.current.add(answeredId);
        setAnsweredQuestionIds(Array.from(answeredIdsRef.current));
        setCorrectCount(answeredIdsRef.current.size);

        ably.publishCommand({ op: 'assist_answer', targetId, qid: answeredId });
        // Persist ke database supaya centang biru bertahan walau siswa rejoin
        fetch('/api/game/assist-answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, targetId, questionId: answeredId, answer: selected }),
        }).catch(() => { });
        soundEngine.playAnswerCorrect();
        showBanner(`🟦 Berhasil membantu soal untuk ${targetName}! (+0 Poin, Misi Tercatat)`, 4000);
        setQuestion(null);
        questionRef.current = null;
        setSelected('');
        return;
      }

      setSubmitting(true);
      try {
        const answeredId = question.id;
        const res = await fetch('/api/game/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionIdRef.current || undefined,
            roomId,
            levelId: roomRef.current?.level?.id,
            questionId: answeredId,
            answer: selected,
            timeSpent: 0,
          }),
        });
        const data = await res.json();
        if (Array.isArray(data.rejoinRequests)) {
          setRejoinRequests(data.rejoinRequests);
        }

        if (typeof data.sessionId === 'string' && data.sessionId) {
          sessionIdRef.current = data.sessionId;
        }
        if (res.ok) {
          const result = data.result ?? data;
          answerResultsRef.current.set(answeredId, Boolean(result.isCorrect));
          answeredIdsRef.current.add(answeredId);
          const nextAnsweredList = Array.from(answeredIdsRef.current);
          setAnsweredQuestionIds(nextAnsweredList);
          // Tambahkan progres misi baik jawaban benar maupun salah
          setCorrectCount(nextAnsweredList.length);
          const curStg = currentStageRef.current;
          const totStg = totalStagesRef.current;
          const curStgQs = getStageQuestions(levelQuestionsRef.current, curStg, totStg);
          if (curStgQs.length > 0 && curStgQs.every((q) => answeredIdsRef.current.has(q.id))) {
            const bossAlive = stageBossesRef.current.some((b) => b.alive);
            if (bossAlive) {
              showBanner(`⚔ Semua soal di Stage ${curStg} telah terjawab! Kalahkan Boss Penjaga Pintu di ujung kanan untuk membuka gerbang!`, 5500);
            } else {
              const msg =
                curStg < totStg
                  ? `🔓 GERBANG STAGE ${curStg} TERBUKA! Masuk ke Pintu Ujung Kanan untuk Lanjut ke Stage ${curStg + 1} ➜`
                  : `🏆 SEMUA SOAL SELESAI! Masuk ke Gerbang Finish di Ujung Kanan!`;
              showBanner(msg, 5000);
            }
          }
          setSelected('');
          if (!isStaff) {
            ably.publishCommand({
              op: 'mirror_question_state',
              userId: myIdRef.current,
              qid: answeredId,
              selected,
              isSubmitted: true,
              isCorrect: Boolean(result.isCorrect),
            });
          }
          if (result.isCorrect) {
            soundEngine.playAnswerCorrect();
            if (myIdRef.current) {
              setScores((prev) => ({
                ...prev,
                [myIdRef.current]: (prev[myIdRef.current] ?? 0) + (result.pointsEarned ?? 0),
              }));
              const me = playersRef.current.get(myIdRef.current);
              if (me && !isStaff) {
                if (!me.hasAdminGun) {
                  me.blasterAmmo = Math.min((me.blasterAmmo ?? 0) + 5, 20);
                  me.blasterUntil = Date.now() + 60000;
                  setAmmoCount(me.blasterAmmo);
                }
              }
            }
          } else {
            soundEngine.playAnswerWrong();
          }
          setFeedback(result);
        } else {
          if (res.status === 409) {
            answeredIdsRef.current.add(answeredId);
            const nextAnsweredList = Array.from(answeredIdsRef.current);
            setAnsweredQuestionIds(nextAnsweredList);
            setCorrectCount(nextAnsweredList.length);
            questionRef.current = null;
            setQuestion(null);
            setSelected('');
          } else {
            setError(data.error ?? 'Gagal mengirim jawaban');
          }
        }
      } finally {
        setSubmitting(false);
      }
    }

    if (error && !room) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-[var(--cream-bg)]">
          <div className="parchment-card mp-error-card">
            <div className="wood-header-sign">llysSmart</div>
            <p className="font-display text-xl font-semibold">{error}</p>
            <div className="mt-4 flex justify-center">
              <button className="btn-orange-action" onClick={() => router.push('/dashboard/student')}>
                Kembali ke Dashboard
              </button>
            </div>
          </div>
        </main>
      );
    }

    return (
      <main ref={mainRef} className="fixed top-0 left-0 right-0 h-screen w-full overflow-hidden bg-[#1e2d42] p-0 md:p-4 game-shell">
        <div className={`game-viewport${questionActive ? ' question-focus' : ''}`}>
          <canvas
            ref={canvasRef}
            className="h-full w-full touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onWheel={onWheel}
          />

          <div className="mp-hud-layer">
            <div className="mp-topbar">
              <div className="mp-top-left">
                <div className="mp-brand-pill">
                  <svg width="34" height="34" viewBox="0 0 48 48" aria-hidden="true">
                    <rect x="4" y="12" width="40" height="24" rx="12" fill="#e8eefc" stroke="#233866" strokeWidth="3.5" />
                    <path d="M15 20v8M11 24h8" stroke="#3b66c4" strokeWidth="3.2" strokeLinecap="round" />
                    <circle cx="32" cy="21" r="2.5" fill="#ef4b5b" />
                    <circle cx="36" cy="26" r="2.5" fill="#ffb03b" />
                  </svg>
                  <div className="mp-brand-text">
                    <span className="mp-brand-name">llysSmart</span>
                    <span className="mp-brand-sub">Let&apos;s Learn Your Skills</span>
                  </div>
                </div>

                {!panelsHidden && (
                  <button
                    type="button"
                    className="pause-btn mp-chat-top-btn"
                    aria-pressed={!chatMinimized}
                    aria-label={chatMinimized ? 'Buka Chat Room' : 'Tutup Chat Room'}
                    title={chatMinimized ? 'Buka Chat Room' : 'Tutup Chat Room'}
                    onClick={() => {
                      soundEngine.playClick();
                      setChatMinimized((prev) => !prev);
                      setUnreadCount(0);
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
                        fill="#fff"
                      />
                      <circle cx="8.5" cy="11.5" r="1.3" fill="#6b3806" />
                      <circle cx="12" cy="11.5" r="1.3" fill="#6b3806" />
                      <circle cx="15.5" cy="11.5" r="1.3" fill="#6b3806" />
                    </svg>
                    {unreadCount > 0 && <span className="mp-chat-badge">{unreadCount}</span>}
                  </button>
                )}
              </div>

              <div className="mp-center-stage-pill">
                <div className="mp-stage-title">{getRoomSubjectTitle(room)}</div>
                {totalStages > 1 && (
                  isStaff ? (
                    <div className="mp-stage-switch-row" role="group" aria-label="Pilih Stage (Guru/Admin)">
                      {Array.from({ length: totalStages }, (_, idx) => {
                        const stgNum = idx + 1;
                        const realStageId = selectedStagesRef.current[idx] ?? selectedStages[idx] ?? stgNum;
                        const stgQs = getStageQuestions(levelQuestions, stgNum, totalStages);
                        const stgAns = stgQs.filter((q) => answeredQuestionIds.includes(q.id)).length;
                        const isCleared = stgQs.length > 0 && stgAns >= stgQs.length;
                        return (
                          <button
                            key={stgNum}
                            type="button"
                            className={`mp-stage-chip-compact${currentStage === stgNum ? ' is-active' : ''}${isCleared ? ' is-cleared' : ''}`}
                            title={`Stage ${realStageId} (#${stgNum}: ${getStageShortName(realStageId)}) • ${stgAns}/${stgQs.length} soal`}
                            onClick={() => {
                              soundEngine.playClick();
                              applyStage(stgNum, { respawnPlayer: true, showToast: true });
                            }}
                          >
                            {realStageId}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mp-stage-switch-row">
                      <span className="mp-stage-badge-student">
                        Stage {selectedStagesRef.current[currentStage - 1] ?? selectedStages[currentStage - 1] ?? currentStage} / {totalStages} ({getStageShortName(selectedStagesRef.current[currentStage - 1] ?? selectedStages[currentStage - 1] ?? currentStage)})
                      </span>
                    </div>
                  )
                )}
              </div>

              {spectateTargetId && (
                <div className="mirror-indicator-pill mp-spectate-pill" role="status">
                  <span>📹 Memantau: <strong>{playersRef.current.get(spectateTargetId)?.username || spectateTargetId}</strong></span>
                  <button
                    type="button"
                    className="mirror-close-btn"
                    title="Kembali ke Karakter Sendiri"
                    onClick={returnCameraToSelf}
                  >
                    ✕
                  </button>
                </div>
              )}

              {isCameraFreePanning && !spectateTargetId && (
                <div className="mirror-indicator-pill mp-freepan-pill" role="status">
                  <span>🔍 Kamera Bebas</span>
                  <button
                    type="button"
                    className="mp-freepan-reset-btn"
                    title="Kembalikan kamera ke karakter"
                    onClick={returnCameraToSelf}
                  >
                    🎯 Pusatkan
                  </button>
                </div>
              )}

              {mirrorTarget && !spectateTargetId && isStaff && (
                <div className="mirror-indicator-pill" role="status">
                  <span>🔍 Mirroring: <strong>{mirrorTarget}</strong></span>
                  <button
                    type="button"
                    className="mirror-close-btn"
                    title="Tutup Mode Mirror (/unset mirror)"
                    onClick={() => {
                      mirrorTargetRef.current = null;
                      mirrorFetchTargetRef.current = null;
                      setMirrorTarget(null);
                      questionBlocksRef.current = [];
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {ropedByUserId && (
                <div className="follow-indicator-pill" role="status">
                  <span>🪢 Mengikuti: <strong>{playersRef.current.get(ropedByUserId)?.username || 'Player'}</strong></span>
                  <button
                    type="button"
                    className="follow-unfollow-btn"
                    title="Lepas Tali / Berhenti Mengikuti (/unfollow)"
                    onClick={() => handleChatCommand('/unfollow')}
                  >
                    ✕ Unfollow
                  </button>
                </div>
              )}

              <div className="mp-top-right">
                <div className="mp-timer-row">
                  <div
                    className="mp-ping-pill"
                    title={`Realtime Transport: ${ably.transportMode.toUpperCase()} (${ably.pingMs} ms)`}
                    aria-label={`Ping ${ably.pingMs} ms`}
                  >
                    <span className={`mp-ping-dot ${ably.pingMs <= 20 ? 'fast' : ably.pingMs <= 80 ? 'ok' : 'slow'}`} />
                    <span>{ably.pingMs} ms</span>
                  </div>
                  {isStaff && (
                    <div className="mp-teacher-actions">
                      <button
                        type="button"
                        className={`pause-btn mp-staff-btn ${room?.status === 'paused' ? 'mp-staff-green' : 'mp-staff-blue'}`}
                        aria-label={room?.status === 'paused' ? 'Lanjutkan Game' : 'Jeda Game'}
                        title={room?.status === 'paused' ? 'Lanjutkan Game' : 'Jeda Game'}
                        onClick={togglePauseGame}
                      >
                        {room?.status === 'paused' ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M8 5.5v13l11-6.5-11-6.5z" fill="#fff" />
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                            <rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="#fff" />
                            <rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="#fff" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        className="pause-btn mp-staff-btn mp-staff-blue mp-chat-top-btn"
                        aria-label="Kelola Pemain"
                        title="Kelola Pemain"
                        onClick={() => {
                          setKickModalOpen(true);
                          fetch('/api/game/room-sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ roomId, chatCursor: chatCursorRef.current }),
                          })
                            .then((r) => (r.ok ? r.json() : null))
                            .then((d) => {
                              if (d && Array.isArray(d.rejoinRequests)) {
                                setRejoinRequests(d.rejoinRequests);
                              }
                            })
                            .catch(() => { });
                        }}
                      >
                        <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true">
                          <circle cx="9" cy="8.5" r="3.2" fill="#fff" />
                          <path
                            d="M3.5 19c0-2.8 2.5-5 5.5-5s5.5 2.2 5.5 5"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                          />
                          <circle cx="16.8" cy="9.2" r="2.3" fill="#fff" opacity="0.92" />
                          <path
                            d="M15.8 14.3c2.4.3 4.4 2 4.4 4.4"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                        {rejoinRequests.length > 0 && (
                          <span className="mp-chat-badge">{rejoinRequests.length}</span>
                        )}
                      </button>
                      <button
                        type="button"
                        className="pause-btn mp-staff-btn mp-staff-danger"
                        aria-label="Akhiri Sesi Game"
                        title="Akhiri Sesi Game"
                        onClick={endGame}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M12 3v9"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="2.6"
                            strokeLinecap="round"
                          />
                          <path
                            d="M7.05 6.05a8 8 0 1 0 9.9 0"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className="pause-btn"
                    aria-label="Toko Karakter & Item"
                    title="Toko Petualang (Troli)"
                    onClick={() => {
                      soundEngine.playClick();
                      setShowShopModal(true);
                    }}
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: '2px solid #fef08a' }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="9" cy="21" r="1.5" fill="#fff" />
                      <circle cx="20" cy="21" r="1.5" fill="#fff" />
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="pause-btn"
                    aria-pressed={settingsModalOpen}
                    aria-label="Pengaturan Suara & Tombol"
                    title="Pengaturan Suara & Tombol"
                    onClick={() => {
                      soundEngine.playClick();
                      setSettingsModalOpen((v) => !v);
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"
                        fill="#fff"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="pause-btn"
                    aria-pressed={panelsHidden}
                    aria-label={panelsHidden ? 'Tampilkan semua panel' : 'Sembunyikan semua panel'}
                    title={panelsHidden ? 'Tampilkan semua panel' : 'Sembunyikan semua panel'}
                    onClick={() => {
                      soundEngine.playClick();
                      setPanelsHidden((v) => !v);
                    }}
                  >
                    {panelsHidden ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="3" y1="3" x2="21" y2="21" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="3" fill="#fff" />
                      </svg>
                    )}
                  </button>
                  <button type="button" className="pause-btn" aria-label="Kembali" title="Kembali" onClick={handleLeaveGame}>
                    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><path d="M20 6l-12 10 12 10v-6h8v-8h-8V6z" fill="#fff" /></svg>
                  </button>
                  <button
                    type="button"
                    className="pause-btn mp-fullscreen-btn"
                    aria-label={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
                    title={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
                    onClick={toggleFullscreen}
                  >
                    {isFullscreen ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 3v3H6v3H3V3h6zm6 0h6v6h-3V6h-3V3zM3 15h3v3h3v3H3v-6zm15 0h3v6h-6v-3h3v-3z" fill="#fff" />
                      </svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 3h6v3H6v3H3V3zm12 0h6v6h-3V6h-3V3zM3 15h3v3h3v3H3v-6zm18 0v6h-6v-3h3v-3h3z" fill="#fff" />
                      </svg>
                    )}
                  </button>
                </div>

                {!panelsHidden && (
                  <div className="mp-right-tool-rail">
                    <div className="mp-tool-slot">
                      <button
                        type="button"
                        className={`mp-icon-badge${!leaderboardMinimized ? ' is-active' : ''}`}
                        aria-pressed={!leaderboardMinimized}
                        aria-label={leaderboardMinimized ? 'Buka Leaderboard' : 'Tutup Leaderboard'}
                        title={leaderboardMinimized ? 'Buka Leaderboard' : 'Tutup Leaderboard'}
                        onClick={() => {
                          soundEngine.playClick();
                          setLeaderboardMinimized((v) => !v);
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <span aria-hidden="true">🏆</span>
                      </button>
                      {!leaderboardMinimized && (
                        <aside className="mp-dark-panel mp-leaderboard-box mp-tool-popover" aria-label="Papan peringkat" style={panelStyle('leaderboard')}>
                          <h2
                            className="mp-panel-heading mp-drag-handle"
                            onPointerDown={(e) => startPanelDrag('leaderboard', e)}
                            onPointerMove={movePanelDrag}
                            onPointerUp={(e) => endPanelDrag(e)}
                            onPointerCancel={(e) => endPanelDrag(e)}
                          >
                            <span className="mp-panel-heading-title">
                              <span aria-hidden="true">🏆</span> Leaderboard
                            </span>
                            <div className="flex items-center gap-1.5 ml-auto">
                              {isAdmin && (
                                <button
                                  type="button"
                                  className="mp-win-btn text-xs font-bold hover:text-amber-300"
                                  aria-label="Panel Aksi Masal Admin (All / Here)"
                                  title="Panel Aksi Masal Admin (All / Here)"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    soundEngine.playClick();
                                    setActionModalTarget({ target: 'global', username: 'Aksi Masal (Global)' });
                                    setActionModalScope('here');
                                  }}
                                >
                                  ⚙️
                                </button>
                              )}
                              <button
                                type="button"
                                className="mp-win-btn"
                                aria-label="Perkecil leaderboard"
                                title="Perkecil"
                                onClick={() => setLeaderboardMinimized(true)}
                              >
                                −
                              </button>
                            </div>
                          </h2>
                          {isStaff && (
                            <div className="mp-leaderboard-search-wrap">
                              <input
                                type="text"
                                className="mp-leaderboard-search-input"
                                placeholder="🔍 Cari username / nama..."
                                value={leaderboardSearch}
                                onChange={(e) => setLeaderboardSearch(e.target.value)}
                                onFocus={() => {
                                  keysRef.current.left = false;
                                  keysRef.current.right = false;
                                  keysRef.current.jump = false;
                                }}
                                onKeyDown={(e) => e.stopPropagation()}
                                onKeyUp={(e) => e.stopPropagation()}
                              />
                              {leaderboardSearch && (
                                <button
                                  type="button"
                                  className="mp-search-clear-btn"
                                  onClick={() => setLeaderboardSearch('')}
                                  title="Hapus pencarian"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          )}
                          <ol
                            className="mp-rank-list"
                            onWheel={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            {sortedPlayers
                              .filter((p) => p.role !== 'admin')
                              .filter((p) => {
                                if (!isStaff || !leaderboardSearch.trim()) return true;
                                const q = leaderboardSearch.trim().toLowerCase();
                                const uname = p.username.toLowerCase();
                                const fname = (p.fullName || '').toLowerCase();
                                return uname.includes(q) || fname.includes(q);
                              })
                              .map((p, i) => {
                                const liveP = playersRef.current.get(p.userId);
                                const pFullName = p.fullName || liveP?.fullName;
                                const pUsername = p.username;
                                const rankDisplayName =
                                  pFullName && pFullName.trim().toLowerCase() !== pUsername.trim().toLowerCase()
                                    ? `[${pUsername}] - ${pFullName.trim()}`
                                    : `[${pUsername}]`;
                                const isSpectatingThis = spectateTargetId === p.userId;
                                return (
                                  <li key={p.userId} className={`mp-rank-row${isSpectatingThis ? ' is-spectating' : ''}`}>
                                    <span className={`rank-medal ${['gold', 'silver', 'bronze'][i] ?? 'silver'}`}>{i + 1}</span>
                                    <span className={`rank-cat-dot ${chipColor(p.userId)}`} aria-hidden="true" />
                                    <span className="rank-name" title={rankDisplayName}>{rankDisplayName}</span>
                                    <span className="rank-score">{scores[p.userId] ?? 0}</span>
                                    {isStaff && (
                                      <div className="mp-rank-actions">
                                        <button
                                          type="button"
                                          className={`mp-rank-btn mp-rank-spy-btn${isSpectatingThis ? ' is-active' : ''}`}
                                          title={`Pantau / Spy kamera ke ${pUsername}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleSpectate(p.userId, pUsername);
                                          }}
                                        >
                                          📹
                                        </button>
                                        <button
                                          type="button"
                                          className="mp-rank-btn mp-rank-admin-btn"
                                          title={`Buka Panel Aksi untuk ${pUsername}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            soundEngine.playClick();
                                            setActionModalTarget({
                                              target: p.userId,
                                              username: pUsername,
                                              fullName: pFullName,
                                              role: p.role,
                                              stage: liveP?.stage ?? p.stage,
                                            });
                                          }}
                                        >
                                          ⚙️
                                        </button>
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                          </ol>
                        </aside>
                      )}
                    </div>

                    <div className="mp-tool-slot">
                      <button
                        type="button"
                        className={`mp-icon-badge${!missionMinimized ? ' is-active' : ''}`}
                        aria-pressed={!missionMinimized}
                        aria-label={missionMinimized ? 'Buka Misi' : 'Tutup Misi'}
                        title={missionMinimized ? 'Buka Misi' : 'Tutup Misi'}
                        onClick={() => {
                          soundEngine.playClick();
                          setMissionMinimized((v) => !v);
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <span aria-hidden="true">🎯</span>
                      </button>
                      {!missionMinimized && (
                        <aside className="mp-dark-panel mp-topic-card mp-tool-popover" aria-label="Progres misi" style={panelStyle('mission')}>
                          <h3
                            className="mp-panel-heading mp-drag-handle"
                            onPointerDown={(e) => startPanelDrag('mission', e)}
                            onPointerMove={movePanelDrag}
                            onPointerUp={(e) => endPanelDrag(e)}
                            onPointerCancel={(e) => endPanelDrag(e)}
                          >
                            <span className="mp-panel-heading-title">
                              <span aria-hidden="true">🎯</span> Misi
                            </span>
                            <button
                              type="button"
                              className="mp-win-btn"
                              aria-label="Perkecil misi"
                              title="Perkecil misi"
                              onClick={() => setMissionMinimized(true)}
                            >
                              −
                            </button>
                          </h3>
                          <ul className="mp-topic-checklist">
                            <li><span className="check-green" aria-hidden="true">✔</span> Masuk arena</li>
                            <li>
                              <span className={doneSteps > 0 ? 'check-green' : 'check-pending'} aria-hidden="true">
                                {doneSteps > 0 ? '✔' : '○'}
                              </span>{' '}
                              Jawab tantangan soal ({doneSteps}/{totalSteps})
                            </li>
                          </ul>
                          <div className="mp-goal-bar-row">
                            <span aria-hidden="true">🚩</span>
                            <div className="mp-goal-track">
                              <div className="mp-goal-fill" style={{ width: `${(doneSteps / totalSteps) * 100}%` }} />
                            </div>
                            <span className="mp-goal-fraction">{doneSteps} / {totalSteps}</span>
                          </div>
                        </aside>
                      )}
                    </div>

                    <button
                      type="button"
                      className="mp-icon-badge"
                      aria-label="Perbesar Kamera (Zoom In)"
                      title="Perbesar (Zoom In)"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        soundEngine.playClick();
                        cameraRef.current?.zoomBy(0.12);
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
                        <circle cx="14" cy="14" r="8.5" fill="none" stroke="#fff" strokeWidth="3" />
                        <line x1="20.5" y1="20.5" x2="27.5" y2="27.5" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
                        <line x1="10.5" y1="14" x2="17.5" y2="14" stroke="#ffd338" strokeWidth="2.8" strokeLinecap="round" />
                        <line x1="14" y1="10.5" x2="14" y2="17.5" stroke="#ffd338" strokeWidth="2.8" strokeLinecap="round" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      className="mp-icon-badge"
                      aria-label="Perkecil Kamera (Zoom Out)"
                      title="Perkecil (Zoom Out)"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        soundEngine.playClick();
                        cameraRef.current?.zoomBy(-0.12);
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
                        <circle cx="14" cy="14" r="8.5" fill="none" stroke="#fff" strokeWidth="3" />
                        <line x1="20.5" y1="20.5" x2="27.5" y2="27.5" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
                        <line x1="10.5" y1="14" x2="17.5" y2="14" stroke="#a8d8ff" strokeWidth="2.8" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {stageBanner && (
              <div className="mp-stage-banner-toast" role="status" aria-live="polite">
                {stageBanner}
              </div>
            )}

            {editingControlsLayout && (
              <div className="hud-edit-banner" role="region" aria-label="Mode atur posisi tombol">
                <span className="hud-edit-banner-text">Geser tombol Arah &amp; Lompat ke posisi yang nyaman</span>
                <button
                  type="button"
                  className="btn-green-action hud-edit-done-btn"
                  onClick={() => {
                    soundEngine.playClick();
                    setEditingControlsLayout(false);
                  }}
                >
                  ✔ Selesai
                </button>
              </div>
            )}

            <div
              className={`onscreen-controls${controlsPosClass}${hudControls.swapSides ? ' is-swapped' : ''}`}
              style={
                {
                  '--ctrl-size': `${hudControls.size}px`,
                  '--ctrl-gap': `${hudControls.gap}px`,
                  '--ctrl-opacity': hudControls.opacity,
                } as React.CSSProperties
              }
            >
              <div
                className={`dpad-group${editingControlsLayout ? ' is-editing-layout' : ''}`}
                style={{ transform: `translate(${hudControls.dpadX}px, ${hudControls.dpadY}px)` }}
                onPointerDown={(e) => startControlGroupDrag('dpad', e)}
                onPointerMove={moveControlGroupDrag}
                onPointerUp={endControlGroupDrag}
                onPointerCancel={endControlGroupDrag}
              >
                {editingControlsLayout && <span className="dpad-edit-tag">Geser Arah</span>}
                <button
                  type="button"
                  className="ctrl-circle"
                  aria-label="Gerak ke Kiri"
                  onPointerDown={(e) => handleTouchControlStart('left', e)}
                  onPointerUp={(e) => handleTouchControlEnd('left', e)}
                  onPointerCancel={(e) => handleTouchControlEnd('left', e)}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <svg
                    width={Math.round(hudControls.size * 0.44)}
                    height={Math.round(hudControls.size * 0.44)}
                    viewBox="0 0 32 32"
                    aria-hidden="true"
                  >
                    <path d="M18 7l-9 9 9 9v-5h8v-8h-8V7z" fill="#fff" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="ctrl-circle"
                  aria-label="Gerak ke Kanan"
                  onPointerDown={(e) => handleTouchControlStart('right', e)}
                  onPointerUp={(e) => handleTouchControlEnd('right', e)}
                  onPointerCancel={(e) => handleTouchControlEnd('right', e)}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <svg
                    width={Math.round(hudControls.size * 0.44)}
                    height={Math.round(hudControls.size * 0.44)}
                    viewBox="0 0 32 32"
                    aria-hidden="true"
                  >
                    <path d="M14 7l9 9-9 9v-5H6v-8h8V7z" fill="#fff" />
                  </svg>
                </button>
              </div>

              <div
                className={`dpad-group${editingControlsLayout ? ' is-editing-layout' : ''}`}
                style={{ transform: `translate(${hudControls.jumpX}px, ${hudControls.jumpY}px)` }}
                onPointerDown={(e) => startControlGroupDrag('jump', e)}
                onPointerMove={moveControlGroupDrag}
                onPointerUp={endControlGroupDrag}
                onPointerCancel={endControlGroupDrag}
              >
                {editingControlsLayout && <span className="dpad-edit-tag">Aksi &amp; Lompat</span>}
                {ammoCount > 0 && (
                  <button
                    type="button"
                    className={`ctrl-circle ctrl-shoot-btn has-ammo`}
                    aria-label="Tembak Laser"
                    title="Tembak Laser (F / X / E)"
                    onPointerDown={(e) => handleTouchControlStart('shoot', e)}
                    onPointerUp={(e) => handleTouchControlEnd('shoot', e)}
                    onPointerCancel={(e) => handleTouchControlEnd('shoot', e)}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <span className="ctrl-shoot-icon" aria-hidden="true">⚡</span>
                    <span className="ctrl-ammo-badge">{ammoCount === Infinity ? '∞' : ammoCount}</span>
                  </button>
                )}
                <button
                  type="button"
                  className="ctrl-circle"
                  aria-label="Lompat"
                  onPointerDown={(e) => handleTouchControlStart('jump', e)}
                  onPointerUp={(e) => handleTouchControlEnd('jump', e)}
                  onPointerCancel={(e) => handleTouchControlEnd('jump', e)}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <svg
                    width={Math.round(hudControls.size * 0.46)}
                    height={Math.round(hudControls.size * 0.46)}
                    viewBox="0 0 32 32"
                    aria-hidden="true"
                  >
                    <path d="M16 6l-9 9h5v11h8V15h5l-9-9z" fill="#fff" />
                  </svg>
                </button>
              </div>
            </div>

            {(!panelsHidden || hasVisibleQuestion) && (
              <div className="mp-bottom-dock">
                {!panelsHidden && !chatMinimized && (
                  <aside className="mp-dark-panel mp-chat-panel mp-chat-fixed" aria-label="Ruang obrolan">
                    <div className="mp-chat-header">
                      <div className="mp-chat-title">
                        <span aria-hidden="true">💬</span> Chat Room
                      </div>
                      <div className="mp-online-count" aria-label={`${players.length} pemain`}>
                        <span aria-hidden="true">👤</span> {players.length}
                        <button
                          type="button"
                          className="mp-win-btn"
                          aria-label="Perkecil chat"
                          title="Perkecil chat"
                          onClick={() => setChatMinimized(true)}
                        >
                          −
                        </button>
                      </div>
                    </div>

                    <div className="mp-chat-messages" ref={chatBoxRef} role="log" aria-live="polite">
                      {displayChat.map((m) => {
                        if (m.senderName === 'SYSTEM') {
                          return (
                            <div key={m.id} className="sys-chat-entry">
                              <span className="font-bold">{m.text}</span>
                            </div>
                          );
                        }

                        const senderPlayer = (m.userId ? playersRef.current.get(m.userId) : null) ||
                          roomRef.current?.players?.find((pl) => pl.userId === m.userId || pl.username === m.senderName);
                        const isSenderAdmin = m.role === 'admin' || senderPlayer?.role === 'admin';

                        // Format label: [Tag] - Nama Lengkap (tag/title bold)
                        let senderTag = '';
                        let senderName = '';
                        if (isSenderAdmin) {
                          senderTag = senderPlayer?.tag || 'Administrator';
                          senderName = m.senderFullName || senderPlayer?.fullName || m.senderName;
                        } else if (senderPlayer?.tag || m.role === 'teacher' || senderPlayer?.role === 'teacher') {
                          senderTag = senderPlayer?.tag || 'Teacher';
                          senderName = m.senderFullName || senderPlayer?.fullName || m.senderName;
                        } else {
                          const uname = m.senderName;
                          const fname = m.senderFullName || senderPlayer?.fullName;
                          senderName = fname && fname.trim().toLowerCase() !== uname.trim().toLowerCase()
                            ? `${uname} - ${fname.trim()}`
                            : uname;
                        }

                        return (
                          <div key={m.id} className="chat-msg-item">
                            <span>
                              {senderTag ? (
                                <>
                                  <span className={`chat-sender font-bold ${chipColor(m.senderName)}`}>[{senderTag}]</span>
                                  <span className={`chat-sender ${chipColor(m.senderName)}`}> - {senderName}</span>
                                </>
                              ) : (
                                <span className={`chat-sender ${chipColor(m.senderName)}`}>[{senderName}]</span>
                              )}
                              <span className="chat-text">: {m.text}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <form className="mp-chat-form" onSubmit={sendChat}>
                      <label htmlFor="mp-chat-input" className="sr-only">Ketik pesan</label>
                      <input
                        id="mp-chat-input"
                        type="text"
                        className="mp-chat-input"
                        placeholder={isStaff ? 'Ketik pesan atau /cmd...' : 'Ketik pesan...'}
                        maxLength={120}
                        autoComplete="off"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onFocus={() => {
                          keysRef.current.left = false;
                          keysRef.current.right = false;
                          keysRef.current.jump = false;
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                        onKeyUp={(e) => e.stopPropagation()}
                      />
                      <button type="submit" className="mp-chat-send-btn" aria-label="Kirim pesan">
                        <span aria-hidden="true">➤</span>
                      </button>
                    </form>
                  </aside>
                )}

                {question && (!isStaff ? !answeredQuestionIds.includes(question.id) : Boolean(mirrorTargetRef.current)) && (
                  <section className="parchment-card mp-question-dock" aria-label="Tantangan soal" style={panelStyle('question')}>
                    <div
                      className="mp-dock-ribbon mp-drag-handle flex items-center justify-between"
                      onPointerDown={(e) => startPanelDrag('question', e)}
                      onPointerMove={movePanelDrag}
                      onPointerUp={(e) => endPanelDrag(e)}
                      onPointerCancel={(e) => endPanelDrag(e)}
                      onDoubleClick={() => setPanelOffsets((prev) => ({ ...prev, question: { x: 0, y: 0 } }))}
                      title="Drag untuk memindahkan, klik 2x untuk reset posisi"
                    >
                      <span className="mp-panel-heading-title">
                        <span aria-hidden="true">📖</span> Tantangan Soal {isStaff && mirrorTarget && (
                          <span className="text-xs text-yellow-300 font-normal ml-2">
                            (Mirror: {mirrorTarget})
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1 ml-auto">
                        {panelOffsets['question'] && (panelOffsets['question'].x !== 0 || panelOffsets['question'].y !== 0) && (
                          <button
                            type="button"
                            className="mp-win-btn text-xs font-bold text-amber-900 hover:text-black"
                            title="Reset posisi ke tengah"
                            onClick={() => setPanelOffsets((prev) => ({ ...prev, question: { x: 0, y: 0 } }))}
                          >
                            ⌖
                          </button>
                        )}
                        {isStaff && (
                          <button
                            type="button"
                            className="mp-win-btn text-sm font-bold text-slate-300 hover:text-white"
                            title="Tutup Modal Soal (Guru/Admin)"
                            onClick={() => closeQuestionModal(question.id)}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mp-bonus-badge" aria-label={`Bonus ${question.points} poin`}>
                      <span aria-hidden="true">⏱</span> +{question.points}
                    </div>

                    <form onSubmit={submitAnswer} className="mp-q-form-body">
                      <div className="mp-q-scroll-content">
                        <div className="mp-q-header-row">
                          <h2 className="mp-q-heading">{question.content}</h2>
                        </div>

                        <div className="mp-options-grid-2x2" role="radiogroup" aria-label="Pilihan jawaban">
                          {question.options.map((o, idx) => {
                            const displayLabel = OPTION_DISPLAY_LABELS[idx] ?? o.label;
                            const isStaffViewer = isStaffRole(myRoleRef.current);
                            const isCorrectKey = isStaffViewer && Boolean(question.correctAnswer) && (
                              question.correctAnswer === o.label ||
                              question.correctAnswer === o.content ||
                              question.correctAnswer?.toLowerCase() === o.label.toLowerCase() ||
                              question.correctAnswer?.toLowerCase() === o.content.toLowerCase()
                            );

                            // Cek apakah opsi ini dipilih oleh siswa yang sedang di-mirror / di-follow
                            const isMirrorActive = Boolean(mirrorTargetRef.current || ropedByUserId);
                            const chosenAns = studentChosenAnswers.get(question.id);
                            const liveSelecting = mirroredStudentSelections.get(question.id);
                            const studentChoice = chosenAns || liveSelecting;
                            const isStudentPick = Boolean(isMirrorActive && isStaffViewer && studentChoice && (
                              studentChoice === o.label ||
                              studentChoice === o.content ||
                              studentChoice.toLowerCase() === o.label.toLowerCase() ||
                              studentChoice.toLowerCase() === o.content.toLowerCase()
                            ));

                            const qResult = answerResultsRef.current.get(question.id);
                            const isStudentPickWrong = isStudentPick && (qResult === false || (chosenAns && !isCorrectKey));
                            const isStudentPickCorrect = isStudentPick && (qResult === true || (chosenAns && isCorrectKey));
                            const isStudentLiveChoice = isStudentPick && !chosenAns;

                            let ringClass = '';
                            if (isCorrectKey) ringClass = ' border-emerald-500 ring-2 ring-emerald-400 bg-emerald-50/20';
                            if (isStudentPickWrong) ringClass = ' border-rose-500 ring-2 ring-rose-400 bg-rose-50/25';
                            else if (isStudentLiveChoice) ringClass = ' border-amber-400 ring-2 ring-amber-300 bg-amber-50/25';

                            return (
                              <button
                                key={o.label}
                                type="button"
                                role="radio"
                                aria-checked={selected === o.label}
                                className={`mp-grid-opt-btn${selected === o.label ? ' selected' : ''}${ringClass}`}
                                onClick={() => {
                                  soundEngine.playClick();
                                  setSelected(o.label);
                                  if (!isStaff && question) {
                                    ably.publishCommand({ op: 'mirror_question_state', userId: myIdRef.current, qid: question.id, selected: o.label });
                                  }
                                }}
                              >
                                <span className="opt-badge">{displayLabel}</span>
                                <span className="flex-1 text-left">{o.content}</span>
                                {isCorrectKey && (
                                  <span className="admin-key-badge ml-2" title="Kunci Jawaban Benar (Admin & Guru)">
                                    ✓ KUNCI JAWABAN
                                  </span>
                                )}
                                {isStudentPickWrong && (
                                  <span
                                    className="ml-2 font-bold text-xs"
                                    title="Opsi yang dipilih siswa (Salah)"
                                    style={{ background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: '6px' }}
                                  >
                                    ❌ Dipilih Siswa (Salah)
                                  </span>
                                )}
                                {isStudentPickCorrect && !isCorrectKey && (
                                  <span
                                    className="ml-2 font-bold text-xs"
                                    title="Opsi yang dipilih siswa (Benar)"
                                    style={{ background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: '6px' }}
                                  >
                                    ✓ Dipilih Siswa (Benar)
                                  </span>
                                )}
                                {isStudentLiveChoice && (
                                  <span
                                    className="ml-2 font-bold text-xs"
                                    title="Siswa sedang memilih opsi ini"
                                    style={{ background: '#f59e0b', color: '#1e1b4b', padding: '2px 8px', borderRadius: '6px' }}
                                  >
                                    👤 Pilihan Siswa
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="mp-q-submit-row">
                        <button type="submit" className="btn-orange-action" disabled={!selected || submitting}>
                          <span aria-hidden="true">✔</span> {submitting ? 'Mengirim...' : isStaff ? 'Bantu Jawab (Centang Biru)' : 'Submit'}
                        </button>
                      </div>
                    </form>
                  </section>
                )}

              </div>
            )}
          </div>

          {actionModalTarget && (
            <div
              className="overlay-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label="Panel Aksi"
              onClick={() => setActionModalTarget(null)}
            >
              <div className="parchment-card admin-action-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="admin-action-header">
                  <div>
                    <div className="admin-action-title">
                      <span aria-hidden="true">{actionModalTarget.target === 'global' ? '🌐' : '⚡'}</span>
                      {actionModalTarget.target === 'global' ? 'Panel Aksi Masal Admin' : `Panel Aksi: ${actionModalTarget.username}`}
                      {actionModalTarget.target !== 'global' && (
                        <button
                          type="button"
                          className="btn-copy-nick text-xs px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 border border-amber-400 font-bold ml-2 text-amber-900 inline-flex items-center gap-1"
                          title={`Salin Username '${actionModalTarget.username}'`}
                          onClick={() => copyPlayerUsername(actionModalTarget.username)}
                        >
                          📋 Salin
                        </button>
                      )}
                    </div>
                    {actionModalTarget.target !== 'global' && (
                      <div className="admin-action-subinfo">
                        {actionModalTarget.fullName && <span>Nama: <strong>{actionModalTarget.fullName}</strong></span>}
                        {actionModalTarget.stage && <span>Stage: <strong>{actionModalTarget.stage}</strong></span>}
                        {actionModalTarget.role && <span>Role: <strong className="capitalize">{actionModalTarget.role}</strong></span>}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="mp-win-btn text-base font-bold text-amber-950 hover:text-black ml-auto"
                    aria-label="Tutup Panel Aksi"
                    onClick={() => setActionModalTarget(null)}
                  >
                    ✕
                  </button>
                </div>

                {actionModalTarget.target === 'global' && isAdmin && (
                  <div className="admin-action-scope-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={actionModalScope === 'here'}
                      className={`admin-action-scope-tab${actionModalScope === 'here' ? ' is-active' : ''}`}
                      onClick={() => setActionModalScope('here')}
                    >
                      📍 Stage Ini ({currentStage})
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={actionModalScope === 'all'}
                      className={`admin-action-scope-tab${actionModalScope === 'all' ? ' is-active' : ''}`}
                      onClick={() => setActionModalScope('all')}
                    >
                      🌐 Seluruh Siswa (All)
                    </button>
                  </div>
                )}

                <div className="admin-action-scroll">
                  {/* 1. TELEPORT */}
                  <div className="admin-action-group">
                    <div className="admin-action-group-title">
                      <span aria-hidden="true">🚀</span> Teleportasi &amp; Posisi
                    </div>
                    <div className="admin-action-grid">
                      {actionModalTarget.target === 'global' ? (
                        <button
                          type="button"
                          className="admin-action-btn btn-cyan"
                          onClick={() => handleChatCommand(`/teleport ${actionModalScope} me`)}
                        >
                          🚀 Tarik {actionModalScope === 'here' ? 'Stage Ini' : 'Semua'} ke Saya
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="admin-action-btn btn-cyan"
                            onClick={() => handleChatCommand(`/teleport ${actionModalTarget.username} me`)}
                          >
                            🚀 Tarik ke Posisi Saya
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn btn-cyan"
                            onClick={() => handleChatCommand(`/teleport ${actionModalTarget.username}`)}
                          >
                            📍 Samperin Player Ini
                          </button>
                          {actionModalTarget.target !== myIdRef.current && (
                            ropedByUserId === actionModalTarget.target ? (
                              <button
                                type="button"
                                className="admin-action-btn btn-rose"
                                onClick={() => handleChatCommand('/unfollow')}
                              >
                                ⛓️ Unfollow ({actionModalTarget.username})
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="admin-action-btn btn-amber"
                                onClick={() => handleChatCommand(`/follow ${actionModalTarget.username}`)}
                              >
                                🪢 Follow ({actionModalTarget.username})
                              </button>
                            )
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* 2. SENJATA / WEAPONS */}
                  <div className="admin-action-group">
                    <div className="admin-action-group-title">
                      <span aria-hidden="true">🔫</span> Senjata &amp; Combat
                    </div>
                    <div className="admin-action-grid admin-action-grid-3">
                      <button
                        type="button"
                        className="admin-action-btn btn-amber"
                        onClick={() => handleChatCommand(`/spawn gun minigun ${actionModalTarget.target === 'global' ? actionModalScope : actionModalTarget.username}`)}
                      >
                        🔫 Minigun
                      </button>
                      <button
                        type="button"
                        className="admin-action-btn btn-amber"
                        onClick={() => handleChatCommand(`/spawn gun laser ${actionModalTarget.target === 'global' ? actionModalScope : actionModalTarget.username}`)}
                      >
                        ⚡ Laser
                      </button>
                      <button
                        type="button"
                        className="admin-action-btn btn-amber"
                        onClick={() => handleChatCommand(`/spawn gun ice ${actionModalTarget.target === 'global' ? actionModalScope : actionModalTarget.username}`)}
                      >
                        🧊 Ice Gun
                      </button>
                      <button
                        type="button"
                        className="admin-action-btn btn-amber"
                        onClick={() => handleChatCommand(`/spawn gun stunt ${actionModalTarget.target === 'global' ? actionModalScope : actionModalTarget.username}`)}
                      >
                        ⚡ Stun Gun
                      </button>
                      <button
                        type="button"
                        className="admin-action-btn btn-rose"
                        onClick={() => handleChatCommand(`/spawn gun none ${actionModalTarget.target === 'global' ? actionModalScope : actionModalTarget.username}`)}
                      >
                        🚫 Tarik Senjata
                      </button>
                    </div>
                  </div>

                  {/* 3. GOD MODE (ADMIN ONLY) */}
                  {isAdmin && (
                    <div className="admin-action-group">
                      <div className="admin-action-group-title">
                        <span aria-hidden="true">👑</span> Mode Kebal (God Mode)
                      </div>
                      <div className="admin-action-grid">
                        <button
                          type="button"
                          className="admin-action-btn btn-gold"
                          onClick={() => handleChatCommand(`/set god ${actionModalTarget.target === 'global' ? actionModalScope : actionModalTarget.username}`)}
                        >
                          👑 Aktifkan God Mode
                        </button>
                        <button
                          type="button"
                          className="admin-action-btn btn-gold"
                          onClick={() => handleChatCommand(`/unset god ${actionModalTarget.target === 'global' ? actionModalScope : actionModalTarget.username}`)}
                        >
                          ❌ Matikan God Mode
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 4. ROPE & SKIP STAGE (ADMIN ONLY) */}
                  {isAdmin && (
                    <div className="admin-action-group">
                      <div className="admin-action-group-title">
                        <span aria-hidden="true">🪢</span> Tali &amp; Bypass Soal (Admin)
                      </div>
                      <div className="admin-action-grid">
                        <button
                          type="button"
                          className="admin-action-btn btn-emerald"
                          onClick={() => handleChatCommand(`/take rope ${actionModalTarget.target === 'global' ? actionModalScope : actionModalTarget.username}`)}
                        >
                          🪢 Ikat Tali (Rope)
                        </button>
                        <button
                          type="button"
                          className="admin-action-btn btn-emerald"
                          onClick={() => handleChatCommand(`/untake rope ${actionModalTarget.target === 'global' ? actionModalScope : actionModalTarget.username}`)}
                        >
                          🪢 Lepas Tali
                        </button>
                        <button
                          type="button"
                          className="admin-action-btn btn-violet"
                          onClick={() => handleChatCommand(`/skip stage ${actionModalTarget.target === 'global' ? actionModalScope : actionModalTarget.username}`)}
                        >
                          ⏩ Luluskan Stage (Skip)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 5. KONTROL & AKSES SISWA (STAFF: ADMIN & GURU) */}
                  <div className="admin-action-group">
                    <div className="admin-action-group-title">
                      <span aria-hidden="true">🛡️</span> Kontrol &amp; Akses Siswa
                    </div>
                    <div className="admin-action-grid">
                      <button
                        type="button"
                        className="admin-action-btn btn-emerald"
                        onClick={() => handleChatCommand(`/enable cmd ${actionModalTarget.target === 'global' ? actionModalScope : actionModalTarget.username}`)}
                      >
                        💬 Beri Akses Cmd
                      </button>
                      <button
                        type="button"
                        className="admin-action-btn btn-rose"
                        onClick={() => handleChatCommand(`/disable cmd ${actionModalTarget.target === 'global' ? actionModalScope : actionModalTarget.username}`)}
                      >
                        🚫 Cabut Akses Cmd
                      </button>

                      {actionModalTarget.target !== 'global' && (
                        <>
                          <button
                            type="button"
                            className="admin-action-btn btn-rose"
                            onClick={() => handleChatCommand(`/jail on ${actionModalTarget.username}`)}
                          >
                            🔒 Penjara (Jail)
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn btn-emerald"
                            onClick={() => handleChatCommand(`/jail off ${actionModalTarget.username}`)}
                          >
                            🔓 Buka Penjara
                          </button>
                        </>
                      )}

                      {actionModalTarget.target !== 'global' ? (
                        <button
                          type="button"
                          className="admin-action-btn btn-cyan"
                          onClick={() => handleChatCommand(`/mirror ${actionModalTarget.username}`)}
                        >
                          🔍 Mirror Soal Siswa
                        </button>
                      ) : isAdmin && actionModalScope === 'all' && (
                        <>
                          <button
                            type="button"
                            className="admin-action-btn btn-cyan"
                            onClick={() => handleChatCommand(`/mirror all`)}
                          >
                            🔍 Mirror Seluruh Kelas
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn btn-cyan"
                            onClick={() => handleChatCommand(`/unset mirror`)}
                          >
                            ❌ Matikan Mirror
                          </button>
                        </>
                      )}

                      {actionModalTarget.target !== 'global' ? (
                        <>
                          <button
                            type="button"
                            className="admin-action-btn btn-gold"
                            onClick={() => handleChatCommand(`/set semiadmin ${actionModalTarget.username}`)}
                          >
                            ⭐ Angkat Semi-Admin
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn btn-rose"
                            onClick={() => handleChatCommand(`/unset semiadmin ${actionModalTarget.username}`)}
                          >
                            🚫 Cabut Semi-Admin
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn btn-rose"
                            onClick={() => handleChatCommand(`/reset ${actionModalTarget.username}`)}
                          >
                            🔄 Reset Soal Siswa
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="admin-action-btn btn-amber"
                            onClick={() => handleChatCommand('/set pvp on')}
                          >
                            ⚔️ Bolehkan Siswa Saling Tembak
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn btn-emerald"
                            onClick={() => handleChatCommand('/set pvp off')}
                          >
                            🕊️ Mode Damai (Tutup PvP Siswa)
                          </button>
                          {isAdmin && actionModalScope === 'all' && (
                            <button
                              type="button"
                              className="admin-action-btn btn-rose"
                              onClick={() => handleChatCommand(`/reset all`)}
                            >
                              🔄 Reset Soal Sekelas
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {settingsModalOpen && (
            <div
              className="overlay-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label="Pengaturan Game"
              onClick={() => setSettingsModalOpen(false)}
            >
              <div className="parchment-card feedback-modal-card settings-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="text-center">
                  <div className="green-arch-ribbon">Pengaturan Game</div>
                </div>

                <div className="settings-section">
                  <div className="settings-section-title">Suara &amp; Musik (BGM)</div>

                  <div className="settings-row">
                    <span className="settings-label">Musik Latar (BGM)</span>
                    <button
                      type="button"
                      className={`settings-toggle-btn ${bgmEnabled ? 'on' : 'off'}`}
                      onClick={() => {
                        const next = !bgmEnabled;
                        setBgmEnabled(next);
                        soundEngine.setBgmEnabled(next);
                        soundEngine.playClick();
                      }}
                    >
                      {bgmEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  <div className="settings-slider-wrap">
                    <div className="settings-row">
                      <span className="settings-label">Volume Musik</span>
                      <span className="settings-val-badge">{Math.round(bgmVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      className="settings-range"
                      min={0}
                      max={100}
                      step={5}
                      value={Math.round(bgmVolume * 100)}
                      onChange={(e) => {
                        const v = Number(e.target.value) / 100;
                        setBgmVolume(v);
                        soundEngine.setBgmVolume(v);
                      }}
                    />
                  </div>

                  <div className="settings-row" style={{ marginTop: 4 }}>
                    <span className="settings-label">Efek Suara (Lompat, Api, Mati, Klik)</span>
                    <button
                      type="button"
                      className={`settings-toggle-btn ${sfxEnabled ? 'on' : 'off'}`}
                      onClick={() => {
                        const next = !sfxEnabled;
                        setSfxEnabled(next);
                        soundEngine.setSfxEnabled(next);
                        if (next) soundEngine.playClick();
                      }}
                    >
                      {sfxEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  <div className="settings-slider-wrap">
                    <div className="settings-row">
                      <span className="settings-label">Volume Efek Suara</span>
                      <span className="settings-val-badge">{Math.round(sfxVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      className="settings-range"
                      min={0}
                      max={100}
                      step={5}
                      value={Math.round(sfxVolume * 100)}
                      onChange={(e) => {
                        const v = Number(e.target.value) / 100;
                        setSfxVolume(v);
                        soundEngine.setSfxVolume(v);
                      }}
                      onPointerUp={() => soundEngine.playJump()}
                    />
                  </div>
                </div>

                <div className="settings-section">
                  <div className="settings-section-title">Ukuran &amp; Posisi Tombol Layar</div>

                  <div className="settings-slider-wrap">
                    <div className="settings-row">
                      <span className="settings-label">Ukuran Tombol (Kiri/Kanan/Lompat)</span>
                      <span className="settings-val-badge">{hudControls.size}px</span>
                    </div>
                    <input
                      type="range"
                      className="settings-range"
                      min={64}
                      max={128}
                      step={2}
                      value={hudControls.size}
                      onChange={(e) => updateHudControls({ size: Number(e.target.value) })}
                    />
                  </div>

                  <div className="settings-slider-wrap">
                    <div className="settings-row">
                      <span className="settings-label">Jarak Tombol Kiri &amp; Kanan</span>
                      <span className="settings-val-badge">{hudControls.gap}px</span>
                    </div>
                    <input
                      type="range"
                      className="settings-range"
                      min={8}
                      max={44}
                      step={2}
                      value={hudControls.gap}
                      onChange={(e) => updateHudControls({ gap: Number(e.target.value) })}
                    />
                  </div>

                  <div className="settings-slider-wrap">
                    <div className="settings-row">
                      <span className="settings-label">Transparansi Tombol</span>
                      <span className="settings-val-badge">{Math.round(hudControls.opacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      className="settings-range"
                      min={35}
                      max={100}
                      step={5}
                      value={Math.round(hudControls.opacity * 100)}
                      onChange={(e) => updateHudControls({ opacity: Number(e.target.value) / 100 })}
                    />
                  </div>

                  <div className="settings-row">
                    <span className="settings-label">Tukar Sisi Kiri &amp; Kanan</span>
                    <button
                      type="button"
                      className={`settings-toggle-btn ${hudControls.swapSides ? 'on' : 'off'}`}
                      onClick={() => {
                        soundEngine.playClick();
                        updateHudControls({ swapSides: !hudControls.swapSides });
                      }}
                    >
                      {hudControls.swapSides ? 'DITUKAR' : 'NORMAL'}
                    </button>
                  </div>

                  <div className="settings-actions-row">
                    <button
                      type="button"
                      className="btn-blue-action"
                      style={{ fontSize: 13, padding: '8px 14px', minHeight: 40, flex: 1 }}
                      onClick={() => {
                        soundEngine.playClick();
                        setSettingsModalOpen(false);
                        setEditingControlsLayout(true);
                      }}
                    >
                      Geser Posisi Tombol di Layar
                    </button>
                    <button
                      type="button"
                      className="btn-orange-action"
                      style={{ fontSize: 13, padding: '8px 14px', minHeight: 40 }}
                      onClick={resetHudControls}
                    >
                      Reset Tombol
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className="btn-green-action"
                    style={{ fontSize: 14, padding: '8px 24px', minHeight: 42 }}
                    onClick={() => {
                      soundEngine.playClick();
                      setSettingsModalOpen(false);
                    }}
                  >
                    Selesai
                  </button>
                </div>
              </div>
            </div>
          )}

          {kickModalOpen && isStaff && (
            <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-label="Kelola Pemain" onClick={() => setKickModalOpen(false)}>
              <div className="parchment-card feedback-modal-card teacher-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="text-center">
                  <div className="green-arch-ribbon">Kelola Pemain</div>
                </div>
                <p className="feedback-subtext text-center" style={{ marginBottom: 8 }}>
                  Keluarkan peserta yang tidak dikenal dari ruang permainan.
                </p>

                {sortedPlayers.filter((pl) => pl.userId !== myIdRef.current && pl.role !== 'admin' && pl.role !== 'teacher').length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <button
                      type="button"
                      className="btn-orange-action"
                      style={{ fontSize: 12, padding: '6px 14px', minHeight: 36 }}
                      onClick={kickAllPlayers}
                    >
                      🚫 Kick Semua Pemain
                    </button>
                  </div>
                )}

                <div className="teacher-list-box">
                  {rejoinRequests.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div
                        className="teacher-q-text"
                        style={{ fontSize: 13, color: '#8c5308', marginBottom: 6 }}
                      >
                        Permintaan Masuk Kembali (Approve = Reset Soal &amp; Poin Sesi ke 0):
                      </div>
                      {rejoinRequests.map((req) => (
                        <div key={req.userId} className="teacher-q-card" style={{ marginBottom: 6 }}>
                          <div className="teacher-q-info">
                            <div className="teacher-q-text">{req.username}</div>
                            <div className="teacher-q-meta">
                              <span>Ingin bergabung ulang setelah di-kick</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button
                              type="button"
                              className="btn-green-action"
                              style={{ fontSize: 12, padding: '6px 12px', minHeight: 36 }}
                              onClick={() => approveRejoin(req.userId)}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn-orange-action"
                              style={{ fontSize: 12, padding: '6px 10px', minHeight: 36 }}
                              onClick={() => rejectRejoin(req.userId)}
                            >
                              Tolak
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {sortedPlayers.filter((pl) => pl.userId !== myIdRef.current).length === 0 &&
                    rejoinRequests.length === 0 ? (
                    <p className="feedback-subtext text-center">Belum ada siswa di dalam ruang.</p>
                  ) : (
                    sortedPlayers
                      .filter((pl) => pl.userId !== myIdRef.current)
                      .map((pl) => (
                        <div key={pl.userId} className="teacher-q-card">
                          <div className="teacher-q-info">
                            <div className="teacher-q-text">
                              {pl.username}
                              {pl.role === 'admin' ? ' (ADMIN)' : pl.role === 'teacher' ? ' (GURU)' : ''}
                            </div>
                            <div className="teacher-q-meta">
                              <span>Skor: {scores[pl.userId] ?? 0} poin</span>
                            </div>
                          </div>
                          {pl.role !== 'admin' && pl.role !== 'teacher' && (
                            <button
                              type="button"
                              className="btn-orange-action"
                              style={{ fontSize: 13, padding: '6px 14px', minHeight: 38, flexShrink: 0 }}
                              onClick={() => kickPlayer(pl.userId)}
                            >
                              Kick
                            </button>
                          )}
                        </div>
                      ))
                  )}
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      className="btn-blue-action"
                      style={{ fontSize: 13, padding: '6px 20px', minHeight: 40 }}
                      onClick={() => setKickModalOpen(false)}
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Floating Preview Mode Banner (Harmonized with game theme) */}
        {(previewBody || previewTag1 || previewColors) && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-full bg-[#2e1502]/95 backdrop-blur-md px-4 py-2 text-white shadow-2xl border-2 border-[#ffba49] max-w-[94vw] overflow-x-auto">
            <span className="text-xs md:text-sm font-bold text-[#ffebcc] flex items-center gap-1.5 flex-wrap">
              <span className="text-[#ffd43b]">Mode Coba:</span>
              {previewBody && <span className="bg-[#4d2602] px-2 py-0.5 rounded-md text-white font-bold uppercase text-[11px] border border-[#8f5626]">{previewBody}</span>}
              {previewTag1 && <span className="bg-[#4d2602] px-2 py-0.5 rounded-md text-[#ffd43b] font-bold text-[11px] border border-[#8f5626]">Gelar: {previewTag1}</span>}
              {previewColors && (
                <span className="bg-[#4d2602] px-2 py-0.5 rounded-md text-[#67e8f9] font-bold text-[11px] border border-[#8f5626]">
                  Warna: {Object.entries(previewColors).map(([k, v]) => `${k}:${v}`).join(', ')}
                </span>
              )}
              <span className="text-[10px] text-[#fcd34d] font-normal hidden sm:inline">(Hanya di layarmu)</span>
            </span>
            <button
              type="button"
              className="rounded-full bg-[#b91c1c] hover:bg-[#dc2626] px-3.5 py-1 text-xs font-bold text-white transition-all shadow shrink-0 border border-[#f87171]"
              onClick={cancelAllPreviews}
            >
              Batal
            </button>
            <button
              type="button"
              className="rounded-full bg-[#ffba49] hover:bg-[#ffa929] px-3.5 py-1 text-xs font-bold text-[#2e1502] transition-all shadow shrink-0 border border-[#753202]"
              onClick={() => setShowShopModal(true)}
            >
              Buka Toko
            </button>
          </div>
        )}

        {/* FINISH CELEBRATION MODAL */}
        {showFinishCelebration && (
          <div className="overlay-backdrop finish-celebration-backdrop" onClick={() => setShowFinishCelebration(false)}>
            <div className="parchment-card feedback-modal-card finish-celebration-card" onClick={(e) => e.stopPropagation()}>
              <div className="wood-header-sign">🏆 SEMUA STAGE SELESAI! 🏆</div>

              <div className="mt-3 text-center">
                <div className="gold-arch-ribbon" style={{ fontSize: '1.2rem', padding: '6px 24px', margin: '4px auto 8px' }}>
                  MISI SELESAI SEMPURNA!
                </div>
              </div>

              {/* Character Celebration Animation Preview */}
              <div className="flex flex-col items-center justify-center my-3 p-3 rounded-2xl bg-[#f5e6c8] border-2 border-[#c9ab81] shadow-inner">
                <FinishCharacterAnimator
                  bodyModel={playersRef.current.get(myIdRef.current)?.bodyModel || 'cat'}
                  avatar={playersRef.current.get(myIdRef.current)?.avatar || 'cat-blue'}
                  nick={playersRef.current.get(myIdRef.current)?.customNick || myFullNameRef.current || myUsernameRef.current || 'Juara'}
                />
                <p className="text-xs font-bold text-[#5c3710] uppercase tracking-wider mt-1">
                  Karakter Juara: {playersRef.current.get(myIdRef.current)?.bodyModel?.toUpperCase() || 'KUCING'}
                </p>
                <div className="flex gap-1 text-2xl mt-0.5">⭐⭐⭐</div>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-2 gap-2 my-2 text-center">
                <div className="p-2 rounded-xl bg-[#fdfaf3] border-2 border-[#d4b58e] shadow-sm">
                  <p className="text-[11px] font-bold text-[#784e27]">Total Poin</p>
                  <p className="text-lg font-black text-[#15803d]">💰 {userPoints.toLocaleString()}</p>
                </div>
                <div className="p-2 rounded-xl bg-[#fdfaf3] border-2 border-[#d4b58e] shadow-sm">
                  <p className="text-[11px] font-bold text-[#784e27]">Soal Dijawab</p>
                  <p className="text-lg font-black text-[#8a5322]">{correctCount} Benar</p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  className="btn-green-action w-full py-2.5 font-bold flex items-center justify-center gap-2"
                  onClick={() => {
                    soundEngine.playClick();
                    setShowFinishCelebration(false);
                    setShowShopModal(true);
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="9" cy="21" r="1.5" fill="currentColor" />
                    <circle cx="19" cy="21" r="1.5" fill="currentColor" />
                    <path d="M2.5 2.5h3l2.4 12.2a2 2 0 0 0 2 1.6h9.2a2 2 0 0 0 2-1.6l1.8-9.4H6.2" />
                  </svg>
                  Buka Toko Karakter &amp; Gelar
                </button>
                <button
                  type="button"
                  className="btn-orange-action w-full py-2 font-bold"
                  onClick={() => {
                    soundEngine.playClick();
                    setShowFinishCelebration(false);
                  }}
                >
                  🎮 Lanjut Jelajah / Main Lagi
                </button>
                {!isStaff && (
                  <button
                    type="button"
                    className="w-full py-2 rounded-xl text-xs font-bold text-[#753202] hover:bg-[#ebd5b2] transition-colors"
                    onClick={() => router.push('/dashboard/student')}
                  >
                    🏠 Selesai &amp; Kembali ke Dashboard
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SHOP MODAL */}
        {showShopModal && (
          <div className="overlay-backdrop" onClick={() => setShowShopModal(false)}>
            <div className="parchment-card feedback-modal-card shop-modal-card max-w-lg w-full max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="wood-header-sign flex items-center justify-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="9" cy="21" r="1.5" fill="currentColor" />
                  <circle cx="19" cy="21" r="1.5" fill="currentColor" />
                  <path d="M2.5 2.5h3l2.4 12.2a2 2 0 0 0 2 1.6h9.2a2 2 0 0 0 2-1.6l1.8-9.4H6.2" />
                </svg>
                <span>TOKO PETUALANG</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b-2 border-[#d4b58e] mt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#5c3710]">Saldo:</span>
                  <span className="settings-val-badge text-xs font-bold text-[#15803d]">
                    {userPoints.toLocaleString()} Poin
                  </span>
                </div>
                <button
                  type="button"
                  className="h-7 w-7 rounded-lg bg-[#d6c5a5] text-[#4a3519] font-bold border-2 border-[#7c6240] hover:bg-[#dfcfb2] transition-all flex items-center justify-center text-xs shadow-sm"
                  onClick={() => setShowShopModal(false)}
                  title="Tutup"
                >
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div className="shop-tab-bar">
                <button
                  type="button"
                  className={`shop-tab-item ${shopTab === 'body' ? 'is-active' : ''}`}
                  onClick={() => setShopTab('body')}
                >
                  <span>Karakter</span>
                  <span className="shop-badge-item text-[10px] py-0.5 px-1.5">{unlockedBodies.length}/7</span>
                </button>
                <button
                  type="button"
                  className={`shop-tab-item ${shopTab === 'tag' ? 'is-active' : ''}`}
                  onClick={() => setShopTab('tag')}
                >
                  <span>Tag &amp; Gelar</span>
                </button>
                <button
                  type="button"
                  className={`shop-tab-item ${shopTab === 'color' ? 'is-active' : ''}`}
                  onClick={() => setShopTab('color')}
                >
                  <span>Warna &amp; Efek</span>
                </button>
              </div>

              {/* 1. Body Tab */}
              {shopTab === 'body' && (
                <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                  {[
                    { id: 'cat', name: 'Kucing Petualang', num: 'Default', desc: 'Karakter utama petualang llysSmart.', price: 0 },
                    { id: 'ulat', name: 'Cacing / Ulat Melar', num: 'Item 1', desc: 'Animasi akordeon melar & mengkerut.', price: shopPrices.body.ulat ?? 5000 },
                    { id: 'burung', name: 'Burung Angkasa', num: 'Item 2', desc: 'Animasi sayap mengepak saat melompat.', price: shopPrices.body.burung ?? 5000 },
                    { id: 'ayam', name: 'Ayam Jago', num: 'Item 3', desc: 'Animasi kepala mengangguk & jengger merah.', price: shopPrices.body.ayam ?? 5000 },
                    { id: 'sapi', name: 'Sapi Padang', num: 'Item 4', desc: 'Animasi 4 kuku melangkah & belang hitam-putih.', price: shopPrices.body.sapi ?? 5000 },
                    { id: 'domba', name: 'Domba Awan', num: 'Item 5', desc: 'Animasi bulu awan gembul membal.', price: shopPrices.body.domba ?? 5000 },
                    { id: 'virus', name: 'Virus Matrix', num: 'Item 6', desc: 'Animasi menggelinding muter saat jalan.', price: shopPrices.body.virus ?? 5000 },
                  ].map((item) => {
                    const isOwned = item.id === 'cat' || unlockedBodies.includes(item.id);
                    const isEquipped = (equippedBody === item.id) && !previewBody;
                    const isPreviewing = previewBody === item.id;
                    const canAfford = userPoints >= item.price;

                    return (
                      <div key={item.id} className={`shop-card-item ${isEquipped ? 'is-active' : ''}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#3b1e02]">{item.name}</span>
                            <span className="shop-badge-item">{item.num}</span>
                            {isOwned && <span className="shop-badge-owned">Milikmu</span>}
                          </div>
                          <p className="text-[11px] text-[#784e27] mt-0.5">{item.desc}</p>
                          {!isOwned && (
                            <p className="text-xs font-bold text-[#8a5322] mt-1">
                              Harga: <span className="text-[#b45309] font-black">{item.price.toLocaleString()} Poin</span>
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {isEquipped ? (
                            <span className="shop-btn-equipped">
                              Dipakai
                            </span>
                          ) : isOwned ? (
                            <button
                              type="button"
                              className="shop-btn-equip"
                              onClick={() => equipBody(item.id)}
                            >
                              Gunakan
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                className={`shop-btn-try ${isPreviewing ? 'is-active' : ''}`}
                                onClick={() => startPreview(item.id)}
                              >
                                {isPreviewing ? 'Mencoba' : 'Coba'}
                              </button>
                              {canAfford ? (
                                <button
                                  type="button"
                                  disabled={shopSubmitting}
                                  className="shop-btn-buy"
                                  onClick={() => buyBody(item.id)}
                                >
                                  Beli
                                </button>
                              ) : (
                                <span className="shop-btn-disabled">
                                  Poin Kurang
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 2. Tag Tab */}
              {shopTab === 'tag' && (
                <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                  <div className="settings-section">
                    <p className="text-xs font-bold text-[#3b1e02]">
                      Gelar aktif (Tag 1): <span className="font-bold text-[#8a5322]">{playersRef.current.get(myIdRef.current)?.tag1 || 'Belum ada'}</span>
                    </p>
                    <p className="text-[11px] text-[#784e27] mt-0.5">
                      Gelar akan melayang tepat di atas kepalamu dan terlihat oleh semua pemain.
                    </p>
                    <p className="text-xs font-bold text-[#8a5322] mt-1">
                      Biaya ganti gelar: <span className="text-[#b45309] font-black">{shopPrices.tag.toLocaleString()} Poin</span> {isStaff && '(Gratis untuk Guru/Admin)'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#3b1e02] mb-1">Ketik Gelar Baru:</label>
                    <input
                      type="text"
                      maxLength={24}
                      placeholder="Contoh: JUARA 1, SULTAN, KODING PRO..."
                      className="w-full rounded-xl border-2 border-[#c9ab81] bg-[#fffcf5] px-3 py-2 text-xs font-bold text-[#3b1e02] focus:outline-none focus:border-[#753202]"
                      value={shopTagInput}
                      onChange={(e) => setShopTagInput(e.target.value)}
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        disabled={!shopTagInput.trim()}
                        className="shop-btn-try flex-1 py-2"
                        onClick={() => startTagPreview(shopTagInput)}
                      >
                        Coba Gelar
                      </button>
                      <button
                        type="button"
                        disabled={!shopTagInput.trim() || shopSubmitting || (!isStaff && userPoints < shopPrices.tag)}
                        className={`flex-1 py-2 ${(!isStaff && userPoints < shopPrices.tag) || !shopTagInput.trim() ? 'shop-btn-disabled' : 'shop-btn-buy'}`}
                        onClick={() => buyTag1(shopTagInput.trim())}
                      >
                        {shopSubmitting ? 'Memproses...' : `Beli & Pasang (${isStaff ? 'Gratis' : `${shopPrices.tag.toLocaleString()} Poin`})`}
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold text-[#784e27] mb-1.5">Pilihan Gelar Cepat:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['JUARA 1', 'MASTER KODING', 'SULTAN', 'SPEEDRUNNER', 'LEGEND', 'GUARDIAN', 'PRO GAMER'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className="px-2.5 py-1 rounded-lg bg-[#fffcf5] border-2 border-[#d4b58e] hover:border-[#8a5322] hover:bg-[#faebd7] text-xs font-bold text-[#5c3710] transition-all shadow-sm"
                          onClick={() => setShopTagInput(preset)}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Color Tab */}
              {shopTab === 'color' && (
                <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                  <div className="settings-section">
                    <p className="text-xs font-bold text-[#3b1e02]">Kustomisasi Warna Tubuh, Gelar &amp; Nama</p>
                    <p className="text-[11px] text-[#784e27] mt-0.5">
                      Biaya: Warna Statis 1.000 Poin | Warna Animasi Pelangi RGB 5.000 Poin
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#3b1e02] mb-1">Pilih Bagian yang Diwarnai:</label>
                    <div className="flex gap-2">
                      {[
                        { id: 'body', label: 'Tubuh Karakter' },
                        { id: 'tag1', label: 'Gelar Tag 1' },
                        { id: 'nick', label: 'Nama Lengkap' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${shopColorPart === p.id ? 'bg-[#ffba49] text-[#3b1e02] border-[#753202] shadow' : 'bg-[#fffcf5] border-[#c9ab81] text-[#784e27] hover:bg-[#faebd7]'}`}
                          onClick={() => setShopColorPart(p.id as 'body' | 'tag1' | 'nick')}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#3b1e02] mb-1">Pilih Mode Warna:</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${shopColorMode === 'static' ? 'bg-[#ffba49] text-[#3b1e02] border-[#753202] shadow' : 'bg-[#fffcf5] border-[#c9ab81] text-[#784e27] hover:bg-[#faebd7]'}`}
                        onClick={() => setShopColorMode('static')}
                      >
                        Warna Statis (1.000 Poin)
                      </button>
                      <button
                        type="button"
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${shopColorMode === 'rgb' ? 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500 text-white border-[#5a1a1a] shadow' : 'bg-[#fffcf5] border-[#c9ab81] text-[#784e27] hover:bg-[#faebd7]'}`}
                        onClick={() => setShopColorMode('rgb')}
                      >
                        Pelangi RGB (5.000 Poin)
                      </button>
                    </div>
                  </div>

                  {shopColorMode === 'static' && (
                    <div>
                      <label className="block text-xs font-bold text-[#5c3710] mb-1">Pilih Warna:</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={shopColorVal}
                          onChange={(e) => setShopColorVal(e.target.value)}
                          className="h-9 w-14 rounded-lg border-2 border-[#c9ab81] bg-[#fffcf5] cursor-pointer"
                        />
                        <div className="flex flex-wrap gap-1">
                          {['#ffd43b', '#60a5fa', '#34d399', '#f87171', '#c084fc', '#f472b6', '#ffffff'].map((c) => (
                            <button
                              key={c}
                              type="button"
                              className="h-7 w-7 rounded-full border-2 border-[#8a5322] shadow-sm transition-transform hover:scale-110"
                              style={{ background: c }}
                              onClick={() => setShopColorVal(c)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      className="shop-btn-try flex-1 py-2.5"
                      onClick={() => startColorPreview(shopColorPart, shopColorMode, shopColorVal)}
                    >
                      Coba Warna
                    </button>
                    <button
                      type="button"
                      disabled={shopSubmitting || (!isStaff && userPoints < (shopColorMode === 'rgb' ? 5000 : 1000))}
                      className={`flex-1 py-2.5 ${!isStaff && userPoints < (shopColorMode === 'rgb' ? 5000 : 1000) ? 'shop-btn-disabled' : 'shop-btn-buy'}`}
                      onClick={() => buyColor(shopColorPart, shopColorMode, shopColorVal)}
                    >
                      Beli ({shopColorMode === 'rgb' ? '5.000' : '1.000'} Poin)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {feedback && (
                                                                                          <div className="overlay-backdrop" role="dialog" aria-modal="true">
                                                                                            <div className="parchment-card feedback-modal-card">
                                                                                              <div className="green-arch-ribbon">{feedback.isCorrect ? 'Jawaban Benar!' : 'Jawaban Salah'}</div>

                                                                                              <div className="big-star-wrap" aria-hidden="true">
                                                                                                <svg width="96" height="96" viewBox="0 0 64 64">
                                                                                                  <polygon
                                                                                                    points="32,4 40.5,21.5 60,24.3 46,38 49.3,57.2 32,48 14.7,57.2 18,38 4,24.3 23.5,21.5"
                                                                                                    fill={feedback.isCorrect ? '#ffd43b' : '#d9c9a8'}
                                                                                                    stroke="#8c5308"
                                                                                                    strokeWidth="3.5"
                                                                                                    strokeLinejoin="round"
                                                                                                  />
                                                                                                </svg>
                                                                                              </div>

                                                                                              <p className="feedback-star-bonus">+{feedback.pointsEarned} Poin</p>
                                                                                              <p className="feedback-subtext">
                                                                                                {feedback.isCorrect
                                                                                                  ? 'Mantap! Soal yang kamu jawab dinyatakan BENAR.'
                                                                                                  : 'Jawaban kamu pada soal yang sudah dijawab ini dinyatakan SALAH.'}
                                                                                              </p>

                                                                                              <button
                                                                                                type="button"
                                                                                                className="btn-green-action"
                                                                                                onClick={() => {
                                                                                                  setFeedback(null);
                                                                                                  questionRef.current = null;
                                                                                                  setQuestion(null);
                                                                                                }}
                                                                                              >
                                                                                                Oke <span aria-hidden="true">▶</span>
                                                                                              </button>
                                                                                            </div>
                                                                                          </div>
                                                                                        )}

                                                                                        {room?.status === 'paused' && !exitNotice && (
                                                                                          <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-label="Room Dijeda">
                                                                                            <div className="parchment-card feedback-modal-card">
                                                                                              <p className="feedback-subtext" style={{ marginTop: 4 }}>
                                                                                                {isStaff
                                                                                                  ? 'Room sedang dijeda. Semua pergerakan siswa dikunci.'
                                                                                                  : 'Room sedang dijeda, menunggu aksi dari guru...'}
                                                                                              </p>
                                                                                              {isStaff && (
                                                                                                <button
                                                                                                  type="button"
                                                                                                  className="btn-green-action"
                                                                                                  onClick={togglePauseGame}
                                                                                                >
                                                                                                  Lanjutkan Game
                                                                                                </button>
                                                                                              )}
                                                                                            </div>
                                                                                          </div>
                                                                                        )}

                                                                                        {exitNotice && (
                                                                                          <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-label="Notifikasi Ruang">
                                                                                            <div className="parchment-card feedback-modal-card">
                                                                                              <p className="feedback-subtext" style={{ marginTop: 4 }}>
                                                                                                {exitNotice === 'kicked'
                                                                                                  ? 'Kamu telah dikeluarkan dari ruang permainan ini oleh guru.'
                                                                                                  : 'Room game ini telah dihapus oleh guru.'}
                                                                                              </p>
                                                                                              <button
                                                                                                type="button"
                                                                                                className="btn-orange-action"
                                                                                                onClick={() => {
                                                                                                  router.replace(isStaff ? '/dashboard/teacher/rooms' : '/dashboard/student');
                                                                                                }}
                                                                                              >
                                                                                                Kembali ke Dashboard
                                                                                              </button>
                                                                                            </div>
                                                                                          </div>
                                                                                        )}
                                                                                    </div>
                                                                                  </main>
                                                                                  );
}
