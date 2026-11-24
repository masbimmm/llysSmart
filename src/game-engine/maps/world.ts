export const WORLD = {
  width: 5600,
  height: 1100,
  groundY: 820,
};

export const PHYSICS = {
  gravity: 0.52,
  moveSpeed: 4.6,
  jumpVelocity: -12.6,
  bounceVelocity: -16.8,
  maxFallSpeed: 16,
};

export type PlatformType =
  | 'ground'
  | 'grass'
  | 'wood'
  | 'stone'
  | 'crate'
  | 'qblock'
  | 'qblock-correct'
  | 'qblock-wrong'
  | 'qblock-assisted'
  | 'bounce'
  | 'spike'
  | 'fire'
  | 'roof'
  | 'crumble'
  | 'moving'
  | 'conveyor';

export type Platform = {
  x: number;
  y: number;
  w: number;
  h: number;
  type: PlatformType;
  questionId?: string;
  // Moving platform properties
  baseX?: number;
  baseY?: number;
  moveAxis?: 'x' | 'y';
  moveRange?: number;
  moveSpeed?: number;
  movePhase?: number;
  dx?: number;
  dy?: number;
  // Crumbling platform runtime state
  crumbleStartedAt?: number;
  brokenUntil?: number;
  // Conveyor belt properties (pushes player automatically)
  conveyorDir?: 1 | -1;
  conveyorSpeed?: number;
};

export type StageEnemy = {
  id: string;
  kind: 'virus' | 'fireball';
  x: number;
  y: number;
  w: number;
  h: number;
  minX: number;
  maxX: number;
  speed: number;
  dir: 1 | -1;
  stompedUntil?: number;
};

export const PLATFORMS: Platform[] = [
  // Main ground (expanded to 5600px)
  { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },

  // Starting zone & Signboard platform (left)
  { x: 40, y: 710, w: 220, h: 28, type: 'grass' },
  { x: 290, y: 650, w: 180, h: 26, type: 'grass' },

  // Wooden crates stack (can step on each crate)
  { x: 510, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 560, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 535, y: 724, w: 48, h: 48, type: 'crate' },

  // Low floating grass islands & stone steps
  { x: 650, y: 700, w: 190, h: 28, type: 'grass' },
  { x: 890, y: 630, w: 210, h: 28, type: 'grass' },
  { x: 1150, y: 700, w: 220, h: 28, type: 'grass' },

  // Spikes hazard on ground & between platforms (Mario Bros death + respawn to start!)
  { x: 850, y: 794, w: 66, h: 26, type: 'spike' },
  { x: 1410, y: 794, w: 66, h: 26, type: 'spike' },
  { x: 2220, y: 794, w: 88, h: 26, type: 'spike' },
  { x: 3290, y: 794, w: 88, h: 26, type: 'spike' },
  { x: 4040, y: 794, w: 88, h: 26, type: 'spike' },
  { x: 4720, y: 794, w: 88, h: 26, type: 'spike' },

  // Fire hazards (touching sets character on fire for 5 seconds!)
  { x: 635, y: 794, w: 64, h: 26, type: 'fire' },
  { x: 1225, y: 676, w: 56, h: 24, type: 'fire' },
  { x: 1830, y: 794, w: 68, h: 26, type: 'fire' },
  { x: 2535, y: 596, w: 56, h: 24, type: 'fire' },
  { x: 2840, y: 794, w: 68, h: 26, type: 'fire' },
  { x: 3560, y: 794, w: 72, h: 26, type: 'fire' },
  { x: 3720, y: 596, w: 56, h: 24, type: 'fire' },
  { x: 4340, y: 794, w: 72, h: 26, type: 'fire' },
  { x: 4520, y: 516, w: 56, h: 24, type: 'fire' },
  { x: 5010, y: 794, w: 68, h: 26, type: 'fire' },

  // Bounce / trampoline pads (super jump!)
  { x: 770, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 1650, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 2540, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 3440, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 4220, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 4880, y: 798, w: 64, h: 22, type: 'bounce' },

  // School building walkable ledges & roof (center-left)
  { x: 960, y: 510, w: 360, h: 20, type: 'stone' },
  { x: 940, y: 390, w: 400, h: 22, type: 'roof' },
  { x: 1060, y: 285, w: 160, h: 22, type: 'roof' },

  // Mid-section parkour bridges & crates
  { x: 1440, y: 640, w: 200, h: 26, type: 'wood' },
  { x: 1510, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 1700, y: 570, w: 230, h: 28, type: 'grass' },
  { x: 1980, y: 650, w: 210, h: 28, type: 'grass' },
  { x: 1980, y: 460, w: 190, h: 26, type: 'wood' },

  // High sky islands & golden key platform
  { x: 1480, y: 420, w: 200, h: 26, type: 'grass' },
  { x: 1730, y: 310, w: 210, h: 28, type: 'grass' },
  { x: 1380, y: 220, w: 190, h: 26, type: 'stone' },

  // Center-right obstacle tower & stair pyramid
  { x: 2260, y: 710, w: 170, h: 28, type: 'stone' },
  { x: 2470, y: 620, w: 200, h: 28, type: 'grass' },
  { x: 2720, y: 540, w: 200, h: 28, type: 'grass' },
  { x: 2500, y: 470, w: 180, h: 26, type: 'wood' },
  { x: 2740, y: 370, w: 210, h: 28, type: 'stone' },
  { x: 2990, y: 280, w: 220, h: 28, type: 'grass' },

  // Crate pyramid mid-map
  { x: 2960, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 3010, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 3060, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 2985, y: 724, w: 48, h: 48, type: 'crate' },
  { x: 3035, y: 724, w: 48, h: 48, type: 'crate' },
  { x: 3010, y: 676, w: 48, h: 48, type: 'crate' },

  // NEW EXPANDED ZONE 1: Volcano Canyon & Fire Bridges (3180 - 4100)
  { x: 3180, y: 700, w: 220, h: 28, type: 'stone' },
  { x: 3420, y: 610, w: 210, h: 26, type: 'wood' },
  { x: 3650, y: 620, w: 230, h: 28, type: 'stone' },
  { x: 3520, y: 450, w: 200, h: 26, type: 'grass' },
  { x: 3780, y: 350, w: 220, h: 28, type: 'roof' },
  { x: 3930, y: 690, w: 190, h: 28, type: 'grass' },
  { x: 3860, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 4030, y: 520, w: 210, h: 26, type: 'wood' },

  // NEW EXPANDED ZONE 2: Sky Citadel & High Parkour (4150 - 5050)
  { x: 4180, y: 670, w: 220, h: 28, type: 'grass' },
  { x: 4440, y: 540, w: 230, h: 28, type: 'stone' },
  { x: 4260, y: 390, w: 210, h: 26, type: 'grass' },
  { x: 4540, y: 280, w: 220, h: 28, type: 'roof' },
  { x: 4720, y: 640, w: 210, h: 28, type: 'wood' },
  { x: 4820, y: 450, w: 210, h: 28, type: 'grass' },
  { x: 4630, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 4680, y: 772, w: 48, h: 48, type: 'crate' },
  { x: 4655, y: 724, w: 48, h: 48, type: 'crate' },

  // NEW EXPANDED ZONE 3: Fortress Finish Terrace (5100 - 5520)
  { x: 5120, y: 700, w: 380, h: 32, type: 'grass' },
  { x: 5180, y: 540, w: 260, h: 26, type: 'stone' },
];

export const DECOR = {
  school: { x: 960, y: 400, w: 360, h: 420 },
  trees: [
    { x: 260, y: 820, s: 1.1 },
    { x: 470, y: 820, s: 0.95 },
    { x: 740, y: 700, s: 0.85 },
    { x: 910, y: 820, s: 1.05 },
    { x: 1370, y: 820, s: 1.1 },
    { x: 1610, y: 820, s: 0.95 },
    { x: 1810, y: 570, s: 0.8 },
    { x: 2150, y: 820, s: 1.15 },
    { x: 2420, y: 820, s: 1.0 },
    { x: 2680, y: 820, s: 1.05 },
    { x: 2890, y: 820, s: 0.95 },
    { x: 3140, y: 820, s: 1.1 },
    { x: 3510, y: 820, s: 1.0 },
    { x: 3810, y: 820, s: 1.1 },
    { x: 4150, y: 820, s: 0.95 },
    { x: 4480, y: 820, s: 1.15 },
    { x: 4830, y: 820, s: 1.0 },
    { x: 5100, y: 820, s: 1.05 },
    { x: 5480, y: 820, s: 1.1 },
  ],
  clouds: [
    { x: 180, y: 130, s: 1.0 },
    { x: 560, y: 85, s: 1.25 },
    { x: 980, y: 120, s: 0.95 },
    { x: 1420, y: 75, s: 1.3 },
    { x: 1880, y: 135, s: 1.05 },
    { x: 2340, y: 95, s: 1.2 },
    { x: 2820, y: 125, s: 0.9 },
    { x: 3280, y: 85, s: 1.15 },
    { x: 3740, y: 110, s: 1.2 },
    { x: 4220, y: 80, s: 1.05 },
    { x: 4720, y: 125, s: 1.25 },
    { x: 5210, y: 90, s: 1.1 },
  ],
  sign: { x: 95, y: 625, text: 'Kerja sama tim untuk menyelesaikan setiap tantangan!' },
  gate: { x: 5240, y: 540 },
};

export const SPAWN_POINTS = Array.from({ length: 48 }, (_, i) => ({
  x: 100 + (i % 16) * 45,
  y: 740 - Math.floor(i / 16) * 60,
}));

export const QBLOCK_CANDIDATE_SPOTS: { x: number; y: number }[] = [
  { x: 340, y: 530 },
  { x: 535, y: 610 },
  { x: 720, y: 575 },
  { x: 960, y: 505 },
  { x: 1030, y: 390 },
  { x: 1115, y: 270 },
  { x: 1120, y: 165 },
  { x: 1270, y: 575 },
  { x: 1510, y: 515 },
  { x: 1555, y: 295 },
  { x: 1450, y: 105 },
  { x: 1790, y: 445 },
  { x: 1810, y: 185 },
  { x: 2040, y: 530 },
  { x: 2050, y: 335 },
  { x: 2320, y: 585 },
  { x: 2540, y: 495 },
  { x: 2565, y: 345 },
  { x: 2810, y: 415 },
  { x: 2820, y: 245 },
  { x: 3010, y: 555 },
  { x: 3075, y: 155 },
  { x: 3255, y: 575 },
  { x: 3480, y: 485 },
  { x: 3585, y: 325 },
  { x: 3740, y: 495 },
  { x: 3850, y: 225 },
  { x: 4100, y: 395 },
  { x: 4255, y: 545 },
  { x: 4330, y: 265 },
  { x: 4510, y: 415 },
  { x: 4610, y: 160 },
  { x: 4785, y: 515 },
  { x: 4890, y: 325 },
  { x: 5060, y: 575 },
];

export const STAGE2_PLATFORMS: Platform[] = [
  // Main ground
  { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },

  // Starting zone (left)
  { x: 40, y: 710, w: 220, h: 28, type: 'stone' },
  { x: 310, y: 650, w: 170, h: 24, type: 'crumble' },
  { x: 530, y: 590, w: 180, h: 26, type: 'stone' },

  // First Moving Bridge & Spike Pit
  { x: 720, y: 794, w: 132, h: 26, type: 'spike' },
  { x: 750, y: 660, w: 170, h: 24, type: 'moving', baseX: 750, baseY: 660, moveAxis: 'x', moveRange: 95, moveSpeed: 0.0022, movePhase: 0 },

  // Sunset Cyber-Tower ledges & elevator (960 - 1340)
  { x: 960, y: 520, w: 360, h: 22, type: 'stone' },
  { x: 940, y: 390, w: 400, h: 22, type: 'roof' },
  { x: 1050, y: 270, w: 180, h: 22, type: 'roof' },
  { x: 870, y: 798, w: 64, h: 22, type: 'bounce' },

  // Crumbling Sky Steps & Vertical Lift (1420 - 2180)
  { x: 1420, y: 660, w: 175, h: 24, type: 'crumble' },
  { x: 1520, y: 794, w: 110, h: 26, type: 'spike' },
  { x: 1660, y: 570, w: 170, h: 24, type: 'moving', baseX: 1660, baseY: 470, moveAxis: 'y', moveRange: 120, moveSpeed: 0.0024, movePhase: 1.2 },
  { x: 1890, y: 630, w: 220, h: 28, type: 'stone' },
  { x: 1920, y: 380, w: 190, h: 24, type: 'crumble' },
  { x: 1620, y: 250, w: 200, h: 26, type: 'roof' },
  { x: 2140, y: 798, w: 64, h: 22, type: 'bounce' },

  // Mid-Arena Virus Gauntlet & Crumble Bridge (2240 - 3150)
  { x: 2240, y: 680, w: 320, h: 28, type: 'stone' },
  { x: 2610, y: 600, w: 170, h: 24, type: 'crumble' },
  { x: 2830, y: 530, w: 260, h: 28, type: 'stone' },
  { x: 2480, y: 430, w: 190, h: 24, type: 'moving', baseX: 2480, baseY: 430, moveAxis: 'x', moveRange: 110, moveSpeed: 0.0025, movePhase: 2.1 },
  { x: 2820, y: 310, w: 230, h: 26, type: 'roof' },
  { x: 2620, y: 794, w: 110, h: 26, type: 'spike' },
  { x: 3060, y: 798, w: 64, h: 22, type: 'bounce' },

  // Zone 3: Sunset Canyon & Dual Moving Lifts (3180 - 4120)
  { x: 3180, y: 690, w: 280, h: 28, type: 'stone' },
  { x: 3510, y: 610, w: 170, h: 24, type: 'crumble' },
  { x: 3730, y: 530, w: 180, h: 24, type: 'moving', baseX: 3730, baseY: 530, moveAxis: 'x', moveRange: 95, moveSpeed: 0.0026, movePhase: 0.7 },
  { x: 3460, y: 390, w: 220, h: 26, type: 'stone' },
  { x: 3780, y: 280, w: 220, h: 26, type: 'roof' },
  { x: 3980, y: 660, w: 240, h: 28, type: 'stone' },
  { x: 3540, y: 794, w: 110, h: 26, type: 'spike' },
  { x: 3890, y: 794, w: 72, h: 26, type: 'fire' },

  // Zone 4: Final Citadel Approach (4220 - 5500)
  { x: 4250, y: 580, w: 175, h: 24, type: 'crumble' },
  { x: 4480, y: 500, w: 260, h: 28, type: 'stone' },
  { x: 4320, y: 330, w: 200, h: 24, type: 'moving', baseX: 4320, baseY: 330, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0024, movePhase: 1.9 },
  { x: 4620, y: 240, w: 210, h: 26, type: 'roof' },
  { x: 4790, y: 620, w: 175, h: 24, type: 'crumble' },
  { x: 4880, y: 420, w: 210, h: 26, type: 'stone' },
  { x: 4340, y: 794, w: 110, h: 26, type: 'spike' },
  { x: 4720, y: 798, w: 64, h: 22, type: 'bounce' },

  // Finish Gate Terrace
  { x: 5120, y: 700, w: 380, h: 32, type: 'stone' },
  { x: 5180, y: 540, w: 260, h: 26, type: 'roof' },
];

export const STAGE2_QBLOCK_SPOTS: { x: number; y: number }[] = [
  { x: 365, y: 525 },
  { x: 590, y: 465 },
  { x: 785, y: 520 },
  { x: 1010, y: 400 },
  { x: 1115, y: 150 },
  { x: 1245, y: 400 },
  { x: 1480, y: 535 },
  { x: 1690, y: 130 },
  { x: 1980, y: 505 },
  { x: 1990, y: 255 },
  { x: 2370, y: 555 },
  { x: 2520, y: 295 },
  { x: 2670, y: 475 },
  { x: 2920, y: 405 },
  { x: 2910, y: 185 },
  { x: 3290, y: 565 },
  { x: 3545, y: 265 },
  { x: 3780, y: 395 },
  { x: 3865, y: 155 },
  { x: 4075, y: 535 },
  { x: 4310, y: 455 },
  { x: 4585, y: 375 },
  { x: 4700, y: 120 },
  { x: 4960, y: 295 },
];

export const STAGE3_PLATFORMS: Platform[] = [
  // Main ground
  { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },

  // Starting zone (left) - Dark Basalt Fortress Ledges
  { x: 40, y: 710, w: 220, h: 28, type: 'stone' },
  { x: 300, y: 640, w: 160, h: 24, type: 'crumble' },
  { x: 520, y: 580, w: 180, h: 26, type: 'stone' },

  // Zone 1: First Magma Chasm & Moving Ferry (700 - 1450)
  { x: 720, y: 794, w: 180, h: 26, type: 'fire' },
  { x: 760, y: 660, w: 160, h: 24, type: 'moving', baseX: 760, baseY: 660, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0022, movePhase: 0 },
  { x: 980, y: 530, w: 320, h: 22, type: 'stone' },
  { x: 960, y: 390, w: 360, h: 22, type: 'roof' },
  { x: 1060, y: 260, w: 170, h: 22, type: 'roof' },
  { x: 900, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 1360, y: 460, w: 150, h: 24, type: 'moving', baseX: 1360, baseY: 460, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0025, movePhase: 1.57 },

  // Zone 2: Crumbling Obsidian Steps & Spike Pits (1550 - 2200)
  { x: 1560, y: 794, w: 220, h: 26, type: 'spike' },
  { x: 1580, y: 640, w: 140, h: 24, type: 'crumble' },
  { x: 1780, y: 570, w: 150, h: 24, type: 'stone' },
  { x: 1980, y: 500, w: 140, h: 24, type: 'crumble' },
  { x: 1740, y: 330, w: 190, h: 24, type: 'roof' },
  { x: 1880, y: 794, w: 180, h: 26, type: 'fire' },
  { x: 2120, y: 798, w: 64, h: 22, type: 'bounce' },

  // Zone 3: Twin Magma Counter-Lifts & Mid Fortress (2240 - 3150)
  { x: 2250, y: 680, w: 280, h: 28, type: 'stone' },
  { x: 2360, y: 520, w: 150, h: 24, type: 'moving', baseX: 2360, baseY: 520, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0024, movePhase: 0 },
  { x: 2640, y: 420, w: 150, h: 24, type: 'conveyor', conveyorDir: 1 },
  { x: 2840, y: 340, w: 220, h: 24, type: 'stone' },
  { x: 2820, y: 590, w: 160, h: 24, type: 'crumble' },
  { x: 2600, y: 794, w: 150, h: 26, type: 'spike' },
  { x: 2980, y: 794, w: 140, h: 26, type: 'fire' },
  { x: 3080, y: 798, w: 64, h: 22, type: 'bounce' },

  // Zone 4: Inferno Spire & Sky Elevator (3180 - 4150)
  { x: 3180, y: 680, w: 260, h: 28, type: 'conveyor', conveyorDir: -1 },
  { x: 3480, y: 590, w: 150, h: 24, type: 'crumble' },
  { x: 3420, y: 420, w: 150, h: 24, type: 'moving', baseX: 3420, baseY: 420, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0026, movePhase: 0.8 },
  { x: 3660, y: 540, w: 320, h: 26, type: 'conveyor', conveyorDir: 1 },
  { x: 3720, y: 380, w: 250, h: 24, type: 'roof' },
  { x: 3800, y: 230, w: 180, h: 22, type: 'roof' },
  { x: 4020, y: 650, w: 220, h: 26, type: 'stone' },

  // Zone 5: Final Magma Crossing to the Citadel Gate (4200 - 5500)
  { x: 4220, y: 560, w: 150, h: 24, type: 'crumble' },
  { x: 4420, y: 480, w: 240, h: 26, type: 'conveyor', conveyorDir: -1 },
  { x: 4320, y: 310, w: 190, h: 24, type: 'moving', baseX: 4320, baseY: 310, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0024, movePhase: 1.6 },
  { x: 4620, y: 220, w: 210, h: 24, type: 'roof' },
  { x: 4720, y: 600, w: 160, h: 24, type: 'crumble' },
  { x: 4860, y: 440, w: 220, h: 26, type: 'stone' },
  { x: 4640, y: 640, w: 160, h: 24, type: 'moving', baseX: 4640, baseY: 640, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0023, movePhase: 0 },
  { x: 4360, y: 794, w: 130, h: 26, type: 'spike' },
  { x: 4540, y: 794, w: 140, h: 26, type: 'fire' },
  { x: 4780, y: 798, w: 64, h: 22, type: 'bounce' },

  // Finish Citadel Terrace & Portal
  { x: 5120, y: 700, w: 400, h: 32, type: 'stone' },
  { x: 5180, y: 540, w: 280, h: 26, type: 'roof' },
];

export const STAGE3_QBLOCK_SPOTS: { x: number; y: number }[] = [
  { x: 350, y: 515 },
  { x: 580, y: 455 },
  { x: 790, y: 530 },
  { x: 1020, y: 410 },
  { x: 1120, y: 140 },
  { x: 1250, y: 410 },
  { x: 1420, y: 310 },
  { x: 1640, y: 510 },
  { x: 1820, y: 440 },
  { x: 1800, y: 200 },
  { x: 2040, y: 380 },
  { x: 2420, y: 390 },
  { x: 2700, y: 290 },
  { x: 2900, y: 210 },
  { x: 2880, y: 460 },
  { x: 3240, y: 550 },
  { x: 3480, y: 290 },
  { x: 3720, y: 410 },
  { x: 3840, y: 110 },
  { x: 4080, y: 520 },
  { x: 4280, y: 430 },
  { x: 4480, y: 350 },
  { x: 4680, y: 100 },
  { x: 4780, y: 470 },
  { x: 4940, y: 310 },
];

export type StagePowerUp = {
  id: string;
  stage: number;
  kind: 'blaster' | 'star';
  x: number;
  y: number;
  w: number;
  h: number;
  collectedUntil?: number;
};

export const STAGE4_PLATFORMS: Platform[] = [
  // Main ground - Neon Cyber Grid
  { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },

  // Starting zone (left) - Cyber Launchpad
  { x: 40, y: 710, w: 220, h: 28, type: 'stone' },
  { x: 300, y: 640, w: 160, h: 24, type: 'crumble' },
  { x: 520, y: 580, w: 180, h: 26, type: 'stone' },

  // Zone 1: Anti-Gravity Cyan Lift & Space Void Spike Pit (700 - 1450)
  { x: 720, y: 794, w: 180, h: 26, type: 'spike' },
  { x: 760, y: 660, w: 160, h: 24, type: 'moving', baseX: 760, baseY: 660, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0022, movePhase: 0 },
  { x: 980, y: 530, w: 320, h: 22, type: 'stone' },
  { x: 960, y: 390, w: 360, h: 22, type: 'roof' },
  { x: 1060, y: 260, w: 170, h: 22, type: 'roof' },
  { x: 900, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 1360, y: 460, w: 150, h: 24, type: 'moving', baseX: 1360, baseY: 460, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0025, movePhase: 1.57 },

  // Zone 2: Crumbling Quantum Bridge & Laser Hazard (1550 - 2200)
  { x: 1560, y: 794, w: 220, h: 26, type: 'spike' },
  { x: 1580, y: 640, w: 140, h: 24, type: 'crumble' },
  { x: 1780, y: 570, w: 150, h: 24, type: 'stone' },
  { x: 1980, y: 500, w: 140, h: 24, type: 'crumble' },
  { x: 1740, y: 330, w: 190, h: 24, type: 'roof' },
  { x: 1880, y: 794, w: 180, h: 26, type: 'fire' },
  { x: 2120, y: 798, w: 64, h: 22, type: 'bounce' },

  // Zone 3: Orbital Space Lifts & Mid Cyber Citadel (2240 - 3150)
  { x: 2250, y: 680, w: 280, h: 28, type: 'stone' },
  { x: 2360, y: 520, w: 150, h: 24, type: 'moving', baseX: 2360, baseY: 520, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0024, movePhase: 0 },
  { x: 2640, y: 420, w: 150, h: 24, type: 'conveyor', conveyorDir: 1 },
  { x: 2840, y: 340, w: 220, h: 24, type: 'stone' },
  { x: 2820, y: 590, w: 160, h: 24, type: 'crumble' },
  { x: 2600, y: 794, w: 150, h: 26, type: 'spike' },
  { x: 2980, y: 794, w: 140, h: 26, type: 'fire' },
  { x: 3080, y: 798, w: 64, h: 22, type: 'bounce' },

  // Zone 4: Cyber Spire & High Altitude Beam (3180 - 4150)
  { x: 3180, y: 680, w: 260, h: 28, type: 'conveyor', conveyorDir: -1 },
  { x: 3480, y: 590, w: 150, h: 24, type: 'crumble' },
  { x: 3420, y: 420, w: 150, h: 24, type: 'moving', baseX: 3420, baseY: 420, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0026, movePhase: 0.8 },
  { x: 3660, y: 540, w: 320, h: 26, type: 'conveyor', conveyorDir: 1 },
  { x: 3720, y: 380, w: 250, h: 24, type: 'roof' },
  { x: 3800, y: 230, w: 180, h: 22, type: 'roof' },
  { x: 4020, y: 650, w: 220, h: 26, type: 'stone' },

  // Zone 5: Final Cosmic Bridge & Citadel Gate Approach (4200 - 5500)
  { x: 4220, y: 560, w: 150, h: 24, type: 'crumble' },
  { x: 4420, y: 480, w: 240, h: 26, type: 'conveyor', conveyorDir: -1 },
  { x: 4320, y: 310, w: 190, h: 24, type: 'moving', baseX: 4320, baseY: 310, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0024, movePhase: 1.6 },
  { x: 4620, y: 220, w: 210, h: 24, type: 'roof' },
  { x: 4720, y: 600, w: 160, h: 24, type: 'crumble' },
  { x: 4860, y: 440, w: 220, h: 26, type: 'stone' },
  { x: 4640, y: 640, w: 160, h: 24, type: 'moving', baseX: 4640, baseY: 640, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0023, movePhase: 0 },
  { x: 4360, y: 794, w: 130, h: 26, type: 'spike' },
  { x: 4540, y: 794, w: 140, h: 26, type: 'fire' },
  { x: 4780, y: 798, w: 64, h: 22, type: 'bounce' },

  // Finish Citadel Terrace & Portal
  { x: 5120, y: 700, w: 400, h: 32, type: 'stone' },
  { x: 5180, y: 540, w: 280, h: 26, type: 'roof' },
];

export const STAGE4_QBLOCK_SPOTS: { x: number; y: number }[] = [
  { x: 360, y: 520 },
  { x: 590, y: 460 },
  { x: 800, y: 530 },
  { x: 1030, y: 410 },
  { x: 1130, y: 150 },
  { x: 1260, y: 410 },
  { x: 1430, y: 320 },
  { x: 1650, y: 510 },
  { x: 1830, y: 440 },
  { x: 1810, y: 210 },
  { x: 2050, y: 390 },
  { x: 2430, y: 390 },
  { x: 2710, y: 300 },
  { x: 2910, y: 220 },
  { x: 2890, y: 470 },
  { x: 3250, y: 550 },
  { x: 3490, y: 300 },
  { x: 3730, y: 410 },
  { x: 3850, y: 120 },
  { x: 4090, y: 530 },
  { x: 4290, y: 440 },
  { x: 4490, y: 360 },
  { x: 4690, y: 110 },
  { x: 4790, y: 480 },
  { x: 4950, y: 320 },
];

// ===================== STAGE 5: Hutan Neon Biolumin =====================
// Layout: hutan cendaki glowing, lava-fire pit berwarna toxic green, ranting pohon sebagai platform,
// lantai konveyor lumut, dan arena boss di teras ujung (x 4760-5290) dengan tembok tumbuh-tumbuhan.
export const STAGE5_PLATFORMS: Platform[] = [
  // Main ground (broken into segments with glowing toxic pits between)
  { x: 0, y: 820, w: 1400, h: 280, type: 'ground' },
  { x: 1540, y: 820, w: 900, h: 280, type: 'ground' },
  { x: 2640, y: 820, w: 800, h: 280, type: 'ground' },
  { x: 3620, y: 820, w: 600, h: 280, type: 'ground' },
  { x: 4400, y: 820, w: 1200, h: 280, type: 'ground' },
  // Toxic fire pits (hijau neon, bukan lava biasa)
  { x: 1400, y: 830, w: 140, h: 26, type: 'fire' },
  { x: 2440, y: 830, w: 200, h: 26, type: 'fire' },
  { x: 3440, y: 830, w: 180, h: 26, type: 'fire' },
  { x: 4220, y: 830, w: 180, h: 26, type: 'fire' },
  // Spore spike beds
  { x: 1740, y: 794, w: 160, h: 26, type: 'spike' },
  { x: 2960, y: 794, w: 150, h: 26, type: 'spike' },
  { x: 3860, y: 794, w: 130, h: 26, type: 'spike' },
  // Zone 1: glowing mushroom starter bouncers + canopy logs
  { x: 40, y: 710, w: 220, h: 28, type: 'stone' },
  { x: 320, y: 620, w: 150, h: 24, type: 'roof' },
  { x: 560, y: 540, w: 180, h: 26, type: 'stone' },
  { x: 820, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 900, y: 650, w: 260, h: 24, type: 'roof' },
  { x: 1080, y: 540, w: 200, h: 24, type: 'stone' },
  { x: 1240, y: 430, w: 170, h: 22, type: 'crumble' },
  // Zone 2: vertical vine climb over the first pit
  { x: 1440, y: 700, w: 120, h: 24, type: 'moving', baseX: 1440, baseY: 700, moveAxis: 'y', moveRange: 140, moveSpeed: 0.0024, movePhase: 0 },
  { x: 1620, y: 600, w: 140, h: 24, type: 'roof' },
  { x: 1820, y: 520, w: 150, h: 24, type: 'stone' },
  { x: 1980, y: 420, w: 170, h: 24, type: 'crumble' },
  { x: 2040, y: 640, w: 130, h: 24, type: 'moving', baseX: 2040, baseY: 640, moveAxis: 'x', moveRange: 110, moveSpeed: 0.0026, movePhase: 1.2 },
  { x: 2260, y: 798, w: 64, h: 22, type: 'bounce' },
  // Zone 3: mossy conveyor highway (dorong ke depan, hindari spike)
  { x: 2460, y: 700, w: 220, h: 24, type: 'conveyor', conveyorDir: 1 },
  { x: 2720, y: 640, w: 180, h: 24, type: 'stone' },
  { x: 2680, y: 500, w: 160, h: 22, type: 'crumble' },
  { x: 2900, y: 560, w: 200, h: 24, type: 'roof' },
  { x: 3120, y: 470, w: 180, h: 24, type: 'stone' },
  { x: 3180, y: 640, w: 150, h: 24, type: 'moving', baseX: 3180, baseY: 640, moveAxis: 'y', moveRange: 120, moveSpeed: 0.0025, movePhase: 0.9 },
  { x: 3380, y: 798, w: 64, h: 22, type: 'bounce' },
  // Zone 4: canopy bridge + counter-conveyor (lawan arah, butuh lompat)
  { x: 3480, y: 680, w: 260, h: 24, type: 'conveyor', conveyorDir: -1 },
  { x: 3780, y: 590, w: 160, h: 24, type: 'roof' },
  { x: 3960, y: 500, w: 200, h: 26, type: 'stone' },
  { x: 3900, y: 360, w: 180, h: 22, type: 'crumble' },
  { x: 4160, y: 640, w: 140, h: 24, type: 'moving', baseX: 4160, baseY: 640, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0023, movePhase: 2.4 },
  { x: 4340, y: 540, w: 170, h: 24, type: 'roof' },
  // Zone 5: final approach - bounce mushroom + vine steps
  { x: 4520, y: 460, w: 150, h: 24, type: 'stone' },
  { x: 4680, y: 380, w: 170, h: 22, type: 'crumble' },
  { x: 4560, y: 660, w: 140, h: 24, type: 'moving', baseX: 4560, baseY: 660, moveAxis: 'y', moveRange: 110, moveSpeed: 0.0027, movePhase: 1.6 },
  { x: 4820, y: 798, w: 64, h: 22, type: 'bounce' },
  // Boss arena terrace: datar, luas, sejajar gerbang (boss patrol minX 4760 - maxX 5290)
  { x: 4920, y: 700, w: 520, h: 32, type: 'stone' },
  { x: 5060, y: 540, w: 320, h: 26, type: 'roof' },
  // Arena wall vine (dekup di dinding kanan)
  { x: 5440, y: 560, w: 60, h: 260, type: 'stone' },
];

export const STAGE5_QBLOCK_SPOTS: { x: number; y: number }[] = [
  { x: 120, y: 520 },
  { x: 380, y: 460 },
  { x: 620, y: 400 },
  { x: 860, y: 560 },
  { x: 980, y: 480 },
  { x: 1140, y: 380 },
  { x: 1300, y: 300 },
  { x: 1500, y: 540 },
  { x: 1700, y: 460 },
  { x: 1880, y: 380 },
  { x: 2040, y: 300 },
  { x: 2200, y: 520 },
  { x: 2520, y: 560 },
  { x: 2760, y: 480 },
  { x: 2960, y: 420 },
  { x: 3180, y: 350 },
  { x: 3400, y: 540 },
  { x: 3540, y: 440 },
  { x: 3820, y: 380 },
  { x: 4020, y: 300 },
  { x: 4200, y: 480 },
  { x: 4560, y: 320 },
  { x: 4740, y: 260 },
  { x: 4980, y: 420 },
];

// ===================== BOSS GUARDIAN =====================
export type StageBoss = {
  id: string;
  stage: number;
  kind: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  maxHp: number;
  hp: number;
  alive: boolean;
  /** Facing direction during patrol: 1 = right, -1 = left */
  dir?: 1 | -1;
  /** Patrol bounds (boss paces between minX and maxX) */
  minX?: number;
  maxX?: number;
  /** Next time (epoch ms) the boss spits a projectile at players */
  nextAttackAt?: number;
  /** Until when the attack telegraph (mouth glow) is shown */
  attackUntil?: number;
  /** Until when the white hit-flash overlay is shown */
  hitFlashUntil?: number;
};

const BOSS_KINDS: Record<number, { kind: string; name: string }> = {
  1: { kind: 'guardian', name: 'Penjaga Pintu' },
  2: { kind: 'guardian', name: 'Raja Virus' },
  3: { kind: 'guardian', name: 'Ratu Api' },
  4: { kind: 'guardian', name: 'Mekanik Cyber' },
  5: { kind: 'golem', name: 'Golem Neon' },
  6: { kind: 'tank', name: 'Tank Roda Gigi' },
  7: { kind: 'crab', name: 'Kepiting Es Raksasa' },
  8: { kind: 'scorpion', name: 'Kalajengking Pasir' },
  9: { kind: 'queen', name: 'Ratu Virus' },
  10: { kind: 'overlord', name: 'OVERLORD Final' },
};

export function createStageBosses(stage: number): StageBoss[] {
  if (stage === 1) return [];
  const meta = BOSS_KINDS[stage] ?? { kind: 'guardian', name: 'Penjaga Pintu' };
  const hp = stage >= 10 ? 60 : stage >= 8 ? 40 : 30;
  return [
    {
      id: `boss_s${stage}`,
      stage,
      kind: meta.kind,
      name: meta.name,
      x: 4980,
      y: 700,
      w: 130,
      h: 118,
      maxHp: hp,
      hp,
      alive: true,
      dir: -1,
      minX: 4760,
      maxX: 5290,
      nextAttackAt: 0,
      attackUntil: 0,
    },
  ];
}

// ===================== STAGE 6: Kota Roda Gigi =====================
export const STAGE6_PLATFORMS: Platform[] = [
  // Main ground
  { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
  { x: 40, y: 710, w: 220, h: 28, type: 'moving', baseX: 40, baseY: 710, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0023, movePhase: 0.4 },
  { x: 300, y: 640, w: 160, h: 24, type: 'crumble' },
  { x: 520, y: 580, w: 180, h: 26, type: 'conveyor', conveyorDir: 1 },
  { x: 720, y: 794, w: 180, h: 26, type: 'spike' },
  { x: 760, y: 660, w: 160, h: 24, type: 'moving', baseX: 760, baseY: 660, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0022, movePhase: 0 },
  { x: 980, y: 530, w: 320, h: 22, type: 'conveyor', conveyorDir: -1 },
  { x: 960, y: 390, w: 360, h: 22, type: 'stone' },
  { x: 1060, y: 260, w: 170, h: 22, type: 'stone' },
  { x: 900, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 1360, y: 460, w: 150, h: 24, type: 'moving', baseX: 1360, baseY: 460, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0025, movePhase: 1.57 },
  { x: 1560, y: 794, w: 220, h: 26, type: 'spike' },
  { x: 1580, y: 640, w: 140, h: 24, type: 'crumble' },
  { x: 1780, y: 570, w: 150, h: 24, type: 'moving', baseX: 1780, baseY: 570, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0023, movePhase: 5.24 },
  { x: 1980, y: 500, w: 140, h: 24, type: 'crumble' },
  { x: 1740, y: 330, w: 190, h: 24, type: 'stone' },
  { x: 1880, y: 794, w: 180, h: 26, type: 'fire' },
  { x: 2120, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 2250, y: 680, w: 280, h: 28, type: 'conveyor', conveyorDir: -1 },
  { x: 2360, y: 520, w: 150, h: 24, type: 'moving', baseX: 2360, baseY: 520, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0024, movePhase: 0 },
  { x: 2640, y: 420, w: 150, h: 24, type: 'conveyor', conveyorDir: 1 },
  { x: 2840, y: 340, w: 220, h: 24, type: 'moving', baseX: 2840, baseY: 340, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0023, movePhase: 3.28 },
  { x: 2820, y: 590, w: 160, h: 24, type: 'crumble' },
  { x: 2600, y: 794, w: 150, h: 26, type: 'spike' },
  { x: 2980, y: 794, w: 140, h: 26, type: 'fire' },
  { x: 3080, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 3180, y: 680, w: 260, h: 28, type: 'conveyor', conveyorDir: -1 },
  { x: 3480, y: 590, w: 150, h: 24, type: 'crumble' },
  { x: 3420, y: 420, w: 150, h: 24, type: 'moving', baseX: 3420, baseY: 420, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0026, movePhase: 0.8 },
  { x: 3660, y: 540, w: 320, h: 26, type: 'conveyor', conveyorDir: 1 },
  { x: 3720, y: 380, w: 250, h: 24, type: 'stone' },
  { x: 3800, y: 230, w: 180, h: 22, type: 'stone' },
  { x: 4020, y: 650, w: 220, h: 26, type: 'moving', baseX: 4020, baseY: 650, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0023, movePhase: 2.52 },
  { x: 3500, y: 794, w: 140, h: 26, type: 'spike' },
  { x: 3880, y: 794, w: 110, h: 26, type: 'fire' },
  { x: 4220, y: 560, w: 150, h: 24, type: 'crumble' },
  { x: 4420, y: 480, w: 240, h: 26, type: 'conveyor', conveyorDir: -1 },
  { x: 4320, y: 310, w: 190, h: 24, type: 'moving', baseX: 4320, baseY: 310, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0024, movePhase: 1.6 },
  { x: 4620, y: 220, w: 210, h: 24, type: 'stone' },
  { x: 4720, y: 600, w: 160, h: 24, type: 'crumble' },
  { x: 4860, y: 440, w: 220, h: 26, type: 'conveyor', conveyorDir: -1 },
  { x: 4640, y: 640, w: 160, h: 24, type: 'moving', baseX: 4640, baseY: 640, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0023, movePhase: 0 },
  { x: 4360, y: 794, w: 130, h: 26, type: 'spike' },
  { x: 4540, y: 794, w: 140, h: 26, type: 'fire' },
  { x: 4780, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 5120, y: 700, w: 400, h: 32, type: 'moving', baseX: 5120, baseY: 700, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0023, movePhase: 0.96 },
  { x: 5180, y: 540, w: 280, h: 26, type: 'stone' },
];

export const STAGE6_QBLOCK_SPOTS: { x: number; y: number }[] = [
  { x: 2890, y: 487 },
  { x: 3250, y: 533 },
  { x: 3490, y: 290 },
  { x: 3730, y: 407 },
  { x: 3850, y: 124 },
  { x: 4090, y: 541 },
  { x: 4290, y: 458 },
  { x: 4490, y: 344 },
  { x: 4690, y: 101 },
  { x: 4790, y: 478 },
  { x: 4950, y: 325 },
  { x: 360, y: 532 },
  { x: 590, y: 479 },
  { x: 800, y: 515 },
  { x: 1030, y: 402 },
  { x: 1130, y: 149 },
  { x: 1260, y: 416 },
  { x: 1430, y: 333 },
  { x: 1650, y: 530 },
  { x: 1830, y: 426 },
  { x: 1810, y: 203 },
  { x: 2050, y: 390 },
  { x: 2430, y: 397 },
  { x: 2710, y: 314 },
  { x: 2910, y: 200 },
];

// ===================== STAGE 7: Samudra Es =====================
export const STAGE7_PLATFORMS: Platform[] = [
  // Main ground
  { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
  { x: 40, y: 710, w: 220, h: 28, type: 'crumble' },
  { x: 300, y: 640, w: 160, h: 24, type: 'stone' },
  { x: 520, y: 580, w: 180, h: 26, type: 'crumble' },
  { x: 720, y: 794, w: 180, h: 26, type: 'fire' },
  { x: 760, y: 660, w: 160, h: 24, type: 'moving', baseX: 760, baseY: 660, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0022, movePhase: 0 },
  { x: 980, y: 530, w: 320, h: 22, type: 'crumble' },
  { x: 960, y: 390, w: 360, h: 22, type: 'roof' },
  { x: 1060, y: 260, w: 170, h: 22, type: 'roof' },
  { x: 900, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 1360, y: 460, w: 150, h: 24, type: 'moving', baseX: 1360, baseY: 460, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0025, movePhase: 1.57 },
  { x: 1560, y: 794, w: 220, h: 26, type: 'fire' },
  { x: 1580, y: 640, w: 140, h: 24, type: 'stone' },
  { x: 1780, y: 570, w: 150, h: 24, type: 'crumble' },
  { x: 1980, y: 500, w: 140, h: 24, type: 'stone' },
  { x: 1740, y: 330, w: 190, h: 24, type: 'roof' },
  { x: 1880, y: 794, w: 180, h: 26, type: 'spike' },
  { x: 2120, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 2250, y: 680, w: 280, h: 28, type: 'crumble' },
  { x: 2360, y: 520, w: 150, h: 24, type: 'moving', baseX: 2360, baseY: 520, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0024, movePhase: 0 },
  { x: 2640, y: 420, w: 150, h: 24, type: 'conveyor', conveyorDir: 1 },
  { x: 2840, y: 340, w: 220, h: 24, type: 'crumble' },
  { x: 2820, y: 590, w: 160, h: 24, type: 'stone' },
  { x: 2600, y: 794, w: 150, h: 26, type: 'fire' },
  { x: 2980, y: 794, w: 140, h: 26, type: 'spike' },
  { x: 3080, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 3180, y: 680, w: 260, h: 28, type: 'crumble' },
  { x: 3480, y: 590, w: 150, h: 24, type: 'stone' },
  { x: 3420, y: 420, w: 150, h: 24, type: 'moving', baseX: 3420, baseY: 420, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0026, movePhase: 0.8 },
  { x: 3660, y: 540, w: 320, h: 26, type: 'crumble' },
  { x: 3720, y: 380, w: 250, h: 24, type: 'roof' },
  { x: 3800, y: 230, w: 180, h: 22, type: 'roof' },
  { x: 4020, y: 650, w: 220, h: 26, type: 'crumble' },
  { x: 3500, y: 794, w: 140, h: 26, type: 'fire' },
  { x: 3880, y: 794, w: 110, h: 26, type: 'spike' },
  { x: 4220, y: 560, w: 150, h: 24, type: 'stone' },
  { x: 4420, y: 480, w: 240, h: 26, type: 'crumble' },
  { x: 4320, y: 310, w: 190, h: 24, type: 'moving', baseX: 4320, baseY: 310, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0024, movePhase: 1.6 },
  { x: 4620, y: 220, w: 210, h: 24, type: 'roof' },
  { x: 4720, y: 600, w: 160, h: 24, type: 'stone' },
  { x: 4860, y: 440, w: 220, h: 26, type: 'crumble' },
  { x: 4640, y: 640, w: 160, h: 24, type: 'moving', baseX: 4640, baseY: 640, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0023, movePhase: 0 },
  { x: 4360, y: 794, w: 130, h: 26, type: 'fire' },
  { x: 4540, y: 794, w: 140, h: 26, type: 'spike' },
  { x: 4780, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 5120, y: 700, w: 400, h: 32, type: 'crumble' },
  { x: 5180, y: 540, w: 280, h: 26, type: 'roof' },
];

export const STAGE7_QBLOCK_SPOTS: { x: number; y: number }[] = [
  { x: 4490, y: 349 },
  { x: 4690, y: 106 },
  { x: 4790, y: 483 },
  { x: 4950, y: 330 },
  { x: 360, y: 537 },
  { x: 590, y: 443 },
  { x: 800, y: 520 },
  { x: 1030, y: 407 },
  { x: 1130, y: 154 },
  { x: 1260, y: 421 },
  { x: 1430, y: 338 },
  { x: 1650, y: 494 },
  { x: 1830, y: 431 },
  { x: 1810, y: 208 },
  { x: 2050, y: 395 },
  { x: 2430, y: 402 },
  { x: 2710, y: 319 },
  { x: 2910, y: 205 },
  { x: 2890, y: 462 },
  { x: 3250, y: 549 },
  { x: 3490, y: 306 },
  { x: 3730, y: 423 },
  { x: 3850, y: 140 },
  { x: 4090, y: 516 },
  { x: 4290, y: 433 },
];

// ===================== STAGE 8: Gurun Reruntuhan =====================
export const STAGE8_PLATFORMS: Platform[] = [
  // Main ground
  { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
  { x: 40, y: 710, w: 220, h: 28, type: 'roof' },
  { x: 300, y: 640, w: 160, h: 24, type: 'stone' },
  { x: 520, y: 580, w: 180, h: 26, type: 'roof' },
  { x: 720, y: 794, w: 180, h: 26, type: 'spike' },
  { x: 760, y: 660, w: 160, h: 24, type: 'moving', baseX: 760, baseY: 660, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0022, movePhase: 0 },
  { x: 980, y: 530, w: 320, h: 22, type: 'roof' },
  { x: 960, y: 390, w: 360, h: 22, type: 'crumble' },
  { x: 1060, y: 260, w: 170, h: 22, type: 'crumble' },
  { x: 900, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 1360, y: 460, w: 150, h: 24, type: 'moving', baseX: 1360, baseY: 460, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0025, movePhase: 1.57 },
  { x: 1560, y: 794, w: 220, h: 26, type: 'spike' },
  { x: 1580, y: 640, w: 140, h: 24, type: 'stone' },
  { x: 1780, y: 570, w: 150, h: 24, type: 'roof' },
  { x: 1980, y: 500, w: 140, h: 24, type: 'stone' },
  { x: 1740, y: 330, w: 190, h: 24, type: 'crumble' },
  { x: 1880, y: 794, w: 180, h: 26, type: 'fire' },
  { x: 2120, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 2250, y: 680, w: 280, h: 28, type: 'roof' },
  { x: 2360, y: 520, w: 150, h: 24, type: 'moving', baseX: 2360, baseY: 520, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0024, movePhase: 0 },
  { x: 2640, y: 420, w: 150, h: 24, type: 'conveyor', conveyorDir: 1 },
  { x: 2840, y: 340, w: 220, h: 24, type: 'roof' },
  { x: 2820, y: 590, w: 160, h: 24, type: 'stone' },
  { x: 2600, y: 794, w: 150, h: 26, type: 'spike' },
  { x: 2980, y: 794, w: 140, h: 26, type: 'fire' },
  { x: 3080, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 3180, y: 680, w: 260, h: 28, type: 'roof' },
  { x: 3480, y: 590, w: 150, h: 24, type: 'stone' },
  { x: 3420, y: 420, w: 150, h: 24, type: 'moving', baseX: 3420, baseY: 420, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0026, movePhase: 0.8 },
  { x: 3660, y: 540, w: 320, h: 26, type: 'roof' },
  { x: 3720, y: 380, w: 250, h: 24, type: 'crumble' },
  { x: 3800, y: 230, w: 180, h: 22, type: 'crumble' },
  { x: 4020, y: 650, w: 220, h: 26, type: 'roof' },
  { x: 3500, y: 794, w: 140, h: 26, type: 'spike' },
  { x: 3880, y: 794, w: 110, h: 26, type: 'fire' },
  { x: 4220, y: 560, w: 150, h: 24, type: 'stone' },
  { x: 4420, y: 480, w: 240, h: 26, type: 'roof' },
  { x: 4320, y: 310, w: 190, h: 24, type: 'moving', baseX: 4320, baseY: 310, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0024, movePhase: 1.6 },
  { x: 4620, y: 220, w: 210, h: 24, type: 'crumble' },
  { x: 4720, y: 600, w: 160, h: 24, type: 'stone' },
  { x: 4860, y: 440, w: 220, h: 26, type: 'roof' },
  { x: 4640, y: 640, w: 160, h: 24, type: 'moving', baseX: 4640, baseY: 640, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0023, movePhase: 0 },
  { x: 4360, y: 794, w: 130, h: 26, type: 'spike' },
  { x: 4540, y: 794, w: 140, h: 26, type: 'fire' },
  { x: 4780, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 5120, y: 700, w: 400, h: 32, type: 'roof' },
  { x: 5180, y: 540, w: 280, h: 26, type: 'crumble' },
];

export const STAGE8_QBLOCK_SPOTS: { x: number; y: number }[] = [
  { x: 1030, y: 412 },
  { x: 1130, y: 159 },
  { x: 1260, y: 426 },
  { x: 1430, y: 302 },
  { x: 1650, y: 499 },
  { x: 1830, y: 436 },
  { x: 1810, y: 213 },
  { x: 2050, y: 400 },
  { x: 2430, y: 407 },
  { x: 2710, y: 283 },
  { x: 2910, y: 210 },
  { x: 2890, y: 467 },
  { x: 3250, y: 554 },
  { x: 3490, y: 311 },
  { x: 3730, y: 428 },
  { x: 3850, y: 104 },
  { x: 4090, y: 521 },
  { x: 4290, y: 438 },
  { x: 4490, y: 365 },
  { x: 4690, y: 122 },
  { x: 4790, y: 499 },
  { x: 4950, y: 305 },
  { x: 360, y: 512 },
  { x: 590, y: 459 },
  { x: 800, y: 536 },
];

// ===================== STAGE 9: Sarang Virus =====================
export const STAGE9_PLATFORMS: Platform[] = [
  // Main ground
  { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
  { x: 40, y: 710, w: 220, h: 28, type: 'fire' },
  { x: 300, y: 640, w: 160, h: 24, type: 'crumble' },
  { x: 520, y: 580, w: 180, h: 26, type: 'fire' },
  { x: 720, y: 794, w: 180, h: 26, type: 'stone' },
  { x: 760, y: 660, w: 160, h: 24, type: 'moving', baseX: 760, baseY: 660, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0022, movePhase: 0 },
  { x: 980, y: 530, w: 320, h: 22, type: 'fire' },
  { x: 960, y: 390, w: 360, h: 22, type: 'stone' },
  { x: 1060, y: 260, w: 170, h: 22, type: 'stone' },
  { x: 900, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 1360, y: 460, w: 150, h: 24, type: 'moving', baseX: 1360, baseY: 460, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0025, movePhase: 1.57 },
  { x: 1560, y: 794, w: 220, h: 26, type: 'stone' },
  { x: 1580, y: 640, w: 140, h: 24, type: 'crumble' },
  { x: 1780, y: 570, w: 150, h: 24, type: 'fire' },
  { x: 1980, y: 500, w: 140, h: 24, type: 'crumble' },
  { x: 1740, y: 330, w: 190, h: 24, type: 'stone' },
  { x: 1880, y: 794, w: 180, h: 26, type: 'spike' },
  { x: 2120, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 2250, y: 680, w: 280, h: 28, type: 'fire' },
  { x: 2360, y: 520, w: 150, h: 24, type: 'moving', baseX: 2360, baseY: 520, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0024, movePhase: 0 },
  { x: 2640, y: 420, w: 150, h: 24, type: 'conveyor', conveyorDir: 1 },
  { x: 2840, y: 340, w: 220, h: 24, type: 'fire' },
  { x: 2820, y: 590, w: 160, h: 24, type: 'crumble' },
  { x: 2600, y: 794, w: 150, h: 26, type: 'stone' },
  { x: 2980, y: 794, w: 140, h: 26, type: 'spike' },
  { x: 3080, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 3180, y: 680, w: 260, h: 28, type: 'fire' },
  { x: 3480, y: 590, w: 150, h: 24, type: 'crumble' },
  { x: 3420, y: 420, w: 150, h: 24, type: 'moving', baseX: 3420, baseY: 420, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0026, movePhase: 0.8 },
  { x: 3660, y: 540, w: 320, h: 26, type: 'fire' },
  { x: 3720, y: 380, w: 250, h: 24, type: 'stone' },
  { x: 3800, y: 230, w: 180, h: 22, type: 'stone' },
  { x: 4020, y: 650, w: 220, h: 26, type: 'fire' },
  { x: 3500, y: 794, w: 140, h: 26, type: 'stone' },
  { x: 3880, y: 794, w: 110, h: 26, type: 'spike' },
  { x: 4220, y: 560, w: 150, h: 24, type: 'crumble' },
  { x: 4420, y: 480, w: 240, h: 26, type: 'fire' },
  { x: 4320, y: 310, w: 190, h: 24, type: 'moving', baseX: 4320, baseY: 310, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0024, movePhase: 1.6 },
  { x: 4620, y: 220, w: 210, h: 24, type: 'stone' },
  { x: 4720, y: 600, w: 160, h: 24, type: 'crumble' },
  { x: 4860, y: 440, w: 220, h: 26, type: 'fire' },
  { x: 4640, y: 640, w: 160, h: 24, type: 'moving', baseX: 4640, baseY: 640, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0023, movePhase: 0 },
  { x: 4360, y: 794, w: 130, h: 26, type: 'stone' },
  { x: 4540, y: 794, w: 140, h: 26, type: 'spike' },
  { x: 4780, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 5120, y: 700, w: 400, h: 32, type: 'fire' },
  { x: 5180, y: 540, w: 280, h: 26, type: 'stone' },
];

export const STAGE9_QBLOCK_SPOTS: { x: number; y: number }[] = [
  { x: 2050, y: 405 },
  { x: 2430, y: 371 },
  { x: 2710, y: 288 },
  { x: 2910, y: 215 },
  { x: 2890, y: 472 },
  { x: 3250, y: 559 },
  { x: 3490, y: 316 },
  { x: 3730, y: 392 },
  { x: 3850, y: 109 },
  { x: 4090, y: 526 },
  { x: 4290, y: 443 },
  { x: 4490, y: 370 },
  { x: 4690, y: 127 },
  { x: 4790, y: 463 },
  { x: 4950, y: 310 },
  { x: 360, y: 517 },
  { x: 590, y: 464 },
  { x: 800, y: 541 },
  { x: 1030, y: 428 },
  { x: 1130, y: 134 },
  { x: 1260, y: 401 },
  { x: 1430, y: 318 },
  { x: 1650, y: 515 },
  { x: 1830, y: 452 },
  { x: 1810, y: 229 },
];

// ===================== STAGE 10: Menara Final Boss =====================
export const STAGE10_PLATFORMS: Platform[] = [
  // Main ground
  { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
  { x: 40, y: 710, w: 220, h: 28, type: 'stone' },
  { x: 300, y: 640, w: 160, h: 24, type: 'crumble' },
  { x: 520, y: 580, w: 180, h: 26, type: 'stone' },
  { x: 720, y: 794, w: 180, h: 26, type: 'spike' },
  { x: 760, y: 660, w: 160, h: 24, type: 'moving', baseX: 760, baseY: 660, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0022, movePhase: 0 },
  { x: 980, y: 530, w: 320, h: 22, type: 'stone' },
  { x: 960, y: 390, w: 360, h: 22, type: 'roof' },
  { x: 1060, y: 260, w: 170, h: 22, type: 'roof' },
  { x: 900, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 1360, y: 460, w: 150, h: 24, type: 'moving', baseX: 1360, baseY: 460, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0025, movePhase: 1.57 },
  { x: 1560, y: 794, w: 220, h: 26, type: 'spike' },
  { x: 1580, y: 640, w: 140, h: 24, type: 'crumble' },
  { x: 1780, y: 570, w: 150, h: 24, type: 'stone' },
  { x: 1980, y: 500, w: 140, h: 24, type: 'crumble' },
  { x: 2160, y: 794, w: 110, h: 26, type: 'spike' },
  { x: 1740, y: 330, w: 190, h: 24, type: 'roof' },
  { x: 1880, y: 794, w: 180, h: 26, type: 'fire' },
  { x: 2120, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 2250, y: 680, w: 280, h: 28, type: 'conveyor', conveyorDir: -1 },
  { x: 2360, y: 520, w: 150, h: 24, type: 'moving', baseX: 2360, baseY: 520, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0024, movePhase: 0 },
  { x: 2640, y: 420, w: 150, h: 24, type: 'conveyor', conveyorDir: 1 },
  { x: 2840, y: 340, w: 220, h: 24, type: 'stone' },
  { x: 2820, y: 590, w: 160, h: 24, type: 'crumble' },
  { x: 2600, y: 794, w: 150, h: 26, type: 'spike' },
  { x: 2980, y: 794, w: 140, h: 26, type: 'fire' },
  { x: 3080, y: 798, w: 64, h: 22, type: 'bounce' },
  { x: 3180, y: 680, w: 260, h: 28, type: 'conveyor', conveyorDir: -1 },
  { x: 3480, y: 590, w: 150, h: 24, type: 'crumble' },
  { x: 3420, y: 420, w: 150, h: 24, type: 'moving', baseX: 3420, baseY: 420, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0026, movePhase: 0.8 },
  { x: 3660, y: 540, w: 320, h: 26, type: 'conveyor', conveyorDir: 1 },
  { x: 3720, y: 380, w: 250, h: 24, type: 'roof' },
  { x: 3800, y: 230, w: 180, h: 22, type: 'roof' },
  { x: 4020, y: 650, w: 220, h: 26, type: 'stone' },
  { x: 3500, y: 794, w: 140, h: 26, type: 'spike' },
  { x: 3880, y: 794, w: 110, h: 26, type: 'fire' },
  { x: 4220, y: 560, w: 150, h: 24, type: 'crumble' },
  { x: 4420, y: 480, w: 240, h: 26, type: 'conveyor', conveyorDir: -1 },
  { x: 4320, y: 310, w: 190, h: 24, type: 'moving', baseX: 4320, baseY: 310, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0024, movePhase: 1.6 },
  { x: 4620, y: 220, w: 210, h: 24, type: 'roof' },
  { x: 4720, y: 600, w: 160, h: 24, type: 'crumble' },
  { x: 4860, y: 440, w: 220, h: 26, type: 'stone' },
  { x: 4640, y: 640, w: 160, h: 24, type: 'moving', baseX: 4640, baseY: 640, moveAxis: 'x', moveRange: 100, moveSpeed: 0.0023, movePhase: 0 },
  { x: 4360, y: 794, w: 130, h: 26, type: 'spike' },
  { x: 4540, y: 794, w: 140, h: 26, type: 'fire' },
  { x: 4780, y: 798, w: 64, h: 22, type: 'bounce' },
  // Boss arena gauntlet: conveyor + spike + fire pads before the gate
  { x: 4880, y: 794, w: 110, h: 26, type: 'spike' },
  { x: 4900, y: 640, w: 200, h: 26, type: 'conveyor', conveyorDir: 1 },
  { x: 5120, y: 700, w: 400, h: 32, type: 'stone' },
  { x: 5180, y: 540, w: 280, h: 26, type: 'roof' },
];

export const STAGE10_QBLOCK_SPOTS: { x: number; y: number }[] = [
  { x: 3730, y: 397 },
  { x: 3850, y: 114 },
  { x: 4090, y: 531 },
  { x: 4290, y: 448 },
  { x: 4490, y: 375 },
  { x: 4690, y: 100 },
  { x: 4790, y: 468 },
  { x: 4950, y: 315 },
  { x: 360, y: 522 },
  { x: 590, y: 469 },
  { x: 800, y: 546 },
  { x: 1030, y: 392 },
  { x: 1130, y: 139 },
  { x: 1260, y: 406 },
  { x: 1430, y: 323 },
  { x: 1650, y: 520 },
  { x: 1830, y: 457 },
  { x: 1810, y: 193 },
  { x: 2050, y: 380 },
  { x: 2430, y: 387 },
  { x: 2710, y: 304 },
  { x: 2910, y: 231 },
  { x: 2890, y: 488 },
  { x: 3250, y: 534 },
  { x: 3490, y: 291 },
];

export const STAGE_PLATFORM_MAP: Record<number, Platform[]> = {
  5: STAGE5_PLATFORMS,
  6: STAGE6_PLATFORMS,
  7: STAGE7_PLATFORMS,
  8: STAGE8_PLATFORMS,
  9: STAGE9_PLATFORMS,
  10: STAGE10_PLATFORMS,
};

export const STAGE_QBLOCK_MAP: Record<number, { x: number; y: number }[]> = {
  5: STAGE5_QBLOCK_SPOTS,
  6: STAGE6_QBLOCK_SPOTS,
  7: STAGE7_QBLOCK_SPOTS,
  8: STAGE8_QBLOCK_SPOTS,
  9: STAGE9_QBLOCK_SPOTS,
  10: STAGE10_QBLOCK_SPOTS,
};

export const MAX_STAGE = 10;


export function createStagePowerUps(stage: number): StagePowerUp[] {
  if (stage <= 1) return [];
  if (stage >= 5 && stage <= MAX_STAGE) {
    const kinds: Array<'blaster' | 'star'> = ['blaster', 'star', 'blaster', 'star', 'blaster'];
    const posList: Array<[number, number]> = [[360, 580], [1810, 270], [2840, 280], [3720, 320], [4620, 160]];
    return posList.map((pos, i) => ({ id: `pu_s${stage}_${i + 1}`, stage, kind: kinds[i], x: pos[0], y: pos[1], w: 34, h: 34 }));
  }
  if (stage === 4) {
    return [
      { id: 'pu_s4_1', stage: 4, kind: 'blaster', x: 360, y: 580, w: 34, h: 34 },
      { id: 'pu_s4_2', stage: 4, kind: 'star', x: 1810, y: 270, w: 34, h: 34 },
      { id: 'pu_s4_3', stage: 4, kind: 'blaster', x: 2840, y: 280, w: 34, h: 34 },
      { id: 'pu_s4_4', stage: 4, kind: 'star', x: 3720, y: 320, w: 34, h: 34 },
      { id: 'pu_s4_5', stage: 4, kind: 'blaster', x: 4620, y: 160, w: 34, h: 34 },
    ];
  }
  if (stage === 3) {
    return [
      { id: 'pu_s3_1', stage: 3, kind: 'blaster', x: 1060, y: 200, w: 34, h: 34 },
      { id: 'pu_s3_2', stage: 3, kind: 'blaster', x: 3800, y: 170, w: 34, h: 34 },
    ];
  }
  if (stage === 2) {
    return [
      { id: 'pu_s2_1', stage: 2, kind: 'blaster', x: 1620, y: 190, w: 34, h: 34 },
      { id: 'pu_s2_2', stage: 2, kind: 'blaster', x: 3780, y: 220, w: 34, h: 34 },
    ];
  }
  return [];
}

export function createStageEnemies(stage: number): StageEnemy[] {
  if (stage <= 1) return [];
  if (stage >= 5 && stage <= MAX_STAGE) {
    const spd = 1 + (stage - 4) * 0.08;
    const tpl: Array<[string, number, number, number, number, number, number, number, number]> = [
      ['virus', 440, 780, 38, 40, 310, 690, 2.3, 1],
      ['virus', 1120, 490, 38, 40, 1010, 1340, 2.2, -1],
      ['virus', 2360, 640, 38, 40, 2270, 2520, 2.4, 1],
      ['virus', 3740, 500, 38, 40, 3680, 4020, 2.3, -1],
      ['virus', 4620, 590, 38, 40, 4520, 4780, 2.2, 1],
      ['fireball', 1220, 786, 34, 34, 1050, 1470, 3.2, 1],
      ['fireball', 2020, 786, 34, 34, 1860, 2220, 3.2, -1],
      ['fireball', 2840, 300, 34, 34, 2740, 2980, 3.0, 1],
      ['fireball', 3960, 786, 34, 34, 3840, 4180, 3.3, -1],
      ['fireball', 4960, 786, 34, 34, 4840, 5140, 3.2, -1],
    ];
    return tpl.map((e, i) => ({ id: `x${stage}_${i}`, kind: e[0] as 'virus' | 'fireball', x: e[1], y: e[2], w: e[3], h: e[4], minX: e[5], maxX: e[6], speed: Math.round(e[7] * spd * 10) / 10, dir: e[8] as 1 | -1 }));
  }
  if (stage === 2) {
    return [
      // Ground & platform patrolling Viruses (can be dodged or stomped from above!)
      { id: 'v1', kind: 'virus', x: 420, y: 780, w: 38, h: 40, minX: 290, maxX: 670, speed: 1.9, dir: 1 },
      { id: 'v2', kind: 'virus', x: 1120, y: 480, w: 38, h: 40, minX: 975, maxX: 1270, speed: 1.7, dir: -1 },
      { id: 'v3', kind: 'virus', x: 2340, y: 640, w: 38, h: 40, minX: 2255, maxX: 2510, speed: 1.8, dir: 1 },
      { id: 'v4', kind: 'virus', x: 3280, y: 650, w: 38, h: 40, minX: 3195, maxX: 3410, speed: 2.0, dir: -1 },
      { id: 'v5', kind: 'virus', x: 4560, y: 460, w: 38, h: 40, minX: 4495, maxX: 4690, speed: 1.9, dir: 1 },
      // Fast rolling Fireballs on ground/ledges (must jump over!)
      { id: 'f1', kind: 'fireball', x: 1820, y: 786, w: 34, h: 34, minX: 1660, maxX: 2090, speed: 2.6, dir: 1 },
      { id: 'f2', kind: 'fireball', x: 2880, y: 786, w: 34, h: 34, minX: 2750, maxX: 3030, speed: 2.7, dir: -1 },
      { id: 'f3', kind: 'fireball', x: 3720, y: 786, w: 34, h: 34, minX: 3670, maxX: 3860, speed: 2.5, dir: 1 },
      { id: 'f4', kind: 'fireball', x: 4920, y: 786, w: 34, h: 34, minX: 4810, maxX: 5090, speed: 2.8, dir: -1 },
    ];
  }

  if (stage === 3) {
    return [
      { id: 'm_v1', kind: 'virus', x: 460, y: 780, w: 38, h: 40, minX: 320, maxX: 680, speed: 2.1, dir: 1 },
      { id: 'm_v2', kind: 'virus', x: 1140, y: 490, w: 38, h: 40, minX: 1030, maxX: 1330, speed: 2.0, dir: -1 },
      { id: 'm_v3', kind: 'virus', x: 2320, y: 540, w: 38, h: 40, minX: 2260, maxX: 2480, speed: 2.2, dir: 1 },
      { id: 'm_v4', kind: 'virus', x: 3760, y: 520, w: 38, h: 40, minX: 3710, maxX: 4010, speed: 2.2, dir: -1 },
      { id: 'm_v5', kind: 'virus', x: 4650, y: 600, w: 38, h: 40, minX: 4550, maxX: 4770, speed: 2.0, dir: 1 },
      { id: 'm_f1', kind: 'fireball', x: 1200, y: 786, w: 34, h: 34, minX: 1040, maxX: 1450, speed: 2.9, dir: 1 },
      { id: 'm_f2', kind: 'fireball', x: 2000, y: 786, w: 34, h: 34, minX: 1850, maxX: 2200, speed: 3.0, dir: -1 },
      { id: 'm_f3', kind: 'fireball', x: 2800, y: 346, w: 34, h: 34, minX: 2730, maxX: 2930, speed: 2.8, dir: 1 },
      { id: 'm_f4', kind: 'fireball', x: 3950, y: 786, w: 34, h: 34, minX: 3820, maxX: 4150, speed: 3.1, dir: -1 },
      { id: 'm_f5', kind: 'fireball', x: 4950, y: 786, w: 34, h: 34, minX: 4830, maxX: 5120, speed: 3.0, dir: -1 },
    ];
  }

  // Stage 4: Galaksi Cyber & Pertahanan Orbit (Ultimate Speed & Firepower!)
  return [
    { id: 'c_v1', kind: 'virus', x: 440, y: 780, w: 38, h: 40, minX: 310, maxX: 690, speed: 2.3, dir: 1 },
    { id: 'c_v2', kind: 'virus', x: 1120, y: 490, w: 38, h: 40, minX: 1010, maxX: 1340, speed: 2.2, dir: -1 },
    { id: 'c_v3', kind: 'virus', x: 2360, y: 640, w: 38, h: 40, minX: 2270, maxX: 2520, speed: 2.4, dir: 1 },
    { id: 'c_v4', kind: 'virus', x: 3740, y: 500, w: 38, h: 40, minX: 3680, maxX: 4020, speed: 2.3, dir: -1 },
    { id: 'c_v5', kind: 'virus', x: 4620, y: 590, w: 38, h: 40, minX: 4520, maxX: 4780, speed: 2.2, dir: 1 },
    { id: 'c_f1', kind: 'fireball', x: 1220, y: 786, w: 34, h: 34, minX: 1050, maxX: 1470, speed: 3.2, dir: 1 },
    { id: 'c_f2', kind: 'fireball', x: 2020, y: 786, w: 34, h: 34, minX: 1860, maxX: 2220, speed: 3.2, dir: -1 },
    { id: 'c_f3', kind: 'fireball', x: 2840, y: 300, w: 34, h: 34, minX: 2740, maxX: 2980, speed: 3.0, dir: 1 },
    { id: 'c_f4', kind: 'fireball', x: 3960, y: 786, w: 34, h: 34, minX: 3840, maxX: 4180, speed: 3.3, dir: -1 },
    { id: 'c_f5', kind: 'fireball', x: 4960, y: 786, w: 34, h: 34, minX: 4840, maxX: 5140, speed: 3.2, dir: -1 },
  ];
}

export function getStageBasePlatforms(stage: number): Platform[] {
  const src = STAGE_PLATFORM_MAP[stage] ?? (stage === 4 ? STAGE4_PLATFORMS : stage === 3 ? STAGE3_PLATFORMS : stage === 2 ? STAGE2_PLATFORMS : PLATFORMS);
  return src.map((p) => ({ ...p }));
}

export function generateQuestionBlocks(questionIds: string[], seedStr: string, stage = 1): Platform[] {
  if (questionIds.length === 0) return [];
  let seed = 2166136261;
  const fullSeed = `${seedStr}:stage${stage}`;
  for (let i = 0; i < fullSeed.length; i += 1) {
    seed ^= fullSeed.charCodeAt(i);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  const nextRand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const baseSpots = STAGE_QBLOCK_MAP[stage] ?? (stage === 4 ? STAGE4_QBLOCK_SPOTS : stage === 3 ? STAGE3_QBLOCK_SPOTS : stage === 2 ? STAGE2_QBLOCK_SPOTS : QBLOCK_CANDIDATE_SPOTS);
  const pool = [...baseSpots];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRand() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  return questionIds.map((qid, idx) => {
    const spot = pool[idx % pool.length];
    const jitterX = Math.round((nextRand() - 0.5) * 16);
    const jitterY = Math.round((nextRand() - 0.5) * 10);
    const tierOffset = Math.floor(idx / pool.length) * 64;
    // Kotak soal dibuat jangan terlalu tinggi (agar mudah dijangkau player):
    // y < 460 diposisikan ke zona yang nyaman dijangkau (480 s/d 620)
    const spotY = spot.y < 460 ? 480 + (spot.y % 140) : spot.y;
    const finalY = Math.max(460, Math.min(WORLD.groundY - 140, spotY + jitterY));
    return {
      x: Math.max(260, Math.min(5080, spot.x + jitterX + tierOffset)),
      y: finalY,
      w: 48,
      h: 48,
      type: 'qblock' as const,
      questionId: qid,
    };
  });
}

export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
