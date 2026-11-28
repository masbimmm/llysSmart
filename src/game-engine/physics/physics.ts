import { DECOR, PHYSICS, PLATFORMS, WORLD, rectsOverlap, type Platform, type StageBoss, type StageEnemy, type StagePowerUp } from '../maps/world';

export type Player = {
  id: string;
  username: string;
  fullName?: string;
  avatar: string;
  role?: string;
  stage?: number;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  ridingPlayerId?: string | null;
  lastCarrierX?: number;
  ridingPlatform?: Platform | null;
  spawnX?: number;
  spawnY?: number;
  isDying?: boolean;
  deathStartedAt?: number;
  burnUntil?: number;
  blasterAmmo?: number;
  frozenUntil?: number;
  frozenDeathAt?: number;
  stunnedUntil?: number;
  frozenByShooterId?: string;
  frozenByWeapon?: string;
  blasterUntil?: number;
  isGodMode?: boolean;
  lastOnGroundAt?: number;
  jumpBufferedUntil?: number;
  lastPacketAt?: number;
  avgInterval?: number;
  snapshots?: { x: number; y: number; vx: number; vy: number; time: number }[];
  jailedUntil?: number;
  gun?: string | null;
  hasAdminGun?: boolean;
  tag?: string | null;
  tag1?: string | null;
  tag2?: string | null;
  tag3?: string | null;
  customNick?: string | null;
  originalFullName?: string | null;
  bodyModel?: string;
  customColors?: Record<string, string> | null;
  colors?: { body?: string; tag?: string; tag1?: string; tag2?: string; tag3?: string; nick?: string } | null;
  ropedById?: string | null;
  // Posisi terakhir admin yang mengikat tali (untuk safe-respawn di belakang admin)
  adminAnchor?: { x: number; y: number };
  adminFacing?: 1 | -1;
  hp?: number;
  maxHp?: number;
  lastHitAt?: number;
};

export type Projectile = {
  id: string;
  x: number;
  y: number;
  vx: number;
  shooterId: string;
  stage: number;
  createdAt: number;
  // Admin weapon rounds (/spawn gun): membawa damage & tampilan berbeda
  kind?: 'blaster' | 'admin-round';
  damage?: number;
  color?: string;
  glow?: string;
  length?: number;
  thickness?: number;
  weapon?: 'minigun' | 'laser' | 'megalaser' | 'ice' | 'stunt';
  // Role-based hit rules: role penembak (admin/teacher/student), dibawa juga di projectile remote
  shooterRole?: string;
};

export type BossProjectile = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bossId: string;
  stage: number;
  createdAt: number;
};

const PLAYER_W = 36;
const PLAYER_H = 44;

// Boss ranged attack tuning
const BOSS_PATROL_SPEED = 0.045; // px per ms
const BOSS_ATTACK_INTERVAL = 2600; // ms between spits
const BOSS_ATTACK_WINDUP = 700; // telegraph before the spit launches
const BOSS_SPIT_SPEED = 0.22; // horizontal px per ms
const BOSS_SPIT_LIFETIME = 4200;

function isSolidBox(type: string) {
  return type === 'crate' || type === 'qblock' || type === 'qblock-correct' || type === 'qblock-wrong' || type === 'qblock-assisted';
}

function isQuestionBox(type: string) {
  return type === 'qblock' || type === 'qblock-correct' || type === 'qblock-wrong' || type === 'qblock-assisted';
}

function respawnToStart(p: Player, onRespawn?: (p: Player) => void) {
  p.isDying = false;
  p.deathStartedAt = undefined;
  p.burnUntil = undefined;
  p.hp = 5;
  if (p.hasAdminGun && p.gun) {
    p.blasterAmmo = Infinity;
    p.blasterUntil = undefined;
  } else {
    p.gun = null;
    p.blasterAmmo = 0;
    p.blasterUntil = undefined;
  }
  p.x = p.spawnX ?? 120;
  p.y = p.spawnY ?? WORLD.groundY - PLAYER_H - 20;
  // Player yang diikat tali admin: respawn di belakang admin (bukan spawn point),
  // supaya leash langsung narik dia ke stage admin & tidak infinite respawn nembus lantai
  if (p.ropedById && p.adminAnchor) {
    const side = p.adminFacing === 1 ? -1 : 1;
    p.x = p.adminAnchor.x + side * 60;
    p.y = p.adminAnchor.y;
  }
  p.vx = 0;
  p.vy = 0;
  p.onGround = false;
  p.ridingPlayerId = null;
  p.lastCarrierX = undefined;
  p.ridingPlatform = null;
  onRespawn?.(p);
}

export function updateStageEntities(
  basePlatforms: Platform[],
  enemies: StageEnemy[],
  dtScale = 1,
  now = Date.now(),
  powerUps: StagePowerUp[] = [],
  projectiles: Projectile[] = [],
  onProjectileHitEnemy?: (projId: string, enemyId: string) => void,
  bosses?: StageBoss[],
  onProjectileHitBoss?: (projId: string, bossId: string, damage?: number) => void,
  bossProjectiles: BossProjectile[] = [],
  onBossSpit?: (evt: { bid: string; pid: string; x: number; y: number; vx: number; vy: number }) => void,
  onBossHitPlayer?: (playerId: string, bossId: string) => void,
  players?: Player[],
  myPlayerId?: string,
) {
  for (const plat of basePlatforms) {
    if (plat.type === 'moving' || plat.type === 'plane') {
      const bx = plat.baseX ?? plat.x;
      const by = plat.baseY ?? plat.y;
      const range = plat.moveRange ?? (plat.type === 'plane' ? 320 : 90);
      const speed = plat.moveSpeed ?? (plat.type === 'plane' ? 0.002 : 0.0022);
      const phase = plat.movePhase ?? 0;
      const offset = Math.sin(now * speed + phase) * range;
      const prevX = plat.x;
      const prevY = plat.y;
      if (plat.moveAxis === 'y') {
        plat.y = by + offset;
        plat.dx = 0;
        plat.dy = plat.y - prevY;
      } else {
        plat.x = bx + offset;
        plat.dx = plat.x - prevX;
        plat.dy = plat.type === 'plane' ? Math.sin(now * 0.003 + phase) * 6 : 0;
      }
    } else if (plat.type === 'crumble') {
      if (plat.crumbleStartedAt) {
        const elapsed = now - plat.crumbleStartedAt;
        if (elapsed >= 9500) {
          plat.brokenUntil = undefined;
          plat.crumbleStartedAt = undefined;
        } else if (elapsed >= 4500) {
          plat.brokenUntil = plat.crumbleStartedAt + 9500;
        }
      } else if (plat.brokenUntil && now >= plat.brokenUntil) {
        plat.brokenUntil = undefined;
      }
    }
  }

  for (const enemy of enemies) {
    if (enemy.stompedUntil && enemy.stompedUntil > now) continue;
    const span = (enemy.maxX - enemy.w) - enemy.minX;
    if (span <= 0) continue;
    const speedPxPerMs = enemy.speed * 0.06;
    const halfPeriod = span / speedPxPerMs;
    const fullPeriod = 2 * halfPeriod;
    const idOffset = (enemy.id.charCodeAt(0) * 499) + ((enemy.id.charCodeAt(1) || 0) * 137);
    const t = ((now + idOffset) % fullPeriod + fullPeriod) % fullPeriod;
    if (t < halfPeriod) {
      enemy.x = enemy.minX + t * speedPxPerMs;
      enemy.dir = 1;
    } else {
      enemy.x = (enemy.maxX - enemy.w) - (t - halfPeriod) * speedPxPerMs;
      enemy.dir = -1;
    }
  }

  // Boss patrol: deterministic pacing between minX and maxX (mirrors enemy patrol)
  for (const b of bosses ?? []) {
    if (!b.alive) continue;
    const minX = b.minX ?? b.x - 120;
    const maxX = b.maxX ?? b.x + 120;
    const span = (maxX - b.w) - minX;
    if (span <= 0) continue;
    const halfPeriod = span / BOSS_PATROL_SPEED;
    const fullPeriod = 2 * halfPeriod;
    const idOffset = (b.id.charCodeAt(0) * 499) + ((b.id.charCodeAt(1) || 0) * 137);
    const t = ((now + idOffset) % fullPeriod + fullPeriod) % fullPeriod;
    if (t < halfPeriod) {
      b.x = minX + t * BOSS_PATROL_SPEED;
      b.dir = 1;
    } else {
      b.x = (maxX - b.w) - (t - halfPeriod) * BOSS_PATROL_SPEED;
      b.dir = -1;
    }

    // Ranged attack: telegraph first, then spit toward the nearest player
    if (b.nextAttackAt === undefined) b.nextAttackAt = now + 900;
    if (b.attackUntil && b.attackUntil <= now && b.attackUntil > 0) {
      // windup finished: launch the spit
      b.attackUntil = 0;
      const pid = `bsp_${b.id}_${now}`;
      const originX = b.x + b.w / 2 + (b.dir ?? 1) * (b.w * 0.45);
      const originY = b.y + b.h * 0.42;
      let vx = (b.dir ?? 1) * BOSS_SPIT_SPEED;
      const nearest = (players ?? []).reduce<Player | null>((best, pl) => {
        if (!pl || pl.isDying || (pl.stage ?? 1) !== b.stage) return best;
        return !best || Math.abs(pl.x - b.x) < Math.abs(best.x - b.x) ? pl : best;
      }, null);
      if (nearest) {
        const dx = nearest.x + PLAYER_W / 2 - originX;
        const travel = BOSS_SPIT_LIFETIME * 0.55;
        vx = Math.max(-0.34, Math.min(0.34, dx / travel));
      }
      bossProjectiles.push({
        id: pid,
        x: originX,
        y: originY,
        vx,
        vy: 0.0025,
        bossId: b.id,
        stage: b.stage,
        createdAt: now,
      });
      onBossSpit?.({ bid: b.id, pid, x: originX, y: originY, vx, vy: 0.0025 });
    } else if ((!b.attackUntil || b.attackUntil <= 0) && now >= b.nextAttackAt) {
      b.attackUntil = now + BOSS_ATTACK_WINDUP;
      b.nextAttackAt = now + BOSS_ATTACK_INTERVAL;
    }
  }

  // Boss projectiles: move, arc, hit players
  for (let i = bossProjectiles.length - 1; i >= 0; i -= 1) {
    const bp = bossProjectiles[i];
    bp.x += bp.vx * dtScale;
    bp.y += bp.vy * dtScale;
    const bBox = { x: bp.x - 10, y: bp.y - 10, w: 20, h: 20 };
    let consumed = false;
    for (const pl of players ?? []) {
      if (pl.isDying || (pl.stage ?? 1) !== bp.stage) continue;
      const plBox = { x: pl.x + 4, y: pl.y + 4, w: PLAYER_W - 8, h: PLAYER_H - 8 };
      if (rectsOverlap(bBox, plBox)) {
        if (!pl.isGodMode) onBossHitPlayer?.(pl.id, bp.bossId);
        consumed = true;
        break;
      }
    }
    if (consumed || bp.x < -40 || bp.x > WORLD.width + 40 || bp.y > WORLD.height + 60 || now - bp.createdAt > BOSS_SPIT_LIFETIME) {
      bossProjectiles.splice(i, 1);
    }
  }

  // Update powerup item respawn timers
  for (const pu of powerUps) {
    if (pu.collectedUntil && now >= pu.collectedUntil) {
      pu.collectedUntil = undefined;
    }
  }

  // Update projectiles (lasers)
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const pr = projectiles[i];
    pr.x += pr.vx * dtScale;
    const pBox = { x: pr.x - 12, y: pr.y - 7, w: 24, h: 14 };
    let hit = false;
    for (const e of enemies) {
      if (e.stompedUntil && e.stompedUntil > now) continue;
      const eHitbox = { x: e.x + 2, y: e.y + 2, w: e.w - 4, h: e.h - 4 };
      if (rectsOverlap(pBox, eHitbox)) {
        e.stompedUntil = now + 9000;
        onProjectileHitEnemy?.(pr.id, e.id);
        hit = true;
        break;
      }
    }
    for (const b of bosses ?? []) {
      if (!b.alive) continue;
      const bHitbox = { x: b.x + 8, y: b.y + 8, w: b.w - 16, h: b.h - 16 };
      if (rectsOverlap(pBox, bHitbox)) {
        const isMyShot = !pr.shooterId || !myPlayerId || pr.shooterId === myPlayerId;
        if (isMyShot) {
          b.hp = Math.max(0, b.hp - (pr.damage ?? 1));
          b.hitFlashUntil = now + 120;
          if (b.hp <= 0) b.alive = false;
          onProjectileHitBoss?.(pr.id, b.id, pr.damage ?? 1);
        } else {
          b.hitFlashUntil = now + 120;
        }
        hit = true;
        break;
      }
    }
    const isStudentRound = pr.shooterRole === 'student' || pr.shooterRole === 'semiadmin';
    const maxLife = isStudentRound ? 800 : 3200; // Peluru siswa jarak tempuh dekat-menengah (~800ms)
    if (hit || pr.x < 0 || pr.x > WORLD.width || now - pr.createdAt > maxLife) {
      projectiles.splice(i, 1);
    }
  }
}

export type PhysicsSoundEvent = 'jump' | 'bounce' | 'burn' | 'death' | 'bossSpit';

// Rule tembakan antar player:
// 1. Siswa gabisa nembak ke player lain (cuma monster/bola), KECUALI Guru mengaktifkan /set pvp on
// 2. Guru bisa nembak ke siswa, tapi gabisa ke admin (dan sesama guru)
// 3. Admin bisa nembak kesiapapun, baik siswa maupun guru
// 4. Semi-admin (ketua kelas, diberi staff) mengikuti aturan Guru
export function canShooterHitTarget(
  shooterRole: string | undefined,
  targetRole: string | undefined,
  isPvpEnabled = true,
): boolean {
  const sRole = (shooterRole ?? 'student').toLowerCase();
  const tRole = (targetRole ?? 'student').toLowerCase();

  // Siswa: default gabisa nembak player lain. Kalau Guru mengaktifkan PvP, boleh sesama siswa.
  if (sRole === 'student') {
    if (tRole === 'teacher' || tRole === 'admin') return false;
    return isPvpEnabled && tRole === 'student';
  }
  // Semi-admin: seperti Guru (boleh ke siswa, tidak ke admin/guru)
  if (sRole === 'semiadmin') {
    return tRole === 'student' || tRole === 'semiadmin';
  }
  // Guru bisa tembak siswa, tapi gabisa tembak Admin atau sesama Guru
  if (sRole === 'teacher') {
    return tRole === 'student' || tRole === 'semiadmin';
  }
  // Admin bisa tembak siapapun
  if (sRole === 'admin') {
    return true;
  }
  return false;
}

export function updatePlayerPhysics(
  p: Player,
  input: { left: boolean; right: boolean; jump: boolean },
  otherPlayers: Iterable<Player> = [],
  extraPlatforms: Platform[] = [],
  onTouchQuestionBlock?: (questionId: string) => void,
  dtScale = 1,
  onSoundEvent?: (event: PhysicsSoundEvent) => void,
  stageOptions?: {
    basePlatforms?: Platform[];
    enemies?: StageEnemy[];
    bosses?: StageBoss[];
    powerUps?: StagePowerUp[];
    isGateUnlocked?: boolean;
    onEnterGate?: () => void;
    onLockedGateTouch?: () => void;
    isStaff?: boolean;
    onObstacleEvent?: (
      evt:
        | { op: 'crumble'; stg: number; idx: number; at: number }
        | { op: 'stomp'; stg: number; id: string; until: number }
        | { op: 'powerup'; stg: number; id: string; until: number }
        | { op: 'shoot'; stg: number; pid: string; x: number; y: number; vx: number }
        | { op: 'boss_hit'; stg: number; bid: string; dmg: number }
        | { op: 'boss_died'; stg: number },
    ) => void;
    onCollectPowerUp?: (pu: StagePowerUp) => void;
    onRespawn?: (p: Player) => void;
    bossProjectiles?: BossProjectile[];
    isPvpEnabled?: boolean;
    playerRounds?: { id?: string; x: number; y: number; vx?: number; shooterId: string; damage?: number; len?: number; w?: number; h?: number; weapon?: string; shooterRole?: string }[];
    onPlayerHitByRound?: (victimId: string, shooterId: string, dmg: number, weapon?: string, projId?: string) => void;
    myPlayerId?: string;
  },
) {
  const now = Date.now();

  // Incoming weapon rounds kena ke local player `p` (cek dulu sebelum jail early-return)
  // Mode God kebal rintangan map (duri/monster/lahar), tapi tetap bisa ditembak oleh player
  if (!p.ropedById && !p.isDying) {
    const pBox = { x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H };
    for (const pr of stageOptions?.playerRounds ?? []) {
      if (pr.shooterId === p.id) continue;
      const shooterRole = pr.shooterRole ?? 'student';
      if (!canShooterHitTarget(shooterRole, p.role, stageOptions?.isPvpEnabled !== false)) continue;

      const rW = pr.w ?? 28;
      const rH = pr.h ?? 18;
      const isBigRound = (pr.len ?? 0) > 100;
      const bigH = isBigRound ? Math.max(rH, 120) : rH;
      const len = pr.len ?? rW;
      const dir = (pr.vx ?? 1) >= 0 ? 1 : -1;
      const rX = dir === 1 ? pr.x - len : pr.x;
      const rBox = { x: rX, y: pr.y - bigH / 2, w: Math.max(rW, len), h: bigH };

      if (rectsOverlap(rBox, pBox)) {
        // 1 Peluru 1 Target: konsumsi peluru agar tidak mengenai target lain
        const rIdx = stageOptions?.playerRounds ? stageOptions.playerRounds.indexOf(pr) : -1;
        if (rIdx >= 0) stageOptions?.playerRounds?.splice(rIdx, 1);
        const isIce = pr.weapon === 'ice';
        const isStunt = pr.weapon === 'stunt';
        if (isIce) {
          p.isDying = false;
          p.frozenUntil = now + 1200;
          p.frozenDeathAt = now + 1200;
          p.frozenByShooterId = pr.shooterId;
          p.frozenByWeapon = 'ice';
          p.vx = (p.x < pr.x ? -4 : 4);
          p.vy = -3.5;
          p.onGround = false;
          stageOptions?.onPlayerHitByRound?.(p.id, pr.shooterId, pr.damage ?? 1, 'ice', pr.id);
          return;
        }
        if (isStunt) {
          p.isDying = false;
          p.frozenUntil = now + 1200;
          p.frozenDeathAt = now + 1200;
          p.stunnedUntil = now + 1200;
          p.frozenByShooterId = pr.shooterId;
          p.frozenByWeapon = 'stunt';
          p.vx = 0;
          p.vy = 0;
          stageOptions?.onPlayerHitByRound?.(p.id, pr.shooterId, pr.damage ?? 1, 'stunt', pr.id);
          return;
        }

        // Mode Saling Tembak Siswa (PvP): 5x kena tembak baru gugur
        const isStudentPvPHit = shooterRole === 'student' && p.role === 'student';
        if (isStudentPvPHit && stageOptions?.isPvpEnabled !== false) {
          if (p.lastHitAt && now - p.lastHitAt < 200) {
            // i-frame 200ms per player agar tidak kena double hit instan
            continue;
          }
          const currentHp = typeof p.hp === 'number' ? p.hp : 5;
          const nextHp = Math.max(0, currentHp - 1);
          p.hp = nextHp;
          p.lastHitAt = now;
          if (nextHp > 0) {
            p.vx = p.x < pr.x ? -3.8 : 3.8;
            p.vy = -3;
            p.onGround = false;
            onSoundEvent?.('bounce');
            stageOptions?.onPlayerHitByRound?.(p.id, pr.shooterId, 1, pr.weapon, pr.id);
            return;
          }
          p.hp = 0;
        }

        p.isDying = true;
        p.deathStartedAt = now;
        p.vx = 0;
        p.vy = -13.2;
        p.onGround = false;
        p.ridingPlayerId = null;
        p.lastCarrierX = undefined;
        p.ridingPlatform = null;
        p.jailedUntil = undefined;
        onSoundEvent?.('death');
        stageOptions?.onPlayerHitByRound?.(p.id, pr.shooterId, pr.damage ?? 1, pr.weapon, pr.id);
        return;
      }
    }
  }
  // Jailed: dibekukan admin, tidak bisa gerak & lompat sampai jailedUntil lewat
  if (p.jailedUntil && p.jailedUntil > now) {
    p.vx = 0;
    p.vy = 0;
    return;
  }

  // Ice/Stunt weapon effect: player dibekukan/dikejut sesaat (1.2s) lalu mati
  if (p.frozenUntil && p.frozenUntil > now) {
    if (p.stunnedUntil && p.stunnedUntil > now) {
      // Stunt: getar kecil di tempat (efek kena listrik)
      p.vx = (Math.random() - 0.5) * 1.2;
      p.vy = 0;
    }
    // Ice: biarkan momentum dorongan jalan (nx dorongan mundur), ga bisa input
    if (p.frozenDeathAt && now >= p.frozenDeathAt) {
      p.isDying = true;
      p.deathStartedAt = now;
      p.vx = 0;
      p.vy = -13.2;
      p.onGround = false;
      p.frozenUntil = undefined;
      p.frozenDeathAt = undefined;
      p.stunnedUntil = undefined;
      onSoundEvent?.('death');
      stageOptions?.onPlayerHitByRound?.(p.id, p.frozenByShooterId ?? '', 1, p.frozenByWeapon);
      return;
    }
    return;
  }
  if (p.frozenUntil && p.frozenUntil <= now) {
    p.frozenUntil = undefined;
    p.frozenDeathAt = undefined;
    p.stunnedUntil = undefined;
    p.frozenByShooterId = undefined;
    p.frozenByWeapon = undefined;
  }

  // Super Mario Bros style death animation sequence when hitting spikes or enemies
  if (p.isDying) {
    const elapsed = now - (p.deathStartedAt ?? now);
    // 0-180ms: freeze in shock before flying up & falling through screen
    if (elapsed >= 180) {
      const prevVy = p.vy;
      p.vy = Math.min(p.vy + PHYSICS.gravity * 0.92 * dtScale, PHYSICS.maxFallSpeed);
      const stepVy = Math.min(prevVy + 0.5 * PHYSICS.gravity * 0.92 * (dtScale + 1), PHYSICS.maxFallSpeed);
      p.y += stepVy * dtScale;
    }
    if (elapsed >= 1200 || p.y > WORLD.height + 240) {
      respawnToStart(p, stageOptions?.onRespawn);
    }
    return;
  }

  const basePlats = stageOptions?.basePlatforms ?? PLATFORMS;
  const allPlatforms = extraPlatforms.length > 0 ? [...basePlats, ...extraPlatforms] : basePlats;
  const isBurning = Boolean(p.burnUntil && p.burnUntil > now);
  const activeMoveSpeed = isBurning ? PHYSICS.moveSpeed * 1.2 : PHYSICS.moveSpeed;

  // Carry player when standing on a moving platform
  if (p.ridingPlatform && (p.ridingPlatform.type === 'moving' || p.ridingPlatform.type === 'plane')) {
    p.x += p.ridingPlatform.dx ?? 0;
    p.y += p.ridingPlatform.dy ?? 0;
  }

  // Carry rider horizontally when standing on another player
  if (p.ridingPlayerId) {
    for (const other of otherPlayers) {
      if (other.id === p.ridingPlayerId) {
        if ((other.stage ?? 1) !== (p.stage ?? 1)) {
          p.ridingPlayerId = null;
          p.lastCarrierX = undefined;
          break;
        }
        if (p.lastCarrierX !== undefined) {
          const carrierDx = other.x - p.lastCarrierX;
          if (Math.abs(carrierDx) < 120) {
            p.x += carrierDx;
          }
        }
        p.lastCarrierX = other.x;
        break;
      }
    }
  }

  if (input.left) {
    p.vx = -activeMoveSpeed;
    p.facing = -1;
  } else if (input.right) {
    p.vx = activeMoveSpeed;
    p.facing = 1;
  } else {
    p.vx *= Math.pow(0.6, dtScale);
    if (Math.abs(p.vx) < 0.1) p.vx = 0;
  }

  if (p.onGround) {
    p.lastOnGroundAt = now;
  }
  if (input.jump) {
    p.jumpBufferedUntil = now + 160;
  }

  const canCoyoteJump = p.onGround || (p.lastOnGroundAt && now - p.lastOnGroundAt <= 120);
  const wantsJump = Boolean(input.jump || (p.jumpBufferedUntil && now <= p.jumpBufferedUntil));

  if (wantsJump && canCoyoteJump && !p.isDying && !p.frozenUntil && !p.stunnedUntil) {
    p.vy = PHYSICS.jumpVelocity;
    p.onGround = false;
    p.lastOnGroundAt = undefined;
    p.jumpBufferedUntil = undefined;
    p.ridingPlayerId = null;
    p.lastCarrierX = undefined;
    p.ridingPlatform = null;
    onSoundEvent?.('jump');
  }

  const prevVy = p.vy;
  p.vy = Math.min(p.vy + PHYSICS.gravity * dtScale, PHYSICS.maxFallSpeed);
  const stepVy = Math.min(prevVy + 0.5 * PHYSICS.gravity * (dtScale + 1), PHYSICS.maxFallSpeed);

  const prevX = p.x;
  p.x += p.vx * dtScale;
  p.x = Math.max(0, Math.min(WORLD.width - PLAYER_W, p.x));

  // Horizontal collision with solid block obstacles (crates, qblocks)
  const hBox = { x: p.x, y: p.y + 4, w: PLAYER_W, h: PLAYER_H - 8 };

  for (const plat of allPlatforms) {
    if (p.ropedById) continue; // diikat tali: tembus obstacle (collision false)
    if (!isSolidBox(plat.type)) continue;
    if (!rectsOverlap(hBox, plat)) continue;
    if (prevX + PLAYER_W <= plat.x + 4) {
      p.x = plat.x - PLAYER_W;
      p.vx = 0;
      if (isQuestionBox(plat.type) && plat.questionId && onTouchQuestionBlock) {
        onTouchQuestionBlock(plat.questionId);
      }
    } else if (prevX >= plat.x + plat.w - 4) {
      p.x = plat.x + plat.w;
      p.vx = 0;
      if (isQuestionBox(plat.type) && plat.questionId && onTouchQuestionBlock) {
        onTouchQuestionBlock(plat.questionId);
      }
    }
    hBox.x = p.x;
  }

  const prevY = p.y;
  p.y += stepVy * dtScale;
  p.onGround = false;
  let newCarrierId: string | null = null;
  let newCarrierX: number | undefined;
  let newRidingPlatform: Platform | null = null;

  const box = { x: p.x, y: p.y, w: PLAYER_W, h: PLAYER_H };
  for (const plat of allPlatforms) {
    if (p.ropedById) continue; // diikat tali: tembus obstacle (collision false)

    // Kipas Angin (Updraft Fan): Meniup player melambung tinggi ke atas!
    if (plat.type === 'fan') {
      const fanRange = plat.moveRange ?? 460;
      const inX = p.x + PLAYER_W > plat.x && p.x < plat.x + plat.w;
      const inY = p.y + PLAYER_H >= plat.y - fanRange && p.y <= plat.y + 16;
      if (inX && inY) {
        const dist = Math.max(0, plat.y - (p.y + PLAYER_H));
        const liftForce = 1.45 * Math.max(0.4, 1 - dist / (fanRange + 60));
        p.vy = Math.max(-15.2, p.vy - liftForce * dtScale);
        p.onGround = false;
        if (p.y + PLAYER_H >= plat.y - 4) {
          p.vy = -13.8;
          onSoundEvent?.('bounce');
        }
      }
    }

    if (plat.type === 'crumble' && plat.brokenUntil && now < plat.brokenUntil) {
      continue;
    }
    if (!rectsOverlap(box, plat)) continue;

    // Awan Petir (Thunder Storm): Sambaran listrik mematikan
    if (plat.type === 'thunder') {
      if (p.isGodMode || p.ropedById) continue;
      p.isDying = true;
      p.deathStartedAt = now;
      p.vx = (Math.random() - 0.5) * 4;
      p.vy = -13.2;
      p.onGround = false;
      p.ridingPlayerId = null;
      p.lastCarrierX = undefined;
      p.ridingPlatform = null;
      onSoundEvent?.('death');
      return;
    }

    if (plat.type === 'spike') {
      if (p.isGodMode || p.ropedById) {
        p.vy = -8.5;
        p.onGround = false;
        onSoundEvent?.('bounce');
        continue;
      }
      p.isDying = true;
      p.deathStartedAt = now;
      p.vx = 0;
      p.vy = -13.2;
      p.onGround = false;
      p.ridingPlayerId = null;
      p.lastCarrierX = undefined;
      p.ridingPlatform = null;
      onSoundEvent?.('death');
      return;
    }

    if (plat.type === 'fire') {
      if (p.isGodMode || p.ropedById) continue;
      const alreadyBurning = Boolean(p.burnUntil && p.burnUntil > now + 4400);
      p.burnUntil = now + 5000;
      if (!alreadyBurning) {
        onSoundEvent?.('burn');
        if (p.vy >= -4) {
          p.vy = -8.6;
          p.onGround = false;
        }
      }
      continue;
    }

    // Landing on top of any platform or obstacle
    const topThreshold = (plat.type === 'moving' || plat.type === 'plane') ? 18 : 14;
    if (p.vy >= 0 && prevY + PLAYER_H <= plat.y + topThreshold) {
      p.y = plat.y - PLAYER_H;
      if (plat.type === 'bounce') {
        p.vy = PHYSICS.bounceVelocity;
        p.onGround = false;
        onSoundEvent?.('bounce');
      } else {
        p.vy = 0;
        p.onGround = true;
        if (plat.type === 'moving' || plat.type === 'plane') {
          newRidingPlatform = plat;
        } else if (plat.type === 'crumble' && !plat.crumbleStartedAt) {
          plat.crumbleStartedAt = now;
          const platIndex = stageOptions?.basePlatforms ? stageOptions.basePlatforms.indexOf(plat) : -1;
          if (platIndex >= 0) {
            stageOptions?.onObstacleEvent?.({
              op: 'crumble',
              stg: p.stage ?? 1,
              idx: platIndex,
              at: now,
            });
          }
        }
      }
      box.y = p.y;
      // Landing on top: hanya trigger saat pertama kali mendarat dari udara (bukan setiap frame saat berdiri di atasnya)
      const justLanded = prevVy > 0.5 && prevY + PLAYER_H <= plat.y + topThreshold;
      if (isQuestionBox(plat.type) && plat.questionId && onTouchQuestionBlock && justLanded) {
        onTouchQuestionBlock(plat.questionId);
      }
    } else if (
      isSolidBox(plat.type) &&
      p.vy < 0 &&
      prevY >= plat.y + plat.h - 12
    ) {
      // Hitting bottom of crate or question block
      p.y = plat.y + plat.h;
      p.vy = 1.8;
      box.y = p.y;
      if (isQuestionBox(plat.type) && plat.questionId && onTouchQuestionBlock) {
        onTouchQuestionBlock(plat.questionId);
      }
    }
  }

  // Conveyor belt: platform beroda yang mendorong karakter otomatis
  for (const plat of allPlatforms) {
    if (p.ropedById) continue; // diikat tali: ga terpengaruh conveyor
    if (plat.type !== 'conveyor') continue;
    const standingOn = p.onGround && Math.abs(p.y + PLAYER_H - plat.y) <= 6 && p.x + PLAYER_W > plat.x && p.x < plat.x + plat.w;
    if (!standingOn) continue;
    const dir = plat.conveyorDir ?? 1;
    const spd = plat.conveyorSpeed ?? 1.8;
    p.x += dir * spd * dtScale;
    p.x = Math.max(0, Math.min(WORLD.width - PLAYER_W, p.x));
  }

  // Collectible Power-Up Items (Blaster & Stars)
  const powerUps = stageOptions?.powerUps ?? [];
  for (const pu of powerUps) {
    if (pu.collectedUntil && pu.collectedUntil > now) continue;
    const puBox = { x: pu.x, y: pu.y, w: pu.w, h: pu.h };
    if (rectsOverlap(box, puBox)) {
      // Power-up bersifat per-player (client-local): hilang 5 detik untuk player ini saja, lalu muncul kembali
      pu.collectedUntil = now + 5000;
      if (!p.hasAdminGun) {
        p.blasterAmmo = p.isGodMode ? 999 : 10;
        p.blasterUntil = p.isGodMode ? now + 99999999 : now + 30000;
      }
      stageOptions?.onCollectPowerUp?.(pu);
    }
  }

  // Stage Enemy collisions (Monster Virus & Walking Fireballs)
  const enemies = stageOptions?.enemies ?? [];
  for (const enemy of enemies) {
    if (enemy.stompedUntil && enemy.stompedUntil > now) continue;
    const eHitbox = { x: enemy.x + 3, y: enemy.y + 3, w: enemy.w - 6, h: enemy.h - 4 };
    if (!rectsOverlap(box, eHitbox)) continue;

    // Super Cat invulnerability shield or God Mode defeats enemy on touch!
    if (p.isGodMode || (p.blasterUntil && p.blasterUntil > now)) {
      enemy.stompedUntil = now + 9000;
      p.vy = -10.5;
      p.onGround = false;
      onSoundEvent?.('bounce');
      stageOptions?.onObstacleEvent?.({
        op: 'stomp',
        stg: p.stage ?? 1,
        id: enemy.id,
        until: now + 9000,
      });
      continue;
    }

    // Mario-style Stomp on top of Virus head!
    if ((enemy.kind === 'virus' || enemy.kind === 'drone' || enemy.kind === 'robot') && p.vy > 0 && prevY + PLAYER_H <= enemy.y + enemy.h * 0.55) {
      enemy.stompedUntil = now + 6000;
      p.y = enemy.y - PLAYER_H;
      p.vy = -12.6;
      p.onGround = false;
      onSoundEvent?.('bounce');
      box.y = p.y;
      stageOptions?.onObstacleEvent?.({
        op: 'stomp',
        stg: p.stage ?? 1,
        id: enemy.id,
        until: now + 6000,
      });
      continue;
    }

    if (p.isGodMode || p.ropedById) continue;
    // Otherwise touching Virus from side or touching Fireball causes KO!
    p.isDying = true;
    p.deathStartedAt = now;
    p.vx = 0;
    p.vy = -13.2;
    p.onGround = false;
    p.ridingPlayerId = null;
    p.lastCarrierX = undefined;
    p.ridingPlatform = null;
    onSoundEvent?.('death');
    return;
  }

  // Boss collisions: sentuh boss = KO!
  // Boss TIDAK BISA diinjek/stomp & kebal kontak fisik (walaupun player punya energy/blaster buff).
  // Cara mengurangi HP dan mengalahkan boss HANYA dengan cara ditembaki!
  const bosses = stageOptions?.bosses ?? [];
  for (const b of bosses) {
    if (!b.alive) continue;
    const bHitbox = { x: b.x + 8, y: b.y + 8, w: b.w - 16, h: b.h - 16 };
    if (!rectsOverlap(box, bHitbox)) continue;
    if (p.isGodMode || p.ropedById) continue;

    // Menyentuh boss dari arah mana pun (diinjak dari atas, ditabrak dari samping/bawah, ada buff energy/tidak) -> player MATI!
    p.isDying = true;
    p.deathStartedAt = now;
    p.vx = 0;
    p.vy = -13.2;
    p.onGround = false;
    p.ridingPlayerId = null;
    p.lastCarrierX = undefined;
    p.ridingPlatform = null;
    onSoundEvent?.('death');
    return;
  }

  // Boss projectile collisions: kena ludah boss = KO (kecuali god mode)
  for (const bp of stageOptions?.bossProjectiles ?? []) {
    if (!rectsOverlap(box, { x: bp.x - 10, y: bp.y - 10, w: 20, h: 20 })) continue;
    if (p.isGodMode || p.ropedById) continue;
    p.isDying = true;
    p.deathStartedAt = now;
    p.vx = 0;
    p.vy = -13.2;
    p.onGround = false;
    p.ridingPlayerId = null;
    p.lastCarrierX = undefined;
    p.ridingPlatform = null;
    onSoundEvent?.('death');
    return;
  }

  // Exit Gate Portal check (when all questions in current stage are answered & boss defeated)
  const gateBox = { x: DECOR.gate.x + 22, y: DECOR.gate.y + 24, w: 86, h: 136 };
  if (rectsOverlap(box, gateBox)) {
    if (stageOptions?.isGateUnlocked && stageOptions.onEnterGate) {
      stageOptions.onEnterGate();
    } else if (!stageOptions?.isGateUnlocked && !stageOptions?.isStaff) {
      // Solid locked gate: block student from walking through
      p.x = Math.min(p.x, DECOR.gate.x + 22 - PLAYER_W);
      if (p.vx > 0) p.vx = 0;
      stageOptions?.onLockedGateTouch?.();
    }
  }

  // Player-on-player stacking (gendong-gendongan) & shooter hitting other
  for (const other of otherPlayers) {
    if (other.id === p.id) continue;
    if ((other.stage ?? 1) !== (p.stage ?? 1)) continue;

    // Cek apakah peluru yang ditembakkan `p` mengenai `other`
    // Mode God kebal rintangan map, tapi tetap bisa ditembak oleh player
    if (!other.ropedById && !other.isDying) {
      const otherBox = { x: other.x, y: other.y, w: PLAYER_W, h: PLAYER_H };
      for (const pr of stageOptions?.playerRounds ?? []) {
        if (pr.shooterId !== p.id) continue;
        const shooterRole = pr.shooterRole ?? p.role ?? 'student';
        if (!canShooterHitTarget(shooterRole, other.role, stageOptions?.isPvpEnabled !== false)) continue;

        // Mode Siswa vs Siswa (PvP): Victim-authoritative.
        // Korban sendiri yang mendeteksi peluru masuk di client-nya (baris 450),
        // sehingga damage & knockback terhitung tepat 1x per peluru dan sinkron di semua layar.
        // Penembak tidak mendeteksi hit korban untuk menghindari double-hit / desync HP.
        const isStudentPvP = shooterRole === 'student' && (other.role ?? 'student') === 'student';
        if (isStudentPvP && stageOptions?.isPvpEnabled !== false) {
          continue;
        }

        const rW = pr.w ?? 28;
        const rH = pr.h ?? 18;
        const isBigRound = (pr.len ?? 0) > 100;
        const bigH = isBigRound ? Math.max(rH, 120) : rH;
        const len = pr.len ?? rW;
        const dir = (pr.vx ?? 1) >= 0 ? 1 : -1;
        const rX = dir === 1 ? pr.x - len : pr.x;
        const rBox = { x: rX, y: pr.y - bigH / 2, w: Math.max(rW, len), h: bigH };

        if (rectsOverlap(rBox, otherBox)) {
          // 1 Peluru 1 Target
          const rIdx = stageOptions?.playerRounds ? stageOptions.playerRounds.indexOf(pr) : -1;
          if (rIdx >= 0) stageOptions?.playerRounds?.splice(rIdx, 1);
          stageOptions?.onPlayerHitByRound?.(other.id, p.id, pr.damage ?? 1, pr.weapon, pr.id);
          break;
        }
      }
    }
    // Diikat tali: no stacking, biar ga bisa "mengangkat"/terbang di atas admin
    if (p.ropedById || other.ropedById) continue;

    const headTop = other.y + 4; // allow feet to rest naturally on top of cat head
    const overlapX = p.x + PLAYER_W > other.x + 4 && p.x < other.x + PLAYER_W - 4;
    if (!overlapX) continue;

    const wasAbove = prevY + PLAYER_H <= headTop + 16;
    const isAtOrBelowTop = p.y + PLAYER_H >= headTop && p.y + PLAYER_H <= headTop + 26;

    if (p.vy >= 0 && wasAbove && isAtOrBelowTop) {
      p.y = headTop - PLAYER_H;
      p.vy = 0;
      p.onGround = true;
      newCarrierId = other.id;
      newCarrierX = other.x;
      box.y = p.y;
    }
  }

  p.ridingPlayerId = newCarrierId;
  p.lastCarrierX = newCarrierX;
  p.ridingPlatform = newRidingPlatform;

  if (p.y > WORLD.height + 200) {
    p.x = 120;
    p.y = WORLD.groundY - PLAYER_H - 20;
    p.vy = 0;
  }
}

export { PLAYER_W, PLAYER_H };
