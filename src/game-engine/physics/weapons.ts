// Admin-only weapon & cosmetic system
// - Weapons (/spawn gun <type>): minigun, laser, mega-laser. Admin only, non-permanent.
// - Jail (/jail on|off): freeze a player in place (cannot move). Admin only.
// - Cosmetics (/change tag|color): spoofed title, custom body/tag/nick colors
//   incl. animated RGB / BLINK / SPIN. Admin only, non-permanent.

export type WeaponType = 'minigun' | 'laser' | 'megalaser' | 'ice' | 'stunt';

export type WeaponSpec = {
  id: WeaponType;
  label: string;
  cooldownMs: number;
  damage: number;
  speed: number;
  color: string;
  glow: string;
  length: number;
  thickness: number;
  ammo: number;
  lifetimeMs: number;
};

export const WEAPONS: Record<WeaponType, WeaponSpec> = {
  minigun: {
    id: 'minigun',
    label: 'Minigun',
    cooldownMs: 60,
    damage: 1,
    speed: 15,
    color: '#f97316',
    glow: '#fdba74',
    length: 16,
    thickness: 5,
    ammo: 120,
    lifetimeMs: 20000,
  },
  laser: {
    id: 'laser',
    label: 'Laser',
    cooldownMs: 180,
    damage: 1,
    speed: 17,
    color: '#38bdf8',
    glow: '#bae6fd',
    length: 26,
    thickness: 7,
    ammo: 40,
    lifetimeMs: 25000,
  },
  megalaser: {
    id: 'megalaser',
    label: 'Mega Laser',
    // Mega Laser: satu tembakan nge-sweep sepanjang map (WORLD.width = 5600), one-shot semua yang dilewati
    cooldownMs: 650,
    damage: 99,
    speed: 40,
    color: '#a855f7',
    glow: '#e9d5ff',
    length: 5600,
    thickness: 64,
    ammo: 15,
    lifetimeMs: 30000,
  },
  ice: {
    id: 'ice',
    label: 'Ice Gun',
    // Ice: kena = beku (es) + terdorong mundur pelan, lalu mati setelah efek beku selesai
    cooldownMs: 500,
    damage: 1,
    speed: 13,
    color: '#67e8f9',
    glow: '#cffafe',
    length: 22,
    thickness: 8,
    ammo: 40,
    lifetimeMs: 25000,
  },
  stunt: {
    id: 'stunt',
    label: 'Stunt Gun',
    // Stunt: kena = kejut listrik (diam sesaat), lalu mati
    cooldownMs: 500,
    damage: 1,
    speed: 15,
    color: '#facc15',
    glow: '#fef9c3',
    length: 24,
    thickness: 7,
    ammo: 40,
    lifetimeMs: 25000,
  },
};

export function parseWeaponType(raw?: string): WeaponType | null {
  const q = (raw ?? '').toLowerCase().replace(/[\s_-]/g, '');
  if (!q) return null;
  if (q === 'minigun' || q === 'mg') return 'minigun';
  if (q === 'laser' || q === 'laserbiasa' || q === 'normal') return 'laser';
  if (q === 'ice' || q === 'icegun' || q === 'es') return 'ice';
  if (q === 'stunt' || q === 'stuntgun' || q === 'listrik' || q === 'shock') return 'stunt';
  if (q === 'megalaser' || q === 'mega' || q === 'biglaser' || q === 'laser besar') return 'megalaser';
  return null;
}

// ---------- Jail ----------

export const JAIL_FREEZE_MS = 15_000;

// ---------- Colors ----------

export type ColorChannel = 'body' | 'tag' | 'nick';

export type PlayerColors = {
  body?: string;
  tag?: string;
  tag1?: string;
  tag2?: string;
  tag3?: string;
  nick?: string;
};

// Resolve a color argument: hex (#rrggbb), css name, or animated keywords.
// Returns { value, animated } or null when unrecognized.
export type AnimatedColorMode =
  | 'rgb'
  | 'blink'
  | 'spin'
  | 'swap'
  | 'spiral'
  | 'pulse'
  | 'wave'
  | 'strobe'
  | 'candy'
  | 'fire'
  | 'ice'
  | 'glitch';

export function parseColorArg(
  raw?: string,
): { value: string; animated: AnimatedColorMode } | { value: string; animated: null } | null {
  const q = (raw ?? '').trim().toLowerCase().replace(/[\s_-]/g, '');
  if (!q) return null;
  if (q === 'rgb' || q === 'rainbow') return { value: 'rgb', animated: 'rgb' };
  if (q === 'blink') return { value: 'blink', animated: 'blink' };
  if (q === 'spin' || q === 'hue') return { value: 'spin', animated: 'spin' };
  if (q === 'swap' || q === 'rgbswap') return { value: 'swap', animated: 'swap' };
  if (q === 'spiral' || q === 'rgbspiral') return { value: 'spiral', animated: 'spiral' };
  if (q === 'pulse' || q === 'rgbpulse') return { value: 'pulse', animated: 'pulse' };
  if (q === 'wave' || q === 'rgbwave') return { value: 'wave', animated: 'wave' };
  if (q === 'strobe' || q === 'rgbstrobe') return { value: 'strobe', animated: 'strobe' };
  if (q === 'candy' || q === 'rgbcandy') return { value: 'candy', animated: 'candy' };
  if (q === 'fire' || q === 'rgbfire') return { value: 'fire', animated: 'fire' };
  if (q === 'ice' || q === 'rgbice') return { value: 'ice', animated: 'ice' };
  if (q === 'glitch' || q === 'rgbglitch') return { value: 'glitch', animated: 'glitch' };
  if (/^#[0-9a-f]{6}$/.test(q) || /^#[0-9a-f]{3}$/.test(q)) return { value: q, animated: null };
  if (/^[a-z]{3,20}$/.test(q)) return { value: q, animated: null };
  return null;
}

// Convert an arbitrary CSS color string to a hex string (best effort).
export function toHexColor(cssColor: string): string {
  const c = cssColor.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(c)) return c;
  if (/^#[0-9a-f]{3}$/.test(c)) {
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  }
  if (typeof document === 'undefined') return c;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return c;
  ctx.fillStyle = c;
  const computed = ctx.fillStyle;
  return typeof computed === 'string' ? computed : c;
}

// Animated color resolver: returns the current CSS color at time `now`.
// Swap  : toggle 2 warna kontras (magenta <-> cyan) tiap ~200ms.
// Spiral: rainbow cepat + flicker brightness (kesan berputar).
// Pulse : lembut antara 2 hue (biru <-> ungu) pakai sin.
// Wave  : hue naik pelan dalam 3 detik (smooth rainbow).
// Strobe: flash putih cepat dengan warna acak tiap flash.
// Candy : hard cycle warna pastel (pink, biru muda, kuning, hijau muda).
// Fire  : gradasi merah <-> oranye <-> kuning cepat.
// Ice   : gradasi biru <-> cyan <-> putih.
// Glitch: lompatan hue acak + sesekali hitam (broken TV vibes).
export function resolveAnimatedColor(mode: AnimatedColorMode, now: number): string {
  if (mode === 'rgb') {
    const hue = (now * 0.09) % 360;
    return `hsl(${hue}, 95%, 58%)`;
  }
  if (mode === 'blink') {
    const phase = Math.floor(now / 220) % 2;
    return phase === 0 ? '#ffffff' : '#111827';
  }
  // spin: rotating 3-color disco cycle (mirrors Windows setup spinner vibes)
  if (mode === 'spin') {
    const idx = Math.floor(now / 160) % 3;
    return ['#38bdf8', '#a855f7', '#f472b6'][idx];
  }
  if (mode === 'swap') {
    const phase = Math.floor(now / 200) % 2;
    return phase === 0 ? '#ff00cc' : '#00fff2';
  }
  if (mode === 'spiral') {
    const hue = (now * 0.35) % 360;
    const light = 55 + 12 * Math.sin(now * 0.02);
    return `hsl(${hue}, 100%, ${light}%)`;
  }
  if (mode === 'pulse') {
    const t = (Math.sin(now * 0.004) + 1) / 2;
    return `hsl(${260 + 40 * t}, 90%, ${55 + 10 * t}%)`;
  }
  if (mode === 'wave') {
    const hue = (now * 0.12) % 360;
    return `hsl(${hue}, 85%, 62%)`;
  }
  if (mode === 'strobe') {
    const phase = Math.floor(now / 90);
    if (phase % 3 === 0) return '#ffffff';
    const hue = (phase * 137.5) % 360; // golden angle biar acak tapi deterministik
    return `hsl(${hue}, 100%, 60%)`;
  }
  if (mode === 'candy') {
    const idx = Math.floor(now / 300) % 4;
    return ['#ff9ff3', '#7efff5', '#f9ca24', '#6ab04c'][idx];
  }
  if (mode === 'fire') {
    const t = (Math.sin(now * 0.012) + 1) / 2;
    const hue = 55 - 45 * t; // 55 (kuning) <-> 10 (merah)
    return `hsl(${hue}, 100%, ${50 + 8 * t}%)`;
  }
  if (mode === 'ice') {
    const t = (Math.sin(now * 0.006) + 1) / 2;
    return `hsl(${190 + 15 * t}, 95%, ${60 + 15 * t}%)`;
  }
  // glitch
  const step = Math.floor(now / 130);
  if (step % 7 === 0) return '#111111';
  const hue = (step * 91) % 360;
  return `hsl(${hue}, 100%, 55%)`;
}

// Parse the stored color spec (plain css color or animated keyword) at a point in time.
export function resolvePlayerColor(spec: string | undefined, now: number): string | undefined {
  if (!spec) return undefined;
  const q = spec.toLowerCase().replace(/[\s_-]/g, '');
  const known: AnimatedColorMode[] = [
    'rgb', 'blink', 'spin', 'swap', 'spiral', 'pulse', 'wave', 'strobe', 'candy', 'fire', 'ice', 'glitch',
  ];
  if ((known as string[]).includes(q)) return resolveAnimatedColor(q as AnimatedColorMode, now);
  return spec;
}
