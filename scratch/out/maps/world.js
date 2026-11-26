"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAGE_DEFINITIONS = exports.STAGE_TIERS = exports.MAX_STAGE = exports.STAGE_QBLOCK_MAP = exports.STAGE_PLATFORM_MAP = exports.STAGE20_QBLOCK_SPOTS = exports.STAGE20_PLATFORMS = exports.STAGE19_QBLOCK_SPOTS = exports.STAGE19_PLATFORMS = exports.STAGE18_QBLOCK_SPOTS = exports.STAGE18_PLATFORMS = exports.STAGE17_QBLOCK_SPOTS = exports.STAGE17_PLATFORMS = exports.STAGE16_QBLOCK_SPOTS = exports.STAGE16_PLATFORMS = exports.STAGE15_QBLOCK_SPOTS = exports.STAGE15_PLATFORMS = exports.STAGE14_QBLOCK_SPOTS = exports.STAGE14_PLATFORMS = exports.STAGE13_QBLOCK_SPOTS = exports.STAGE13_PLATFORMS = exports.STAGE12_QBLOCK_SPOTS = exports.STAGE12_PLATFORMS = exports.STAGE11_QBLOCK_SPOTS = exports.STAGE11_PLATFORMS = exports.STAGE10_QBLOCK_SPOTS = exports.STAGE10_PLATFORMS = exports.STAGE9_QBLOCK_SPOTS = exports.STAGE9_PLATFORMS = exports.STAGE8_QBLOCK_SPOTS = exports.STAGE8_PLATFORMS = exports.STAGE7_QBLOCK_SPOTS = exports.STAGE7_PLATFORMS = exports.STAGE6_QBLOCK_SPOTS = exports.STAGE6_PLATFORMS = exports.STAGE5_QBLOCK_SPOTS = exports.STAGE5_PLATFORMS = exports.STAGE4_QBLOCK_SPOTS = exports.STAGE4_PLATFORMS = exports.STAGE3_QBLOCK_SPOTS = exports.STAGE3_PLATFORMS = exports.STAGE2_QBLOCK_SPOTS = exports.STAGE2_PLATFORMS = exports.QBLOCK_CANDIDATE_SPOTS = exports.PLATFORMS = exports.STAGE1_PLATFORMS = exports.SPAWN_POINTS = exports.DECOR = exports.PHYSICS = exports.WORLD = void 0;
exports.createStageBosses = createStageBosses;
exports.createStagePowerUps = createStagePowerUps;
exports.createStageEnemies = createStageEnemies;
exports.getStageBasePlatforms = getStageBasePlatforms;
exports.generateQuestionBlocks = generateQuestionBlocks;
exports.rectsOverlap = rectsOverlap;
// Map & World Platform Definitions for 20 Multi-Tier Stages
exports.WORLD = {
    width: 5600,
    height: 1100,
    groundY: 820,
};
exports.PHYSICS = {
    gravity: 0.52,
    moveSpeed: 4.6,
    jumpVelocity: -12.6,
    bounceVelocity: -16.8,
    maxFallSpeed: 16,
};
exports.DECOR = {
    school: { x: 960, y: 400, w: 360, h: 420 },
    trees: [
        { x: 260, y: 820, s: 1.1 },
        { x: 470, y: 820, s: 0.95 },
        { x: 910, y: 820, s: 1.05 },
        { x: 1370, y: 820, s: 1.1 },
        { x: 1610, y: 820, s: 0.95 },
        { x: 2150, y: 820, s: 1.15 },
        { x: 2420, y: 820, s: 1.0 },
        { x: 2680, y: 820, s: 1.05 },
        { x: 2890, y: 820, s: 0.95 },
        { x: 3140, y: 820, s: 1.1 },
        { x: 3510, y: 820, s: 1.0 },
        { x: 3860, y: 820, s: 1.05 },
        { x: 4220, y: 820, s: 0.95 },
        { x: 4580, y: 820, s: 1.1 },
        { x: 4860, y: 820, s: 0.9 },
    ],
    clouds: [
        { x: 80, y: 120, s: 1.0 },
        { x: 220, y: 75, s: 1.2 },
        { x: 380, y: 155, s: 0.9 },
        { x: 540, y: 90, s: 1.25 },
        { x: 700, y: 140, s: 1.05 },
        { x: 860, y: 70, s: 1.15 },
        { x: 1020, y: 130, s: 0.95 },
        { x: 1180, y: 80, s: 1.2 },
        { x: 1340, y: 160, s: 0.9 },
        { x: 1500, y: 75, s: 1.3 },
        { x: 1660, y: 135, s: 1.05 },
        { x: 1820, y: 85, s: 1.15 },
        { x: 1980, y: 150, s: 0.95 },
        { x: 2140, y: 70, s: 1.25 },
        { x: 2300, y: 125, s: 1.1 },
        { x: 2460, y: 80, s: 1.2 },
        { x: 2620, y: 165, s: 0.85 },
        { x: 2780, y: 95, s: 1.3 },
        { x: 2940, y: 140, s: 1.0 },
        { x: 3100, y: 75, s: 1.2 },
        { x: 3260, y: 155, s: 0.95 },
        { x: 3420, y: 85, s: 1.25 },
        { x: 3580, y: 130, s: 1.05 },
        { x: 3740, y: 70, s: 1.15 },
        { x: 3900, y: 150, s: 0.9 },
        { x: 4060, y: 80, s: 1.3 },
        { x: 4220, y: 135, s: 1.0 },
        { x: 4380, y: 75, s: 1.2 },
        { x: 4540, y: 160, s: 0.95 },
        { x: 4700, y: 85, s: 1.25 },
        { x: 4860, y: 130, s: 1.05 },
        { x: 5020, y: 70, s: 1.2 },
        { x: 5180, y: 145, s: 0.9 },
        { x: 5340, y: 80, s: 1.25 },
        { x: 5480, y: 135, s: 1.05 },
    ],
    sign: { x: 95, y: 625, text: 'Kerja sama tim untuk menyelesaikan setiap tantangan!' },
    gate: { x: 5380, y: 660 },
};
exports.SPAWN_POINTS = Array.from({ length: 48 }, (_, i) => ({
    x: 100 + (i % 16) * 65,
    y: 740 - Math.floor(i / 16) * 60,
}));
// =========================================================================
// TIER 1: RINTANGAN MUDAH (STAGE 1 - 5)
// =========================================================================
// --- STAGE 1: Lembah Kampus (Tutorial & Jalur Hijau) ---
exports.STAGE1_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    { x: 40, y: 710, w: 220, h: 28, type: 'grass' },
    { x: 290, y: 650, w: 180, h: 26, type: 'grass' },
    { x: 510, y: 772, w: 48, h: 48, type: 'crate' },
    { x: 560, y: 772, w: 48, h: 48, type: 'crate' },
    { x: 535, y: 724, w: 48, h: 48, type: 'crate' },
    { x: 650, y: 700, w: 190, h: 28, type: 'grass' },
    { x: 890, y: 630, w: 210, h: 28, type: 'grass' },
    { x: 1150, y: 700, w: 220, h: 28, type: 'grass' },
    { x: 850, y: 794, w: 66, h: 26, type: 'spike' },
    { x: 1410, y: 794, w: 66, h: 26, type: 'spike' },
    { x: 2220, y: 794, w: 88, h: 26, type: 'spike' },
    { x: 3290, y: 794, w: 88, h: 26, type: 'spike' },
    { x: 4040, y: 794, w: 88, h: 26, type: 'spike' },
    { x: 4720, y: 794, w: 88, h: 26, type: 'spike' },
    { x: 635, y: 794, w: 64, h: 26, type: 'fire' },
    { x: 1225, y: 676, w: 56, h: 24, type: 'fire' },
    { x: 1830, y: 794, w: 68, h: 26, type: 'fire' },
    { x: 2840, y: 794, w: 68, h: 26, type: 'fire' },
    { x: 3560, y: 794, w: 72, h: 26, type: 'fire' },
    { x: 4340, y: 794, w: 72, h: 26, type: 'fire' },
    { x: 770, y: 798, w: 64, h: 22, type: 'bounce' },
    { x: 1650, y: 798, w: 64, h: 22, type: 'bounce' },
    { x: 2540, y: 798, w: 64, h: 22, type: 'bounce' },
    { x: 3440, y: 798, w: 64, h: 22, type: 'bounce' },
    { x: 4220, y: 798, w: 64, h: 22, type: 'bounce' },
    { x: 4880, y: 798, w: 64, h: 22, type: 'bounce' },
    { x: 960, y: 510, w: 360, h: 20, type: 'stone' },
    { x: 940, y: 390, w: 400, h: 22, type: 'roof' },
    { x: 1060, y: 285, w: 160, h: 22, type: 'roof' },
    { x: 1440, y: 640, w: 200, h: 26, type: 'wood' },
    { x: 1700, y: 570, w: 230, h: 28, type: 'grass' },
    { x: 1980, y: 650, w: 210, h: 28, type: 'grass' },
    { x: 1980, y: 460, w: 190, h: 26, type: 'wood' },
    { x: 1480, y: 420, w: 200, h: 26, type: 'grass' },
    { x: 1730, y: 310, w: 210, h: 28, type: 'grass' },
    { x: 2260, y: 710, w: 170, h: 28, type: 'stone' },
    { x: 2470, y: 620, w: 200, h: 28, type: 'grass' },
    { x: 2720, y: 540, w: 200, h: 28, type: 'grass' },
    { x: 2740, y: 370, w: 210, h: 28, type: 'stone' },
    { x: 2990, y: 280, w: 220, h: 28, type: 'grass' },
    { x: 3180, y: 700, w: 220, h: 28, type: 'stone' },
    { x: 3420, y: 610, w: 210, h: 26, type: 'wood' },
    { x: 3650, y: 620, w: 230, h: 28, type: 'stone' },
    { x: 3780, y: 350, w: 220, h: 28, type: 'roof' },
    { x: 4180, y: 670, w: 220, h: 28, type: 'grass' },
    { x: 4440, y: 540, w: 230, h: 28, type: 'stone' },
    { x: 4720, y: 640, w: 210, h: 28, type: 'wood' },
    { x: 4820, y: 450, w: 210, h: 28, type: 'grass' },
    { x: 5020, y: 680, w: 460, h: 32, type: 'stone' },
];
exports.PLATFORMS = exports.STAGE1_PLATFORMS;
exports.QBLOCK_CANDIDATE_SPOTS = [
    { x: 380, y: 560 },
    { x: 740, y: 610 },
    { x: 1000, y: 440 },
    { x: 1220, y: 440 },
    { x: 1530, y: 550 },
    { x: 1810, y: 480 },
    { x: 2080, y: 560 },
    { x: 2350, y: 620 },
    { x: 2570, y: 530 },
    { x: 2820, y: 450 },
    { x: 3100, y: 570 },
    { x: 3300, y: 610 },
    { x: 3530, y: 520 },
    { x: 3770, y: 530 },
    { x: 4070, y: 580 },
    { x: 4290, y: 580 },
    { x: 4550, y: 450 },
    { x: 4790, y: 550 },
    { x: 4940, y: 590 },
    { x: 5220, y: 590 },
];
// --- STAGE 2: Menara Sunset (Sunset, Stone Stairs & Mild Hazards) ---
exports.STAGE2_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    { x: 40, y: 710, w: 220, h: 28, type: 'stone' },
    { x: 300, y: 640, w: 180, h: 26, type: 'crumble' },
    { x: 530, y: 580, w: 200, h: 28, type: 'stone' },
    { x: 780, y: 660, w: 180, h: 26, type: 'moving', baseX: 780, baseY: 660, moveAxis: 'x', moveRange: 120, moveSpeed: 0.002, movePhase: 0 },
    { x: 800, y: 794, w: 80, h: 26, type: 'spike' },
    { x: 1420, y: 794, w: 80, h: 26, type: 'spike' },
    { x: 2300, y: 794, w: 80, h: 26, type: 'spike' },
    { x: 3300, y: 794, w: 80, h: 26, type: 'spike' },
    { x: 4100, y: 794, w: 80, h: 26, type: 'spike' },
    { x: 980, y: 520, w: 320, h: 22, type: 'stone' },
    { x: 960, y: 390, w: 360, h: 22, type: 'roof' },
    { x: 1080, y: 280, w: 170, h: 22, type: 'roof' },
    { x: 900, y: 798, w: 64, h: 22, type: 'bounce' },
    { x: 1380, y: 470, w: 170, h: 26, type: 'moving', baseX: 1380, baseY: 470, moveAxis: 'y', moveRange: 140, moveSpeed: 0.0022, movePhase: 1.57 },
    { x: 1600, y: 630, w: 190, h: 26, type: 'crumble' },
    { x: 1840, y: 560, w: 200, h: 26, type: 'stone' },
    { x: 2080, y: 490, w: 190, h: 26, type: 'crumble' },
    { x: 1750, y: 340, w: 220, h: 26, type: 'roof' },
    { x: 1880, y: 794, w: 80, h: 26, type: 'fire' },
    { x: 2120, y: 798, w: 64, h: 22, type: 'bounce' },
    { x: 2320, y: 660, w: 240, h: 28, type: 'stone' },
    { x: 2600, y: 580, w: 200, h: 26, type: 'moving', baseX: 2600, baseY: 580, moveAxis: 'x', moveRange: 130, moveSpeed: 0.002, movePhase: 0.8 },
    { x: 2880, y: 500, w: 220, h: 26, type: 'stone' },
    { x: 3140, y: 430, w: 200, h: 26, type: 'crumble' },
    { x: 2800, y: 794, w: 80, h: 26, type: 'fire' },
    { x: 3040, y: 798, w: 64, h: 22, type: 'bounce' },
    { x: 3380, y: 680, w: 260, h: 28, type: 'stone' },
    { x: 3680, y: 600, w: 190, h: 26, type: 'moving', baseX: 3680, baseY: 600, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0024, movePhase: 2.1 },
    { x: 3920, y: 530, w: 220, h: 26, type: 'stone' },
    { x: 4180, y: 450, w: 200, h: 26, type: 'crumble' },
    { x: 3820, y: 360, w: 220, h: 26, type: 'roof' },
    { x: 3740, y: 794, w: 80, h: 26, type: 'fire' },
    { x: 4000, y: 798, w: 64, h: 22, type: 'bounce' },
    { x: 4420, y: 640, w: 220, h: 28, type: 'stone' },
    { x: 4680, y: 550, w: 210, h: 26, type: 'moving', baseX: 4680, baseY: 550, moveAxis: 'x', moveRange: 140, moveSpeed: 0.0022, movePhase: 0 },
    { x: 4940, y: 460, w: 220, h: 26, type: 'stone' },
    { x: 4620, y: 794, w: 80, h: 26, type: 'fire' },
    { x: 4860, y: 798, w: 64, h: 22, type: 'bounce' },
    { x: 5120, y: 680, w: 400, h: 32, type: 'stone' },
    { x: 5180, y: 520, w: 280, h: 26, type: 'roof' },
];
exports.STAGE2_QBLOCK_SPOTS = [
    { x: 360, y: 540 },
    { x: 590, y: 490 },
    { x: 800, y: 560 },
    { x: 1040, y: 440 },
    { x: 1140, y: 200 },
    { x: 1260, y: 440 },
    { x: 1440, y: 390 },
    { x: 1660, y: 550 },
    { x: 1840, y: 470 },
    { x: 2060, y: 410 },
    { x: 2420, y: 580 },
    { x: 2700, y: 500 },
    { x: 2940, y: 420 },
    { x: 3200, y: 350 },
    { x: 3440, y: 600 },
    { x: 3740, y: 520 },
    { x: 3980, y: 450 },
    { x: 4240, y: 370 },
    { x: 4480, y: 560 },
    { x: 4740, y: 470 },
    { x: 5000, y: 380 },
    { x: 5240, y: 440 },
];
// --- STAGE 3: Lembah Kipas Angin (Pengenalan Updraft Fan / Hembusan Angin ke Atas) ---
exports.STAGE3_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    { x: 40, y: 710, w: 220, h: 28, type: 'grass' },
    { x: 300, y: 650, w: 180, h: 26, type: 'grass' },
    // KIPAS ANGIN 1: Meniup player melambung tinggi ke grass island atas!
    { x: 620, y: 796, w: 84, h: 24, type: 'fan', moveRange: 450 },
    { x: 580, y: 440, w: 220, h: 28, type: 'grass' },
    { x: 860, y: 520, w: 200, h: 28, type: 'grass' },
    { x: 1120, y: 620, w: 220, h: 28, type: 'stone' },
    { x: 1380, y: 720, w: 180, h: 26, type: 'grass' },
    // KIPAS ANGIN 2: Peluncur langit
    { x: 1640, y: 796, w: 84, h: 24, type: 'fan', moveRange: 460 },
    { x: 1600, y: 410, w: 240, h: 28, type: 'grass' },
    { x: 1900, y: 490, w: 200, h: 26, type: 'wood' },
    { x: 2160, y: 590, w: 210, h: 28, type: 'grass' },
    { x: 2420, y: 680, w: 180, h: 26, type: 'stone' },
    // KIPAS ANGIN 3: Menerbangkan melewati jurang duri
    { x: 2680, y: 796, w: 84, h: 24, type: 'fan', moveRange: 480 },
    { x: 2780, y: 794, w: 90, h: 26, type: 'spike' },
    { x: 2640, y: 390, w: 250, h: 28, type: 'grass' },
    { x: 2950, y: 480, w: 210, h: 26, type: 'stone' },
    { x: 3220, y: 580, w: 200, h: 28, type: 'grass' },
    // KIPAS ANGIN 4
    { x: 3500, y: 796, w: 84, h: 24, type: 'fan', moveRange: 460 },
    { x: 3460, y: 400, w: 240, h: 28, type: 'roof' },
    { x: 3760, y: 490, w: 200, h: 26, type: 'wood' },
    { x: 4020, y: 590, w: 220, h: 28, type: 'grass' },
    { x: 4280, y: 690, w: 180, h: 26, type: 'stone' },
    // KIPAS ANGIN 5: Final soaring booster
    { x: 4520, y: 796, w: 84, h: 24, type: 'fan', moveRange: 500 },
    { x: 4480, y: 370, w: 240, h: 28, type: 'grass' },
    { x: 4780, y: 480, w: 220, h: 26, type: 'stone' },
    { x: 5060, y: 680, w: 420, h: 32, type: 'stone' },
    { x: 5140, y: 510, w: 260, h: 26, type: 'roof' },
];
exports.STAGE3_QBLOCK_SPOTS = [
    { x: 360, y: 570 },
    { x: 640, y: 360 },
    { x: 920, y: 440 },
    { x: 1180, y: 540 },
    { x: 1440, y: 640 },
    { x: 1680, y: 330 },
    { x: 1960, y: 410 },
    { x: 2220, y: 510 },
    { x: 2480, y: 600 },
    { x: 2720, y: 310 },
    { x: 3010, y: 400 },
    { x: 3280, y: 500 },
    { x: 3540, y: 320 },
    { x: 3820, y: 410 },
    { x: 4080, y: 510 },
    { x: 4340, y: 610 },
    { x: 4560, y: 290 },
    { x: 4840, y: 400 },
    { x: 5120, y: 600 },
    { x: 5260, y: 430 },
];
// --- STAGE 4: Bukit Balon Udara (Awan Melayang & Super Trampolin) ---
exports.STAGE4_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    { x: 40, y: 710, w: 220, h: 28, type: 'grass' },
    { x: 300, y: 650, w: 180, h: 26, type: 'grass' },
    { x: 540, y: 798, w: 70, h: 22, type: 'bounce' },
    { x: 500, y: 460, w: 240, h: 26, type: 'stone' },
    { x: 790, y: 540, w: 200, h: 26, type: 'grass' },
    { x: 1040, y: 640, w: 180, h: 26, type: 'wood' },
    { x: 1280, y: 798, w: 70, h: 22, type: 'bounce' },
    { x: 1240, y: 430, w: 240, h: 26, type: 'roof' },
    { x: 1540, y: 520, w: 210, h: 26, type: 'grass' },
    { x: 1800, y: 620, w: 190, h: 26, type: 'stone' },
    { x: 2040, y: 798, w: 70, h: 22, type: 'bounce' },
    { x: 2000, y: 410, w: 250, h: 26, type: 'roof' },
    { x: 2310, y: 510, w: 210, h: 26, type: 'grass' },
    { x: 2570, y: 610, w: 190, h: 26, type: 'wood' },
    { x: 2820, y: 798, w: 70, h: 22, type: 'bounce' },
    { x: 2780, y: 390, w: 250, h: 26, type: 'stone' },
    { x: 3090, y: 490, w: 210, h: 26, type: 'grass' },
    { x: 3350, y: 590, w: 190, h: 26, type: 'roof' },
    { x: 3600, y: 798, w: 70, h: 22, type: 'bounce' },
    { x: 3560, y: 370, w: 260, h: 26, type: 'grass' },
    { x: 3880, y: 480, w: 210, h: 26, type: 'wood' },
    { x: 4140, y: 590, w: 200, h: 26, type: 'stone' },
    { x: 4400, y: 798, w: 70, h: 22, type: 'bounce' },
    { x: 4360, y: 380, w: 240, h: 26, type: 'roof' },
    { x: 4660, y: 500, w: 210, h: 26, type: 'grass' },
    { x: 4920, y: 620, w: 190, h: 26, type: 'stone' },
    { x: 5140, y: 680, w: 380, h: 32, type: 'stone' },
];
exports.STAGE4_QBLOCK_SPOTS = [
    { x: 360, y: 570 },
    { x: 570, y: 380 },
    { x: 850, y: 460 },
    { x: 1100, y: 560 },
    { x: 1310, y: 350 },
    { x: 1600, y: 440 },
    { x: 1860, y: 540 },
    { x: 2070, y: 330 },
    { x: 2370, y: 430 },
    { x: 2630, y: 530 },
    { x: 2850, y: 310 },
    { x: 3150, y: 410 },
    { x: 3410, y: 510 },
    { x: 3630, y: 290 },
    { x: 3940, y: 400 },
    { x: 4200, y: 510 },
    { x: 4430, y: 300 },
    { x: 4720, y: 420 },
    { x: 4980, y: 540 },
    { x: 5250, y: 600 },
];
// --- STAGE 5: Galaksi Cyber Pemula (Cyber Grid & Senjata Blaster) ---
exports.STAGE5_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    { x: 40, y: 710, w: 220, h: 28, type: 'stone' },
    { x: 300, y: 640, w: 180, h: 26, type: 'stone' },
    { x: 530, y: 570, w: 190, h: 26, type: 'moving', baseX: 530, baseY: 570, moveAxis: 'x', moveRange: 110, moveSpeed: 0.002, movePhase: 0 },
    { x: 770, y: 500, w: 210, h: 26, type: 'stone' },
    { x: 900, y: 798, w: 64, h: 22, type: 'bounce' },
    { x: 1040, y: 620, w: 220, h: 26, type: 'stone' },
    { x: 1320, y: 530, w: 190, h: 26, type: 'moving', baseX: 1320, baseY: 530, moveAxis: 'y', moveRange: 120, moveSpeed: 0.0022, movePhase: 1.57 },
    { x: 1570, y: 450, w: 210, h: 26, type: 'stone' },
    { x: 1830, y: 540, w: 200, h: 26, type: 'crumble' },
    { x: 2080, y: 630, w: 220, h: 28, type: 'stone' },
    { x: 2360, y: 540, w: 190, h: 26, type: 'moving', baseX: 2360, baseY: 540, moveAxis: 'x', moveRange: 130, moveSpeed: 0.0022, movePhase: 0 },
    { x: 2610, y: 460, w: 210, h: 26, type: 'stone' },
    { x: 2870, y: 550, w: 200, h: 26, type: 'crumble' },
    { x: 3120, y: 640, w: 220, h: 28, type: 'stone' },
    { x: 3400, y: 550, w: 190, h: 26, type: 'moving', baseX: 3400, baseY: 550, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0023, movePhase: 1.0 },
    { x: 3650, y: 460, w: 220, h: 26, type: 'stone' },
    { x: 3930, y: 550, w: 200, h: 26, type: 'crumble' },
    { x: 4180, y: 640, w: 220, h: 28, type: 'stone' },
    { x: 4460, y: 550, w: 190, h: 26, type: 'moving', baseX: 4460, baseY: 550, moveAxis: 'x', moveRange: 130, moveSpeed: 0.0024, movePhase: 0 },
    { x: 4720, y: 460, w: 220, h: 26, type: 'stone' },
    { x: 5020, y: 680, w: 460, h: 32, type: 'stone' },
    { x: 5120, y: 520, w: 260, h: 26, type: 'roof' },
];
exports.STAGE5_QBLOCK_SPOTS = [
    { x: 360, y: 560 },
    { x: 590, y: 490 },
    { x: 830, y: 420 },
    { x: 1100, y: 540 },
    { x: 1380, y: 450 },
    { x: 1630, y: 370 },
    { x: 1890, y: 460 },
    { x: 2140, y: 550 },
    { x: 2420, y: 460 },
    { x: 2670, y: 380 },
    { x: 2930, y: 470 },
    { x: 3180, y: 560 },
    { x: 3460, y: 470 },
    { x: 3710, y: 380 },
    { x: 3990, y: 470 },
    { x: 4240, y: 560 },
    { x: 4520, y: 470 },
    { x: 4780, y: 380 },
    { x: 5080, y: 600 },
    { x: 5240, y: 440 },
];
// =========================================================================
// TIER 2: RINTANGAN SEDANG (STAGE 6 - 10)
// =========================================================================
// --- STAGE 6: Kastil Magma (Lahar Panas & Lift Vulkanik) ---
exports.STAGE6_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    { x: 40, y: 710, w: 220, h: 28, type: 'stone' },
    { x: 300, y: 630, w: 170, h: 26, type: 'fire' },
    { x: 520, y: 560, w: 190, h: 26, type: 'stone' },
    { x: 760, y: 640, w: 160, h: 24, type: 'moving', baseX: 760, baseY: 640, moveAxis: 'x', moveRange: 130, moveSpeed: 0.0022, movePhase: 0 },
    { x: 970, y: 500, w: 320, h: 22, type: 'fire' },
    { x: 960, y: 370, w: 360, h: 22, type: 'roof' },
    { x: 1060, y: 250, w: 170, h: 22, type: 'roof' },
    { x: 900, y: 798, w: 64, h: 22, type: 'bounce' },
    { x: 1360, y: 450, w: 160, h: 24, type: 'moving', baseX: 1360, baseY: 450, moveAxis: 'y', moveRange: 140, moveSpeed: 0.0025, movePhase: 1.57 },
    { x: 1570, y: 620, w: 150, h: 24, type: 'crumble' },
    { x: 1770, y: 540, w: 180, h: 24, type: 'stone' },
    { x: 2000, y: 460, w: 160, h: 24, type: 'fire' },
    { x: 1740, y: 310, w: 200, h: 24, type: 'roof' },
    { x: 1860, y: 794, w: 140, h: 26, type: 'fire' },
    { x: 2110, y: 798, w: 64, h: 22, type: 'bounce' },
    { x: 2240, y: 660, w: 260, h: 28, type: 'stone' },
    { x: 2550, y: 560, w: 180, h: 24, type: 'moving', baseX: 2550, baseY: 560, moveAxis: 'x', moveRange: 140, moveSpeed: 0.0024, movePhase: 0 },
    { x: 2830, y: 470, w: 200, h: 24, type: 'fire' },
    { x: 3080, y: 390, w: 180, h: 24, type: 'stone' },
    { x: 2800, y: 794, w: 150, h: 26, type: 'fire' },
    { x: 3050, y: 798, w: 64, h: 22, type: 'bounce' },
    { x: 3320, y: 660, w: 260, h: 28, type: 'stone' },
    { x: 3640, y: 570, w: 170, h: 24, type: 'moving', baseX: 3640, baseY: 570, moveAxis: 'y', moveRange: 140, moveSpeed: 0.0026, movePhase: 1.0 },
    { x: 3880, y: 480, w: 200, h: 24, type: 'fire' },
    { x: 4130, y: 390, w: 190, h: 24, type: 'stone' },
    { x: 3740, y: 794, w: 160, h: 26, type: 'fire' },
    { x: 4000, y: 798, w: 64, h: 22, type: 'bounce' },
    { x: 4380, y: 640, w: 220, h: 28, type: 'stone' },
    { x: 4660, y: 540, w: 180, h: 24, type: 'moving', baseX: 4660, baseY: 540, moveAxis: 'x', moveRange: 150, moveSpeed: 0.0024, movePhase: 0 },
    { x: 4920, y: 440, w: 200, h: 24, type: 'fire' },
    { x: 4600, y: 794, w: 160, h: 26, type: 'fire' },
    { x: 4840, y: 798, w: 64, h: 22, type: 'bounce' },
    { x: 5120, y: 680, w: 400, h: 32, type: 'stone' },
    { x: 5180, y: 520, w: 280, h: 26, type: 'roof' },
];
exports.STAGE6_QBLOCK_SPOTS = [
    { x: 360, y: 550 },
    { x: 580, y: 480 },
    { x: 810, y: 550 },
    { x: 1040, y: 420 },
    { x: 1140, y: 170 },
    { x: 1420, y: 370 },
    { x: 1640, y: 530 },
    { x: 1840, y: 460 },
    { x: 2070, y: 380 },
    { x: 2320, y: 580 },
    { x: 2600, y: 480 },
    { x: 2890, y: 390 },
    { x: 3140, y: 310 },
    { x: 3390, y: 580 },
    { x: 3700, y: 490 },
    { x: 3940, y: 400 },
    { x: 4190, y: 310 },
    { x: 4440, y: 560 },
    { x: 4720, y: 460 },
    { x: 4980, y: 360 },
    { x: 5240, y: 440 },
];
// --- STAGE 7: Hutan Neon Biolumin (Biolumin, Spora Bercahaya & Celah Neon) ---
exports.STAGE7_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    { x: 40, y: 710, w: 220, h: 28, type: 'wood' },
    { x: 300, y: 640, w: 180, h: 26, type: 'wood' },
    { x: 520, y: 570, w: 190, h: 26, type: 'crumble' },
    { x: 760, y: 650, w: 170, h: 24, type: 'moving', baseX: 760, baseY: 650, moveAxis: 'x', moveRange: 120, moveSpeed: 0.002, movePhase: 0 },
    { x: 990, y: 520, w: 240, h: 24, type: 'wood' },
    { x: 1280, y: 440, w: 210, h: 24, type: 'crumble' },
    { x: 1540, y: 530, w: 200, h: 24, type: 'wood' },
    { x: 1790, y: 620, w: 180, h: 24, type: 'moving', baseX: 1790, baseY: 620, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0022, movePhase: 1.0 },
    { x: 2030, y: 510, w: 220, h: 26, type: 'wood' },
    { x: 2310, y: 420, w: 200, h: 24, type: 'crumble' },
    { x: 2560, y: 520, w: 210, h: 24, type: 'wood' },
    { x: 2830, y: 610, w: 190, h: 24, type: 'moving', baseX: 2830, baseY: 610, moveAxis: 'x', moveRange: 130, moveSpeed: 0.0023, movePhase: 0 },
    { x: 3090, y: 500, w: 230, h: 26, type: 'wood' },
    { x: 3370, y: 410, w: 200, h: 24, type: 'crumble' },
    { x: 3620, y: 510, w: 210, h: 24, type: 'wood' },
    { x: 3890, y: 600, w: 180, h: 24, type: 'moving', baseX: 3890, baseY: 600, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0024, movePhase: 1.5 },
    { x: 4130, y: 490, w: 220, h: 26, type: 'wood' },
    { x: 4410, y: 400, w: 200, h: 24, type: 'crumble' },
    { x: 4670, y: 510, w: 220, h: 26, type: 'wood' },
    { x: 4950, y: 610, w: 200, h: 26, type: 'wood' },
    { x: 5120, y: 680, w: 400, h: 32, type: 'wood' },
];
exports.STAGE7_QBLOCK_SPOTS = [
    { x: 360, y: 560 },
    { x: 580, y: 490 },
    { x: 820, y: 560 },
    { x: 1060, y: 440 },
    { x: 1340, y: 360 },
    { x: 1600, y: 450 },
    { x: 1850, y: 530 },
    { x: 2100, y: 430 },
    { x: 2370, y: 340 },
    { x: 2620, y: 440 },
    { x: 2890, y: 520 },
    { x: 3150, y: 420 },
    { x: 3430, y: 330 },
    { x: 3680, y: 430 },
    { x: 3950, y: 510 },
    { x: 4190, y: 410 },
    { x: 4470, y: 320 },
    { x: 4730, y: 430 },
    { x: 5010, y: 530 },
    { x: 5240, y: 600 },
];
// --- STAGE 8: Kota Roda Gigi (Conveyor Belt & Gir Mesin) ---
exports.STAGE8_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    { x: 40, y: 710, w: 220, h: 28, type: 'stone' },
    { x: 300, y: 640, w: 200, h: 26, type: 'conveyor', conveyorDir: 1 },
    { x: 550, y: 560, w: 180, h: 24, type: 'moving', baseX: 550, baseY: 560, moveAxis: 'x', moveRange: 120, moveSpeed: 0.0022, movePhase: 0 },
    { x: 790, y: 480, w: 210, h: 26, type: 'conveyor', conveyorDir: -1 },
    { x: 1060, y: 570, w: 220, h: 26, type: 'stone' },
    { x: 1340, y: 480, w: 190, h: 24, type: 'moving', baseX: 1340, baseY: 480, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0024, movePhase: 1.0 },
    { x: 1590, y: 400, w: 210, h: 26, type: 'conveyor', conveyorDir: 1 },
    { x: 1860, y: 510, w: 200, h: 26, type: 'stone' },
    { x: 2120, y: 600, w: 220, h: 26, type: 'conveyor', conveyorDir: -1 },
    { x: 2400, y: 510, w: 190, h: 24, type: 'moving', baseX: 2400, baseY: 510, moveAxis: 'x', moveRange: 130, moveSpeed: 0.0023, movePhase: 0 },
    { x: 2650, y: 420, w: 220, h: 26, type: 'conveyor', conveyorDir: 1 },
    { x: 2930, y: 520, w: 210, h: 26, type: 'stone' },
    { x: 3200, y: 610, w: 220, h: 26, type: 'conveyor', conveyorDir: -1 },
    { x: 3480, y: 520, w: 190, h: 24, type: 'moving', baseX: 3480, baseY: 520, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0025, movePhase: 1.5 },
    { x: 3730, y: 430, w: 220, h: 26, type: 'conveyor', conveyorDir: 1 },
    { x: 4010, y: 530, w: 210, h: 26, type: 'stone' },
    { x: 4280, y: 620, w: 220, h: 26, type: 'conveyor', conveyorDir: -1 },
    { x: 4560, y: 520, w: 190, h: 24, type: 'moving', baseX: 4560, baseY: 520, moveAxis: 'x', moveRange: 130, moveSpeed: 0.0024, movePhase: 0 },
    { x: 4810, y: 430, w: 220, h: 26, type: 'conveyor', conveyorDir: 1 },
    { x: 5080, y: 680, w: 440, h: 32, type: 'stone' },
];
exports.STAGE8_QBLOCK_SPOTS = [
    { x: 360, y: 560 },
    { x: 610, y: 480 },
    { x: 860, y: 400 },
    { x: 1120, y: 490 },
    { x: 1400, y: 400 },
    { x: 1650, y: 320 },
    { x: 1920, y: 430 },
    { x: 2180, y: 520 },
    { x: 2460, y: 430 },
    { x: 2710, y: 340 },
    { x: 2990, y: 440 },
    { x: 3260, y: 530 },
    { x: 3540, y: 440 },
    { x: 3790, y: 350 },
    { x: 4070, y: 450 },
    { x: 4340, y: 540 },
    { x: 4620, y: 440 },
    { x: 4870, y: 350 },
    { x: 5140, y: 600 },
    { x: 5260, y: 440 },
];
// --- STAGE 9: Samudra Es Kutub (Es Licin & Runtuhan Gletser) ---
exports.STAGE9_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    { x: 40, y: 710, w: 220, h: 28, type: 'stone' },
    { x: 300, y: 630, w: 180, h: 26, type: 'crumble' },
    { x: 530, y: 550, w: 200, h: 26, type: 'conveyor', conveyorDir: 1, conveyorSpeed: 2.8 },
    { x: 790, y: 640, w: 180, h: 24, type: 'moving', baseX: 790, baseY: 640, moveAxis: 'x', moveRange: 130, moveSpeed: 0.0022, movePhase: 0 },
    { x: 1030, y: 520, w: 220, h: 26, type: 'crumble' },
    { x: 1310, y: 440, w: 210, h: 26, type: 'conveyor', conveyorDir: -1, conveyorSpeed: 2.8 },
    { x: 1580, y: 530, w: 180, h: 24, type: 'moving', baseX: 1580, baseY: 530, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0024, movePhase: 1.0 },
    { x: 1820, y: 420, w: 200, h: 26, type: 'crumble' },
    { x: 2080, y: 520, w: 220, h: 26, type: 'conveyor', conveyorDir: 1, conveyorSpeed: 3.0 },
    { x: 2360, y: 610, w: 190, h: 26, type: 'crumble' },
    { x: 2610, y: 500, w: 210, h: 26, type: 'conveyor', conveyorDir: -1, conveyorSpeed: 3.0 },
    { x: 2880, y: 410, w: 190, h: 26, type: 'crumble' },
    { x: 3130, y: 510, w: 220, h: 26, type: 'conveyor', conveyorDir: 1, conveyorSpeed: 3.0 },
    { x: 3410, y: 600, w: 180, h: 24, type: 'moving', baseX: 3410, baseY: 600, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0025, movePhase: 1.5 },
    { x: 3650, y: 490, w: 210, h: 26, type: 'crumble' },
    { x: 3920, y: 400, w: 220, h: 26, type: 'conveyor', conveyorDir: -1, conveyorSpeed: 3.0 },
    { x: 4200, y: 510, w: 190, h: 26, type: 'crumble' },
    { x: 4450, y: 600, w: 210, h: 26, type: 'conveyor', conveyorDir: 1, conveyorSpeed: 3.0 },
    { x: 4720, y: 490, w: 200, h: 26, type: 'crumble' },
    { x: 5020, y: 680, w: 460, h: 32, type: 'stone' },
];
exports.STAGE9_QBLOCK_SPOTS = [
    { x: 360, y: 550 },
    { x: 590, y: 470 },
    { x: 850, y: 560 },
    { x: 1090, y: 440 },
    { x: 1370, y: 360 },
    { x: 1640, y: 450 },
    { x: 1880, y: 340 },
    { x: 2140, y: 440 },
    { x: 2420, y: 530 },
    { x: 2670, y: 420 },
    { x: 2940, y: 330 },
    { x: 3190, y: 430 },
    { x: 3470, y: 520 },
    { x: 3710, y: 410 },
    { x: 3980, y: 320 },
    { x: 4260, y: 430 },
    { x: 4510, y: 520 },
    { x: 4780, y: 410 },
    { x: 5080, y: 600 },
    { x: 5250, y: 440 },
];
// --- STAGE 10: Penerbangan Awan Pesawat (Pengenalan Plane Ride / Naik Pesawat Melintasi Awan!) ---
exports.STAGE10_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    // Pijakan awal bandara awan
    { x: 40, y: 710, w: 260, h: 28, type: 'stone' },
    { x: 340, y: 650, w: 200, h: 26, type: 'roof' },
    // PESAWAT 1: Pesawat jelajah awan pertama (bisa diinjak & dinaiki player!)
    { x: 620, y: 560, w: 220, h: 32, type: 'plane', baseX: 620, baseY: 560, moveAxis: 'x', moveRange: 280, moveSpeed: 0.0018, movePhase: 0 },
    // Pulau awan penghubung 1
    { x: 1140, y: 480, w: 220, h: 26, type: 'grass' },
    { x: 1420, y: 560, w: 200, h: 26, type: 'roof' },
    // PESAWAT 2: Pesawat tempur supersonik
    { x: 1700, y: 500, w: 230, h: 32, type: 'plane', baseX: 1700, baseY: 500, moveAxis: 'x', moveRange: 320, moveSpeed: 0.002, movePhase: 1.57 },
    // Pulau awan penghubung 2
    { x: 2260, y: 440, w: 240, h: 26, type: 'grass' },
    { x: 2560, y: 520, w: 210, h: 26, type: 'roof' },
    // PESAWAT 3: Pesawat jet jelajah tinggi
    { x: 2860, y: 470, w: 240, h: 32, type: 'plane', baseX: 2860, baseY: 470, moveAxis: 'x', moveRange: 340, moveSpeed: 0.0021, movePhase: 0.5 },
    // Pulau awan penghubung 3
    { x: 3440, y: 420, w: 230, h: 26, type: 'grass' },
    { x: 3740, y: 500, w: 220, h: 26, type: 'stone' },
    // PESAWAT 4: Pesawat pengangkut akhir
    { x: 4040, y: 460, w: 250, h: 32, type: 'plane', baseX: 4040, baseY: 460, moveAxis: 'x', moveRange: 350, moveSpeed: 0.0022, movePhase: 2.1 },
    // Landasan pendaratan akhir
    { x: 4620, y: 520, w: 260, h: 28, type: 'roof' },
    { x: 4940, y: 620, w: 260, h: 28, type: 'stone' },
    { x: 5120, y: 680, w: 400, h: 32, type: 'stone' },
];
exports.STAGE10_QBLOCK_SPOTS = [
    { x: 380, y: 570 },
    { x: 730, y: 460 },
    { x: 920, y: 460 },
    { x: 1200, y: 400 },
    { x: 1480, y: 480 },
    { x: 1810, y: 400 },
    { x: 2010, y: 400 },
    { x: 2320, y: 360 },
    { x: 2620, y: 440 },
    { x: 2970, y: 370 },
    { x: 3170, y: 370 },
    { x: 3500, y: 340 },
    { x: 3800, y: 420 },
    { x: 4150, y: 360 },
    { x: 4350, y: 360 },
    { x: 4680, y: 440 },
    { x: 5000, y: 540 },
    { x: 5240, y: 600 },
    { x: 5180, y: 450 },
    { x: 150, y: 630 },
];
// =========================================================================
// TIER 3: RINTANGAN SULIT (STAGE 11 - 15)
// =========================================================================
// --- STAGE 11: Badai Petir Angkasa (Awan Petir Mematikan & Kipas Badai) ---
exports.STAGE11_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    { x: 40, y: 710, w: 220, h: 28, type: 'stone' },
    { x: 300, y: 640, w: 180, h: 26, type: 'stone' },
    // AWAN PETIR 1 (Menghindar sambaran listrik!)
    { x: 540, y: 560, w: 140, h: 36, type: 'thunder' },
    // Kipas untuk melompati petir
    { x: 460, y: 796, w: 76, h: 24, type: 'fan', moveRange: 460 },
    { x: 740, y: 460, w: 200, h: 26, type: 'stone' },
    { x: 1000, y: 560, w: 190, h: 26, type: 'crumble' },
    // AWAN PETIR 2
    { x: 1250, y: 480, w: 150, h: 36, type: 'thunder' },
    { x: 1180, y: 796, w: 76, h: 24, type: 'fan', moveRange: 480 },
    { x: 1460, y: 390, w: 210, h: 26, type: 'stone' },
    { x: 1730, y: 490, w: 190, h: 26, type: 'moving', baseX: 1730, baseY: 490, moveAxis: 'y', moveRange: 130, moveSpeed: 0.0024, movePhase: 1.0 },
    // AWAN PETIR 3
    { x: 1980, y: 420, w: 150, h: 36, type: 'thunder' },
    { x: 2190, y: 360, w: 220, h: 26, type: 'stone' },
    { x: 2470, y: 460, w: 190, h: 26, type: 'crumble' },
    // AWAN PETIR 4
    { x: 2720, y: 400, w: 160, h: 36, type: 'thunder' },
    { x: 2640, y: 796, w: 76, h: 24, type: 'fan', moveRange: 480 },
    { x: 2940, y: 330, w: 220, h: 26, type: 'stone' },
    { x: 3220, y: 440, w: 190, h: 26, type: 'moving', baseX: 3220, baseY: 440, moveAxis: 'x', moveRange: 140, moveSpeed: 0.0023, movePhase: 0 },
    // AWAN PETIR 5
    { x: 3480, y: 380, w: 160, h: 36, type: 'thunder' },
    { x: 3700, y: 330, w: 220, h: 26, type: 'stone' },
    { x: 3980, y: 440, w: 190, h: 26, type: 'crumble' },
    // AWAN PETIR 6
    { x: 4230, y: 380, w: 160, h: 36, type: 'thunder' },
    { x: 4160, y: 796, w: 76, h: 24, type: 'fan', moveRange: 500 },
    { x: 4450, y: 330, w: 220, h: 26, type: 'stone' },
    { x: 4730, y: 450, w: 200, h: 26, type: 'moving', baseX: 4730, baseY: 450, moveAxis: 'y', moveRange: 140, moveSpeed: 0.0025, movePhase: 0.5 },
    { x: 5040, y: 680, w: 440, h: 32, type: 'stone' },
];
exports.STAGE11_QBLOCK_SPOTS = [
    { x: 360, y: 560 },
    { x: 800, y: 380 },
    { x: 1060, y: 480 },
    { x: 1520, y: 310 },
    { x: 1790, y: 410 },
    { x: 2250, y: 280 },
    { x: 2530, y: 380 },
    { x: 3000, y: 250 },
    { x: 3280, y: 360 },
    { x: 3760, y: 250 },
    { x: 4040, y: 360 },
    { x: 4510, y: 250 },
    { x: 4790, y: 370 },
    { x: 5100, y: 600 },
    { x: 5260, y: 450 },
    { x: 920, y: 620 },
    { x: 1650, y: 620 },
    { x: 2380, y: 620 },
    { x: 3100, y: 620 },
    { x: 3840, y: 620 },
];
// --- STAGE 12: Gurun Reruntuhan Kuno (Pasir Hisap, Reruntuhan Batu & Jurang) ---
exports.STAGE12_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    { x: 40, y: 710, w: 220, h: 28, type: 'stone' },
    { x: 300, y: 640, w: 180, h: 26, type: 'conveyor', conveyorDir: -1, conveyorSpeed: 2.5 },
    { x: 540, y: 560, w: 190, h: 24, type: 'crumble' },
    { x: 790, y: 470, w: 210, h: 26, type: 'stone' },
    { x: 1060, y: 570, w: 180, h: 24, type: 'moving', baseX: 1060, baseY: 570, moveAxis: 'x', moveRange: 130, moveSpeed: 0.0024, movePhase: 0 },
    { x: 1310, y: 480, w: 210, h: 26, type: 'conveyor', conveyorDir: 1, conveyorSpeed: 2.6 },
    { x: 1580, y: 390, w: 200, h: 24, type: 'crumble' },
    { x: 1840, y: 490, w: 220, h: 26, type: 'stone' },
    { x: 2120, y: 590, w: 190, h: 24, type: 'moving', baseX: 2120, baseY: 590, moveAxis: 'y', moveRange: 140, moveSpeed: 0.0025, movePhase: 1.0 },
    { x: 2370, y: 490, w: 210, h: 26, type: 'conveyor', conveyorDir: -1, conveyorSpeed: 2.8 },
    { x: 2640, y: 400, w: 200, h: 24, type: 'crumble' },
    { x: 2900, y: 500, w: 220, h: 26, type: 'stone' },
    { x: 3180, y: 600, w: 190, h: 24, type: 'moving', baseX: 3180, baseY: 600, moveAxis: 'x', moveRange: 140, moveSpeed: 0.0026, movePhase: 0 },
    { x: 3430, y: 500, w: 210, h: 26, type: 'conveyor', conveyorDir: 1, conveyorSpeed: 3.0 },
    { x: 3700, y: 410, w: 200, h: 24, type: 'crumble' },
    { x: 3960, y: 510, w: 220, h: 26, type: 'stone' },
    { x: 4240, y: 610, w: 190, h: 24, type: 'moving', baseX: 4240, baseY: 610, moveAxis: 'y', moveRange: 140, moveSpeed: 0.0026, movePhase: 1.5 },
    { x: 4490, y: 500, w: 220, h: 26, type: 'conveyor', conveyorDir: -1, conveyorSpeed: 3.0 },
    { x: 4770, y: 410, w: 200, h: 24, type: 'crumble' },
    { x: 5040, y: 680, w: 440, h: 32, type: 'stone' },
];
exports.STAGE12_QBLOCK_SPOTS = [
    { x: 360, y: 560 },
    { x: 600, y: 480 },
    { x: 850, y: 390 },
    { x: 1120, y: 490 },
    { x: 1370, y: 400 },
    { x: 1640, y: 310 },
    { x: 1900, y: 410 },
    { x: 2180, y: 510 },
    { x: 2430, y: 410 },
    { x: 2700, y: 320 },
    { x: 2960, y: 420 },
    { x: 3240, y: 520 },
    { x: 3490, y: 420 },
    { x: 3760, y: 330 },
    { x: 4020, y: 430 },
    { x: 4300, y: 530 },
    { x: 4550, y: 420 },
    { x: 4830, y: 330 },
    { x: 5100, y: 600 },
    { x: 5260, y: 450 },
];
// --- STAGE 13: Lab Drone Pengintai (Musuh Drone Patroli Udara & Laser) ---
exports.STAGE13_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    { x: 40, y: 710, w: 220, h: 28, type: 'stone' },
    { x: 300, y: 640, w: 180, h: 26, type: 'stone' },
    { x: 540, y: 560, w: 190, h: 24, type: 'moving', baseX: 540, baseY: 560, moveAxis: 'x', moveRange: 130, moveSpeed: 0.0024, movePhase: 0 },
    { x: 800, y: 480, w: 210, h: 26, type: 'stone' },
    { x: 1070, y: 570, w: 190, h: 24, type: 'moving', baseX: 1070, baseY: 570, moveAxis: 'y', moveRange: 140, moveSpeed: 0.0026, movePhase: 1.0 },
    { x: 1330, y: 470, w: 210, h: 26, type: 'stone' },
    { x: 1600, y: 390, w: 200, h: 24, type: 'crumble' },
    { x: 1860, y: 490, w: 220, h: 26, type: 'stone' },
    { x: 2140, y: 580, w: 190, h: 24, type: 'moving', baseX: 2140, baseY: 580, moveAxis: 'x', moveRange: 140, moveSpeed: 0.0025, movePhase: 0.5 },
    { x: 2400, y: 480, w: 210, h: 26, type: 'stone' },
    { x: 2670, y: 390, w: 200, h: 24, type: 'crumble' },
    { x: 2930, y: 490, w: 220, h: 26, type: 'stone' },
    { x: 3210, y: 580, w: 190, h: 24, type: 'moving', baseX: 3210, baseY: 580, moveAxis: 'y', moveRange: 140, moveSpeed: 0.0027, movePhase: 1.5 },
    { x: 3460, y: 480, w: 210, h: 26, type: 'stone' },
    { x: 3730, y: 390, w: 200, h: 24, type: 'crumble' },
    { x: 3990, y: 490, w: 220, h: 26, type: 'stone' },
    { x: 4270, y: 580, w: 190, h: 24, type: 'moving', baseX: 4270, baseY: 580, moveAxis: 'x', moveRange: 140, moveSpeed: 0.0026, movePhase: 0 },
    { x: 4520, y: 480, w: 210, h: 26, type: 'stone' },
    { x: 4790, y: 390, w: 200, h: 24, type: 'crumble' },
    { x: 5040, y: 680, w: 440, h: 32, type: 'stone' },
];
exports.STAGE13_QBLOCK_SPOTS = [
    { x: 360, y: 560 },
    { x: 600, y: 480 },
    { x: 860, y: 400 },
    { x: 1130, y: 490 },
    { x: 1390, y: 390 },
    { x: 1660, y: 310 },
    { x: 1920, y: 410 },
    { x: 2200, y: 500 },
    { x: 2460, y: 400 },
    { x: 2730, y: 310 },
    { x: 2990, y: 410 },
    { x: 3270, y: 500 },
    { x: 3520, y: 400 },
    { x: 3790, y: 310 },
    { x: 4050, y: 410 },
    { x: 4330, y: 500 },
    { x: 4580, y: 400 },
    { x: 4850, y: 310 },
    { x: 5100, y: 600 },
    { x: 5260, y: 450 },
];
// --- STAGE 14: Sarang Mutasi Biohazard (Lumpur Beracun, Kipas Berbahaya & Duri) ---
exports.STAGE14_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    { x: 40, y: 710, w: 220, h: 28, type: 'stone' },
    { x: 300, y: 630, w: 170, h: 24, type: 'fire' },
    { x: 530, y: 550, w: 180, h: 24, type: 'crumble' },
    { x: 770, y: 640, w: 160, h: 24, type: 'moving', baseX: 770, baseY: 640, moveAxis: 'x', moveRange: 130, moveSpeed: 0.0024, movePhase: 0 },
    { x: 990, y: 510, w: 220, h: 26, type: 'fire' },
    { x: 1260, y: 420, w: 190, h: 24, type: 'crumble' },
    { x: 1520, y: 520, w: 180, h: 24, type: 'moving', baseX: 1520, baseY: 520, moveAxis: 'y', moveRange: 140, moveSpeed: 0.0026, movePhase: 1.0 },
    { x: 1760, y: 410, w: 210, h: 26, type: 'fire' },
    { x: 2040, y: 500, w: 180, h: 24, type: 'crumble' },
    { x: 2290, y: 600, w: 220, h: 26, type: 'stone' },
    { x: 2570, y: 500, w: 180, h: 24, type: 'moving', baseX: 2570, baseY: 500, moveAxis: 'x', moveRange: 140, moveSpeed: 0.0025, movePhase: 0 },
    { x: 2820, y: 400, w: 210, h: 26, type: 'fire' },
    { x: 3090, y: 490, w: 180, h: 24, type: 'crumble' },
    { x: 3340, y: 590, w: 220, h: 26, type: 'stone' },
    { x: 3620, y: 490, w: 180, h: 24, type: 'moving', baseX: 3620, baseY: 490, moveAxis: 'y', moveRange: 140, moveSpeed: 0.0027, movePhase: 1.5 },
    { x: 3870, y: 390, w: 210, h: 26, type: 'fire' },
    { x: 4140, y: 490, w: 180, h: 24, type: 'crumble' },
    { x: 4390, y: 590, w: 220, h: 26, type: 'stone' },
    { x: 4670, y: 490, w: 180, h: 24, type: 'moving', baseX: 4670, baseY: 490, moveAxis: 'x', moveRange: 140, moveSpeed: 0.0026, movePhase: 0 },
    { x: 4920, y: 390, w: 210, h: 26, type: 'fire' },
    { x: 5120, y: 680, w: 400, h: 32, type: 'stone' },
];
exports.STAGE14_QBLOCK_SPOTS = [
    { x: 360, y: 550 },
    { x: 590, y: 470 },
    { x: 830, y: 560 },
    { x: 1050, y: 430 },
    { x: 1320, y: 340 },
    { x: 1580, y: 440 },
    { x: 1820, y: 330 },
    { x: 2100, y: 420 },
    { x: 2350, y: 520 },
    { x: 2630, y: 420 },
    { x: 2880, y: 320 },
    { x: 3150, y: 410 },
    { x: 3400, y: 510 },
    { x: 3680, y: 410 },
    { x: 3930, y: 310 },
    { x: 4200, y: 410 },
    { x: 4450, y: 510 },
    { x: 4730, y: 410 },
    { x: 4980, y: 310 },
    { x: 5240, y: 600 },
];
// --- STAGE 15: Benteng Magma Neraka (Lautan Lahar Luas & Lift Vulkanik Sempit) ---
exports.STAGE15_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    { x: 40, y: 710, w: 220, h: 28, type: 'stone' },
    { x: 300, y: 640, w: 180, h: 26, type: 'fire' },
    { x: 540, y: 560, w: 150, h: 24, type: 'moving', baseX: 540, baseY: 560, moveAxis: 'x', moveRange: 140, moveSpeed: 0.0026, movePhase: 0 },
    { x: 790, y: 470, w: 200, h: 26, type: 'fire' },
    { x: 1060, y: 570, w: 150, h: 24, type: 'moving', baseX: 1060, baseY: 570, moveAxis: 'y', moveRange: 150, moveSpeed: 0.0028, movePhase: 1.0 },
    { x: 1300, y: 460, w: 210, h: 26, type: 'fire' },
    { x: 1580, y: 370, w: 170, h: 24, type: 'crumble' },
    { x: 1840, y: 480, w: 200, h: 26, type: 'fire' },
    { x: 2120, y: 580, w: 150, h: 24, type: 'moving', baseX: 2120, baseY: 580, moveAxis: 'x', moveRange: 150, moveSpeed: 0.0027, movePhase: 0.5 },
    { x: 2370, y: 470, w: 210, h: 26, type: 'fire' },
    { x: 2650, y: 370, w: 170, h: 24, type: 'crumble' },
    { x: 2900, y: 480, w: 200, h: 26, type: 'fire' },
    { x: 3180, y: 580, w: 150, h: 24, type: 'moving', baseX: 3180, baseY: 580, moveAxis: 'y', moveRange: 150, moveSpeed: 0.0029, movePhase: 1.5 },
    { x: 3430, y: 470, w: 210, h: 26, type: 'fire' },
    { x: 3710, y: 370, w: 170, h: 24, type: 'crumble' },
    { x: 3960, y: 480, w: 200, h: 26, type: 'fire' },
    { x: 4240, y: 580, w: 150, h: 24, type: 'moving', baseX: 4240, baseY: 580, moveAxis: 'x', moveRange: 150, moveSpeed: 0.0028, movePhase: 0 },
    { x: 4490, y: 470, w: 210, h: 26, type: 'fire' },
    { x: 4770, y: 370, w: 170, h: 24, type: 'crumble' },
    { x: 5040, y: 680, w: 440, h: 32, type: 'stone' },
];
exports.STAGE15_QBLOCK_SPOTS = [
    { x: 360, y: 560 },
    { x: 600, y: 480 },
    { x: 850, y: 390 },
    { x: 1120, y: 490 },
    { x: 1360, y: 380 },
    { x: 1640, y: 290 },
    { x: 1900, y: 400 },
    { x: 2180, y: 500 },
    { x: 2430, y: 390 },
    { x: 2710, y: 290 },
    { x: 2960, y: 400 },
    { x: 3240, y: 500 },
    { x: 3490, y: 390 },
    { x: 3770, y: 290 },
    { x: 4020, y: 400 },
    { x: 4300, y: 500 },
    { x: 4550, y: 390 },
    { x: 4830, y: 290 },
    { x: 5100, y: 600 },
    { x: 5260, y: 450 },
];
// =========================================================================
// TIER 4: RINTANGAN GAK MASUK AKAL / EKSTREM (STAGE 16 - 20)
// =========================================================================
// --- STAGE 16: Formasi Tempur Pesawat Langit (Parkour Antar-Pesawat Cepat & Awan Petir di Jurang Langit!) ---
exports.STAGE16_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    // Pijakan lepas landas
    { x: 40, y: 710, w: 220, h: 28, type: 'stone' },
    { x: 300, y: 630, w: 180, h: 26, type: 'crumble' },
    // PESAWAT TEMPUR 1 (Bergerak cepat melintasi langit)
    { x: 580, y: 520, w: 220, h: 32, type: 'plane', baseX: 580, baseY: 520, moveAxis: 'x', moveRange: 320, moveSpeed: 0.0028, movePhase: 0 },
    // Rintangan badai petir di antara jalur pesawat
    { x: 1100, y: 450, w: 140, h: 36, type: 'thunder' },
    // PESAWAT TEMPUR 2
    { x: 1350, y: 480, w: 230, h: 32, type: 'plane', baseX: 1350, baseY: 480, moveAxis: 'x', moveRange: 340, moveSpeed: 0.003, movePhase: 1.57 },
    // Awan petir kedua
    { x: 1920, y: 420, w: 150, h: 36, type: 'thunder' },
    // Kipas darurat di awan bawah
    { x: 2000, y: 796, w: 80, h: 24, type: 'fan', moveRange: 520 },
    // PESAWAT TEMPUR 3
    { x: 2200, y: 440, w: 240, h: 32, type: 'plane', baseX: 2200, baseY: 440, moveAxis: 'x', moveRange: 360, moveSpeed: 0.0032, movePhase: 0.8 },
    // Awan petir ketiga
    { x: 2800, y: 380, w: 160, h: 36, type: 'thunder' },
    // PESAWAT TEMPUR 4
    { x: 3060, y: 420, w: 240, h: 32, type: 'plane', baseX: 3060, baseY: 420, moveAxis: 'x', moveRange: 360, moveSpeed: 0.0033, movePhase: 2.1 },
    // Awan petir keempat
    { x: 3680, y: 370, w: 160, h: 36, type: 'thunder' },
    // Kipas darurat kedua
    { x: 3740, y: 796, w: 80, h: 24, type: 'fan', moveRange: 520 },
    // PESAWAT TEMPUR 5
    { x: 3950, y: 400, w: 250, h: 32, type: 'plane', baseX: 3950, baseY: 400, moveAxis: 'x', moveRange: 380, moveSpeed: 0.0034, movePhase: 1.2 },
    // Pendaratan akhir
    { x: 4620, y: 480, w: 220, h: 28, type: 'crumble' },
    { x: 4920, y: 580, w: 220, h: 28, type: 'stone' },
    { x: 5120, y: 680, w: 400, h: 32, type: 'stone' },
];
exports.STAGE16_QBLOCK_SPOTS = [
    { x: 360, y: 550 },
    { x: 700, y: 420 },
    { x: 920, y: 420 },
    { x: 1470, y: 380 },
    { x: 1720, y: 380 },
    { x: 2320, y: 340 },
    { x: 2580, y: 340 },
    { x: 3180, y: 320 },
    { x: 3440, y: 320 },
    { x: 4070, y: 300 },
    { x: 4330, y: 300 },
    { x: 4680, y: 400 },
    { x: 4980, y: 500 },
    { x: 5240, y: 600 },
    { x: 5180, y: 440 },
    { x: 1200, y: 620 },
    { x: 2100, y: 620 },
    { x: 3000, y: 620 },
    { x: 3880, y: 620 },
    { x: 150, y: 630 },
];
// --- STAGE 17: Koridor Robot Mecha (Patroli Robot Mecha & Conveyor Maut) ---
exports.STAGE17_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    { x: 40, y: 710, w: 220, h: 28, type: 'stone' },
    { x: 300, y: 640, w: 180, h: 26, type: 'conveyor', conveyorDir: -1, conveyorSpeed: 3.5 },
    { x: 540, y: 550, w: 170, h: 24, type: 'moving', baseX: 540, baseY: 550, moveAxis: 'x', moveRange: 140, moveSpeed: 0.0028, movePhase: 0 },
    { x: 790, y: 460, w: 210, h: 26, type: 'conveyor', conveyorDir: 1, conveyorSpeed: 3.5 },
    { x: 1070, y: 550, w: 170, h: 24, type: 'moving', baseX: 1070, baseY: 550, moveAxis: 'y', moveRange: 150, moveSpeed: 0.003, movePhase: 1.0 },
    { x: 1320, y: 450, w: 210, h: 26, type: 'conveyor', conveyorDir: -1, conveyorSpeed: 3.5 },
    { x: 1600, y: 360, w: 180, h: 24, type: 'crumble' },
    { x: 1860, y: 460, w: 210, h: 26, type: 'conveyor', conveyorDir: 1, conveyorSpeed: 3.5 },
    { x: 2140, y: 560, w: 170, h: 24, type: 'moving', baseX: 2140, baseY: 560, moveAxis: 'x', moveRange: 150, moveSpeed: 0.0029, movePhase: 0.5 },
    { x: 2390, y: 460, w: 210, h: 26, type: 'conveyor', conveyorDir: -1, conveyorSpeed: 3.6 },
    { x: 2670, y: 360, w: 180, h: 24, type: 'crumble' },
    { x: 2930, y: 460, w: 210, h: 26, type: 'conveyor', conveyorDir: 1, conveyorSpeed: 3.6 },
    { x: 3210, y: 560, w: 170, h: 24, type: 'moving', baseX: 3210, baseY: 560, moveAxis: 'y', moveRange: 150, moveSpeed: 0.0031, movePhase: 1.5 },
    { x: 3460, y: 460, w: 210, h: 26, type: 'conveyor', conveyorDir: -1, conveyorSpeed: 3.8 },
    { x: 3740, y: 360, w: 180, h: 24, type: 'crumble' },
    { x: 4000, y: 460, w: 210, h: 26, type: 'conveyor', conveyorDir: 1, conveyorSpeed: 3.8 },
    { x: 4280, y: 560, w: 170, h: 24, type: 'moving', baseX: 4280, baseY: 560, moveAxis: 'x', moveRange: 150, moveSpeed: 0.003, movePhase: 0 },
    { x: 4530, y: 460, w: 210, h: 26, type: 'conveyor', conveyorDir: -1, conveyorSpeed: 3.8 },
    { x: 4810, y: 360, w: 180, h: 24, type: 'crumble' },
    { x: 5040, y: 680, w: 440, h: 32, type: 'stone' },
];
exports.STAGE17_QBLOCK_SPOTS = [
    { x: 360, y: 560 },
    { x: 600, y: 470 },
    { x: 850, y: 380 },
    { x: 1130, y: 470 },
    { x: 1380, y: 370 },
    { x: 1660, y: 280 },
    { x: 1920, y: 380 },
    { x: 2200, y: 480 },
    { x: 2450, y: 380 },
    { x: 2730, y: 280 },
    { x: 2990, y: 380 },
    { x: 3270, y: 480 },
    { x: 3520, y: 380 },
    { x: 3800, y: 280 },
    { x: 4060, y: 380 },
    { x: 4340, y: 480 },
    { x: 4590, y: 380 },
    { x: 4870, y: 280 },
    { x: 5100, y: 600 },
    { x: 5260, y: 450 },
];
// --- STAGE 18: Dimensi Void Berputar (85% Crumble & Jurang Kehampaan / Void Pits) ---
exports.STAGE18_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    { x: 40, y: 710, w: 200, h: 28, type: 'stone' },
    { x: 280, y: 630, w: 150, h: 24, type: 'crumble' },
    { x: 480, y: 540, w: 150, h: 24, type: 'crumble' },
    // Fan booster di atas void
    { x: 680, y: 796, w: 76, h: 24, type: 'fan', moveRange: 520 },
    { x: 700, y: 420, w: 150, h: 24, type: 'crumble' },
    { x: 920, y: 490, w: 150, h: 24, type: 'crumble' },
    { x: 1140, y: 560, w: 150, h: 24, type: 'crumble' },
    { x: 1360, y: 470, w: 150, h: 24, type: 'crumble' },
    { x: 1580, y: 380, w: 150, h: 24, type: 'crumble' },
    // Fan booster kedua
    { x: 1780, y: 796, w: 76, h: 24, type: 'fan', moveRange: 520 },
    { x: 1800, y: 460, w: 150, h: 24, type: 'crumble' },
    { x: 2020, y: 530, w: 150, h: 24, type: 'crumble' },
    { x: 2240, y: 440, w: 150, h: 24, type: 'crumble' },
    { x: 2460, y: 350, w: 150, h: 24, type: 'crumble' },
    // Fan booster ketiga
    { x: 2680, y: 796, w: 76, h: 24, type: 'fan', moveRange: 520 },
    { x: 2700, y: 430, w: 150, h: 24, type: 'crumble' },
    { x: 2920, y: 500, w: 150, h: 24, type: 'crumble' },
    { x: 3140, y: 410, w: 150, h: 24, type: 'crumble' },
    { x: 3360, y: 320, w: 150, h: 24, type: 'crumble' },
    // Fan booster keempat
    { x: 3580, y: 796, w: 76, h: 24, type: 'fan', moveRange: 520 },
    { x: 3600, y: 420, w: 150, h: 24, type: 'crumble' },
    { x: 3820, y: 490, w: 150, h: 24, type: 'crumble' },
    { x: 4040, y: 400, w: 150, h: 24, type: 'crumble' },
    { x: 4260, y: 310, w: 150, h: 24, type: 'crumble' },
    // Fan booster kelima
    { x: 4480, y: 796, w: 76, h: 24, type: 'fan', moveRange: 520 },
    { x: 4500, y: 420, w: 150, h: 24, type: 'crumble' },
    { x: 4720, y: 510, w: 150, h: 24, type: 'crumble' },
    { x: 4940, y: 600, w: 180, h: 26, type: 'stone' },
    { x: 5120, y: 680, w: 400, h: 32, type: 'stone' },
];
exports.STAGE18_QBLOCK_SPOTS = [
    { x: 340, y: 550 },
    { x: 540, y: 460 },
    { x: 760, y: 340 },
    { x: 980, y: 410 },
    { x: 1200, y: 480 },
    { x: 1420, y: 390 },
    { x: 1640, y: 300 },
    { x: 1860, y: 380 },
    { x: 2080, y: 450 },
    { x: 2300, y: 360 },
    { x: 2520, y: 270 },
    { x: 2760, y: 350 },
    { x: 2980, y: 420 },
    { x: 3200, y: 330 },
    { x: 3420, y: 240 },
    { x: 3660, y: 340 },
    { x: 3880, y: 410 },
    { x: 4100, y: 320 },
    { x: 4320, y: 230 },
    { x: 4560, y: 340 },
    { x: 4780, y: 430 },
    { x: 5000, y: 520 },
    { x: 5240, y: 600 },
];
// --- STAGE 19: Neraka Virus Cyber Matrix (Drone Swarms, Api Cepat & Sabuk Terbalik) ---
exports.STAGE19_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    { x: 40, y: 710, w: 220, h: 28, type: 'fire' },
    { x: 300, y: 630, w: 160, h: 24, type: 'crumble' },
    { x: 520, y: 550, w: 180, h: 26, type: 'fire' },
    { x: 760, y: 640, w: 160, h: 24, type: 'moving', baseX: 760, baseY: 640, moveAxis: 'x', moveRange: 150, moveSpeed: 0.003, movePhase: 0 },
    { x: 980, y: 510, w: 280, h: 22, type: 'fire' },
    { x: 960, y: 370, w: 320, h: 22, type: 'stone' },
    { x: 1060, y: 240, w: 160, h: 22, type: 'stone' },
    { x: 1360, y: 440, w: 150, h: 24, type: 'moving', baseX: 1360, baseY: 440, moveAxis: 'y', moveRange: 150, moveSpeed: 0.0032, movePhase: 1.57 },
    { x: 1580, y: 620, w: 140, h: 24, type: 'crumble' },
    { x: 1780, y: 540, w: 150, h: 24, type: 'fire' },
    { x: 1980, y: 460, w: 140, h: 24, type: 'crumble' },
    { x: 2250, y: 650, w: 260, h: 28, type: 'conveyor', conveyorDir: -1, conveyorSpeed: 4.0 },
    { x: 2560, y: 500, w: 150, h: 24, type: 'moving', baseX: 2560, baseY: 500, moveAxis: 'x', moveRange: 150, moveSpeed: 0.0031, movePhase: 0 },
    { x: 2800, y: 400, w: 200, h: 24, type: 'fire' },
    { x: 3080, y: 310, w: 170, h: 24, type: 'stone' },
    { x: 3340, y: 650, w: 260, h: 28, type: 'conveyor', conveyorDir: 1, conveyorSpeed: 4.0 },
    { x: 3640, y: 540, w: 150, h: 24, type: 'moving', baseX: 3640, baseY: 540, moveAxis: 'y', moveRange: 150, moveSpeed: 0.0033, movePhase: 1.0 },
    { x: 3880, y: 440, w: 200, h: 24, type: 'fire' },
    { x: 4130, y: 340, w: 180, h: 24, type: 'stone' },
    { x: 4380, y: 630, w: 260, h: 28, type: 'conveyor', conveyorDir: -1, conveyorSpeed: 4.0 },
    { x: 4680, y: 520, w: 150, h: 24, type: 'moving', baseX: 4680, baseY: 520, moveAxis: 'x', moveRange: 150, moveSpeed: 0.0032, movePhase: 0 },
    { x: 4920, y: 410, w: 200, h: 24, type: 'fire' },
    { x: 5120, y: 680, w: 400, h: 32, type: 'fire' },
    { x: 5180, y: 520, w: 280, h: 26, type: 'stone' },
];
exports.STAGE19_QBLOCK_SPOTS = [
    { x: 360, y: 550 },
    { x: 580, y: 470 },
    { x: 820, y: 560 },
    { x: 1040, y: 430 },
    { x: 1120, y: 160 },
    { x: 1420, y: 360 },
    { x: 1640, y: 540 },
    { x: 1840, y: 460 },
    { x: 2040, y: 380 },
    { x: 2320, y: 570 },
    { x: 2620, y: 420 },
    { x: 2860, y: 320 },
    { x: 3140, y: 230 },
    { x: 3400, y: 570 },
    { x: 3700, y: 460 },
    { x: 3940, y: 360 },
    { x: 4190, y: 260 },
    { x: 4440, y: 550 },
    { x: 4740, y: 440 },
    { x: 4980, y: 330 },
    { x: 5240, y: 440 },
];
// --- STAGE 20: Puncak Tahta Primordial Void (Gak Masuk Akal: Gabungan Pesawat, Kipas, Petir, Mecha & Final Boss Void!) ---
exports.STAGE20_PLATFORMS = [
    { x: 0, y: 820, w: 5600, h: 280, type: 'ground' },
    { x: 40, y: 710, w: 220, h: 28, type: 'stone' },
    { x: 300, y: 640, w: 160, h: 24, type: 'crumble' },
    // PESAWAT VOID 1 (Membawa player melewati badai kehampaan)
    { x: 540, y: 540, w: 240, h: 32, type: 'plane', baseX: 540, baseY: 540, moveAxis: 'x', moveRange: 320, moveSpeed: 0.003, movePhase: 0 },
    // Awan petir di atas pesawat
    { x: 1040, y: 440, w: 150, h: 36, type: 'thunder' },
    // Kipas angin badai
    { x: 1100, y: 796, w: 80, h: 24, type: 'fan', moveRange: 520 },
    { x: 1260, y: 380, w: 160, h: 24, type: 'crumble' },
    // PESAWAT VOID 2
    { x: 1520, y: 480, w: 240, h: 32, type: 'plane', baseX: 1520, baseY: 480, moveAxis: 'x', moveRange: 340, moveSpeed: 0.0032, movePhase: 1.57 },
    // Awan petir kedua
    { x: 2060, y: 400, w: 160, h: 36, type: 'thunder' },
    // Kipas angin badai kedua
    { x: 2120, y: 796, w: 80, h: 24, type: 'fan', moveRange: 520 },
    { x: 2280, y: 340, w: 170, h: 24, type: 'crumble' },
    // Conveyor maut super cepat
    { x: 2540, y: 440, w: 240, h: 26, type: 'conveyor', conveyorDir: -1, conveyorSpeed: 4.2 },
    // PESAWAT VOID 3
    { x: 2880, y: 480, w: 250, h: 32, type: 'plane', baseX: 2880, baseY: 480, moveAxis: 'x', moveRange: 360, moveSpeed: 0.0034, movePhase: 0.8 },
    // Awan petir ketiga
    { x: 3440, y: 390, w: 160, h: 36, type: 'thunder' },
    // Kipas badai ketiga
    { x: 3500, y: 796, w: 80, h: 24, type: 'fan', moveRange: 540 },
    { x: 3660, y: 320, w: 180, h: 24, type: 'crumble' },
    // PESAWAT VOID 4 (Pesawat menuju tahta)
    { x: 3940, y: 420, w: 260, h: 32, type: 'plane', baseX: 3940, baseY: 420, moveAxis: 'x', moveRange: 380, moveSpeed: 0.0035, movePhase: 2.1 },
    // Gerbang arena boss Primordial Void God
    { x: 4520, y: 480, w: 240, h: 26, type: 'crumble' },
    { x: 4820, y: 580, w: 240, h: 26, type: 'conveyor', conveyorDir: 1, conveyorSpeed: 3.5 },
    { x: 5080, y: 680, w: 460, h: 36, type: 'stone' },
    { x: 5160, y: 500, w: 300, h: 28, type: 'roof' },
];
exports.STAGE20_QBLOCK_SPOTS = [
    { x: 360, y: 560 },
    { x: 680, y: 440 },
    { x: 900, y: 440 },
    { x: 1320, y: 300 },
    { x: 1660, y: 380 },
    { x: 1900, y: 380 },
    { x: 2340, y: 260 },
    { x: 2640, y: 360 },
    { x: 3020, y: 380 },
    { x: 3260, y: 380 },
    { x: 3720, y: 240 },
    { x: 4080, y: 320 },
    { x: 4320, y: 320 },
    { x: 4600, y: 400 },
    { x: 4900, y: 500 },
    { x: 5180, y: 420 },
    { x: 5280, y: 600 },
    { x: 1160, y: 620 },
    { x: 2180, y: 620 },
    { x: 3560, y: 620 },
];
// =========================================================================
// MAPPING STAGE 1 - 20 (Platforms & Question Spots)
// =========================================================================
exports.STAGE_PLATFORM_MAP = {
    1: exports.STAGE1_PLATFORMS,
    2: exports.STAGE2_PLATFORMS,
    3: exports.STAGE3_PLATFORMS,
    4: exports.STAGE4_PLATFORMS,
    5: exports.STAGE5_PLATFORMS,
    6: exports.STAGE6_PLATFORMS,
    7: exports.STAGE7_PLATFORMS,
    8: exports.STAGE8_PLATFORMS,
    9: exports.STAGE9_PLATFORMS,
    10: exports.STAGE10_PLATFORMS,
    11: exports.STAGE11_PLATFORMS,
    12: exports.STAGE12_PLATFORMS,
    13: exports.STAGE13_PLATFORMS,
    14: exports.STAGE14_PLATFORMS,
    15: exports.STAGE15_PLATFORMS,
    16: exports.STAGE16_PLATFORMS,
    17: exports.STAGE17_PLATFORMS,
    18: exports.STAGE18_PLATFORMS,
    19: exports.STAGE19_PLATFORMS,
    20: exports.STAGE20_PLATFORMS,
};
exports.STAGE_QBLOCK_MAP = {
    1: exports.QBLOCK_CANDIDATE_SPOTS,
    2: exports.STAGE2_QBLOCK_SPOTS,
    3: exports.STAGE3_QBLOCK_SPOTS,
    4: exports.STAGE4_QBLOCK_SPOTS,
    5: exports.STAGE5_QBLOCK_SPOTS,
    6: exports.STAGE6_QBLOCK_SPOTS,
    7: exports.STAGE7_QBLOCK_SPOTS,
    8: exports.STAGE8_QBLOCK_SPOTS,
    9: exports.STAGE9_QBLOCK_SPOTS,
    10: exports.STAGE10_QBLOCK_SPOTS,
    11: exports.STAGE11_QBLOCK_SPOTS,
    12: exports.STAGE12_QBLOCK_SPOTS,
    13: exports.STAGE13_QBLOCK_SPOTS,
    14: exports.STAGE14_QBLOCK_SPOTS,
    15: exports.STAGE15_QBLOCK_SPOTS,
    16: exports.STAGE16_QBLOCK_SPOTS,
    17: exports.STAGE17_QBLOCK_SPOTS,
    18: exports.STAGE18_QBLOCK_SPOTS,
    19: exports.STAGE19_QBLOCK_SPOTS,
    20: exports.STAGE20_QBLOCK_SPOTS,
};
exports.MAX_STAGE = 20;
exports.STAGE_TIERS = [
    { id: 1, name: 'Tier 1: Rintangan Mudah (Stage 1-5)', color: 'border-emerald-300 bg-emerald-50/60 text-emerald-900', badge: 'bg-emerald-600 text-white' },
    { id: 2, name: 'Tier 2: Rintangan Sedang (Stage 6-10)', color: 'border-amber-300 bg-amber-50/60 text-amber-900', badge: 'bg-amber-600 text-white' },
    { id: 3, name: 'Tier 3: Rintangan Sulit (Stage 11-15)', color: 'border-rose-300 bg-rose-50/60 text-rose-900', badge: 'bg-rose-600 text-white' },
    { id: 4, name: 'Tier 4: Rintangan Gak Masuk Akal (Stage 16-20)', color: 'border-purple-300 bg-purple-50/60 text-purple-900', badge: 'bg-purple-600 text-white' },
];
exports.STAGE_DEFINITIONS = [
    // TIER 1: MUDAH (1 - 5)
    { id: 1, tier: 1, icon: '🏞️', shortName: 'Stage 1', name: 'Lembah Kampus', theme: 'Dasar & Jalur Hijau', feature: 'Santai' },
    { id: 2, tier: 1, icon: '🌅', shortName: 'Stage 2', name: 'Menara Sunset', theme: 'Sunset & Tangga Batu', feature: 'Patroli Virus' },
    { id: 3, tier: 1, icon: '💨', shortName: 'Stage 3', name: 'Lembah Kipas Angin', theme: 'Hembusan Angin ke Langit', feature: '💨 Kipas Angin' },
    { id: 4, tier: 1, icon: '🎈', shortName: 'Stage 4', name: 'Bukit Balon Udara', theme: 'Awan & Super Trampolin', feature: 'Trampolin' },
    { id: 5, tier: 1, icon: '⚡', shortName: 'Stage 5', name: 'Galaksi Cyber Pemula', theme: 'Grid Cyber & Senjata Laser', feature: 'Laser Blaster' },
    // TIER 2: SEDANG (6 - 10)
    { id: 6, tier: 2, icon: '🔥', shortName: 'Stage 6', name: 'Kastil Magma', theme: 'Lahar Panas & Lift Vulkanik', feature: 'Lift Vulkanik' },
    { id: 7, tier: 2, icon: '🌿', shortName: 'Stage 7', name: 'Hutan Neon Biolumin', theme: 'Rimba Neon & Spora Biolumin', feature: 'Pijakan Rapuh' },
    { id: 8, tier: 2, icon: '⚙️', shortName: 'Stage 8', name: 'Kota Roda Gigi', theme: 'Conveyor Sabuk & Mesin Gir', feature: 'Conveyor Belt' },
    { id: 9, tier: 2, icon: '❄️', shortName: 'Stage 9', name: 'Samudra Es', theme: 'Es Licin & Runtuhan Gletser', feature: 'Pijakan Licin' },
    { id: 10, tier: 2, icon: '✈️', shortName: 'Stage 10', name: 'Penerbangan Awan', theme: 'Naik Pesawat Melintasi Awan!', feature: '✈️ Naik Pesawat' },
    // TIER 3: SULIT (11 - 15)
    { id: 11, tier: 3, icon: '⛈️', shortName: 'Stage 11', name: 'Badai Petir Angkasa', theme: 'Awan Petir Mematikan & Kipas', feature: '⚡ Badai Petir' },
    { id: 12, tier: 3, icon: '🏜️', shortName: 'Stage 12', name: 'Gurun Reruntuhan', theme: 'Pasir Hisap & Jurang Terjal', feature: 'Pasir Hisap' },
    { id: 13, tier: 3, icon: '🛸', shortName: 'Stage 13', name: 'Lab Drone Pengintai', theme: 'Patroli Drone Udara & Laser', feature: '🛸 Drone Udara' },
    { id: 14, tier: 3, icon: '🧪', shortName: 'Stage 14', name: 'Mutasi Biohazard', theme: 'Lumpur Beracun & Mutan Virus', feature: 'Biohazard' },
    { id: 15, tier: 3, icon: '🌋', shortName: 'Stage 15', name: 'Benteng Magma Neraka', theme: 'Lautan Lahar Luas & Lift Sempit', feature: 'Lahar Neraka' },
    // TIER 4: GAK MASUK AKAL / EKSTREM (16 - 20)
    { id: 16, tier: 4, icon: '🛩️', shortName: 'Stage 16', name: 'Formasi Tempur Pesawat', theme: 'Parkour Pesawat Cepat & Petir', feature: '🛩️ Parkour Pesawat' },
    { id: 17, tier: 4, icon: '🤖', shortName: 'Stage 17', name: 'Koridor Robot Mecha', theme: 'Patroli Mecha & Conveyor Maut', feature: '🤖 Robot Mecha' },
    { id: 18, tier: 4, icon: '🌪️', shortName: 'Stage 18', name: 'Dimensi Void Berputar', theme: '85% Pijakan Runtuh & Jurang Void', feature: 'Full Crumble' },
    { id: 19, tier: 4, icon: '🦠', shortName: 'Stage 19', name: 'Neraka Virus Matrix', theme: 'Drone Swarm & Semburan Api Cepat', feature: 'Virus Swarm' },
    { id: 20, tier: 4, icon: '👑', shortName: 'Stage 20', name: 'Tahta Void Overlord', theme: 'Pesawat, Kipas, Petir & Void God!', feature: '👑 OVERLORD FINAL' },
];
// =========================================================================
// BOSS DEFINITIONS FOR ALL 20 STAGES
// =========================================================================
const BOSS_KINDS = {
    1: { kind: 'guardian', name: 'Penjaga Pintu' },
    2: { kind: 'guardian', name: 'Raja Sunset' },
    3: { kind: 'guardian', name: 'Raja Angin Zephyr' },
    4: { kind: 'guardian', name: 'Penjaga Balon Udara' },
    5: { kind: 'guardian', name: 'Mekanik Cyber Pemula' },
    6: { kind: 'guardian', name: 'Ratu Magma Vulkanik' },
    7: { kind: 'golem', name: 'Golem Neon Biolumin' },
    8: { kind: 'tank', name: 'Tank Roda Gigi Baja' },
    9: { kind: 'crab', name: 'Kepiting Es Raksasa' },
    10: { kind: 'planeboss', name: 'Kapten Tempur SkyAce' },
    11: { kind: 'thunderbird', name: 'Burung Petir Thunderbird' },
    12: { kind: 'scorpion', name: 'Kalajengking Gurun Pasir' },
    13: { kind: 'droneboss', name: 'Drone Induk Pengintai Alpha' },
    14: { kind: 'queen', name: 'Ratu Virus Mutan Biohazard' },
    15: { kind: 'vulcan', name: 'Dewa Api Neraka Vulcan' },
    16: { kind: 'zeppelin', name: 'Zeppelin Tempur Titania' },
    17: { kind: 'robotboss', name: 'Mecha Kolosus Titania MK-IV' },
    18: { kind: 'voidphantom', name: 'Hantu Dimensi Void Abadi' },
    19: { kind: 'queenomega', name: 'Ratu Virus Cyber Omega' },
    20: { kind: 'overlord', name: 'PRIMORDIAL VOID OVERLORD' },
};
function createStageBosses(stage) {
    const meta = BOSS_KINDS[stage] ?? { kind: 'guardian', name: 'Penjaga Pintu' };
    // Minimal HP 50 agar bisa ditembakin bareng temen-temen
    const hp = stage >= 16 ? 130 : stage >= 11 ? 95 : stage >= 6 ? 70 : 50;
    return [
        {
            id: `boss_s${stage}`,
            stage,
            kind: meta.kind,
            name: meta.name,
            // Boss menjaga tepat di depan area pintu checkpoint pojok kanan (x: 5380)
            x: 5080,
            y: 700,
            w: 130,
            h: 118,
            minX: 4920,
            maxX: 5320,
            maxHp: hp,
            hp,
            alive: true,
            dir: -1,
        },
    ];
}
// =========================================================================
// POWER-UPS FOR ALL 20 STAGES
// =========================================================================
function createStagePowerUps(stage) {
    const kinds = stage >= 16
        ? ['blaster', 'star', 'speed', 'star', 'blaster']
        : stage >= 11
            ? ['blaster', 'speed', 'star', 'blaster', 'speed']
            : ['blaster', 'star', 'blaster', 'star', 'blaster'];
    const posList = [
        [360, 580],
        [1810, 270],
        [2840, 280],
        [3720, 320],
        [4620, 160],
        [4760, 760],
    ];
    return posList.map((pos, i) => ({
        id: `pu_s${stage}_${i + 1}`,
        stage,
        kind: kinds[i % kinds.length],
        x: pos[0],
        y: pos[1],
        w: 36,
        h: 36,
    }));
}
// =========================================================================
// ENEMIES FOR ALL 20 STAGES
// =========================================================================
function createStageEnemies(stage) {
    if (stage <= 1)
        return [];
    // Stage 16-20: Ekstrem (Drone, Robot Mecha, Fireball cepat, Virus swarm)
    if (stage >= 16) {
        return [
            { id: `e${stage}_1`, kind: 'robot', x: 480, y: 776, w: 42, h: 44, minX: 300, maxX: 700, speed: 2.8, dir: 1 },
            { id: `e${stage}_2`, kind: 'drone', x: 1200, y: 460, w: 40, h: 36, minX: 1050, maxX: 1450, speed: 3.2, dir: -1 },
            { id: `e${stage}_3`, kind: 'robot', x: 2300, y: 776, w: 42, h: 44, minX: 2150, maxX: 2550, speed: 3.0, dir: 1 },
            { id: `e${stage}_4`, kind: 'drone', x: 3100, y: 440, w: 40, h: 36, minX: 2950, maxX: 3350, speed: 3.3, dir: -1 },
            { id: `e${stage}_5`, kind: 'robot', x: 4100, y: 776, w: 42, h: 44, minX: 3950, maxX: 4350, speed: 3.2, dir: 1 },
            { id: `e${stage}_6`, kind: 'fireball', x: 1700, y: 786, w: 34, h: 34, minX: 1550, maxX: 1950, speed: 3.8, dir: 1 },
            { id: `e${stage}_7`, kind: 'fireball', x: 2700, y: 786, w: 34, h: 34, minX: 2550, maxX: 2950, speed: 3.8, dir: -1 },
            { id: `e${stage}_8`, kind: 'drone', x: 3800, y: 420, w: 40, h: 36, minX: 3650, maxX: 4050, speed: 3.4, dir: 1 },
            { id: `e${stage}_9`, kind: 'virus', x: 4700, y: 780, w: 38, h: 40, minX: 4550, maxX: 4850, speed: 3.0, dir: -1 },
        ];
    }
    // Stage 11-15: Sulit (Drone, Fireball, Virus patroli)
    if (stage >= 11) {
        return [
            { id: `e${stage}_1`, kind: 'drone', x: 520, y: 520, w: 40, h: 36, minX: 350, maxX: 750, speed: 2.6, dir: 1 },
            { id: `e${stage}_2`, kind: 'virus', x: 1140, y: 490, w: 38, h: 40, minX: 1010, maxX: 1340, speed: 2.4, dir: -1 },
            { id: `e${stage}_3`, kind: 'drone', x: 2360, y: 500, w: 40, h: 36, minX: 2200, maxX: 2550, speed: 2.8, dir: 1 },
            { id: `e${stage}_4`, kind: 'virus', x: 3740, y: 500, w: 38, h: 40, minX: 3600, maxX: 3950, speed: 2.5, dir: -1 },
            { id: `e${stage}_5`, kind: 'fireball', x: 1650, y: 786, w: 34, h: 34, minX: 1500, maxX: 1850, speed: 3.2, dir: 1 },
            { id: `e${stage}_6`, kind: 'fireball', x: 2850, y: 786, w: 34, h: 34, minX: 2700, maxX: 3050, speed: 3.2, dir: -1 },
            { id: `e${stage}_7`, kind: 'fireball', x: 4200, y: 786, w: 34, h: 34, minX: 4050, maxX: 4400, speed: 3.3, dir: 1 },
        ];
    }
    // Stage 6-10: Sedang
    if (stage >= 6) {
        return [
            { id: `e${stage}_1`, kind: 'virus', x: 460, y: 780, w: 38, h: 40, minX: 320, maxX: 680, speed: 2.2, dir: 1 },
            { id: `e${stage}_2`, kind: 'virus', x: 1140, y: 490, w: 38, h: 40, minX: 1030, maxX: 1330, speed: 2.1, dir: -1 },
            { id: `e${stage}_3`, kind: 'fireball', x: 1820, y: 786, w: 34, h: 34, minX: 1660, maxX: 2090, speed: 2.8, dir: 1 },
            { id: `e${stage}_4`, kind: 'virus', x: 2340, y: 640, w: 38, h: 40, minX: 2250, maxX: 2510, speed: 2.2, dir: -1 },
            { id: `e${stage}_5`, kind: 'fireball', x: 2980, y: 786, w: 34, h: 34, minX: 2800, maxX: 3150, speed: 2.9, dir: 1 },
            { id: `e${stage}_6`, kind: 'virus', x: 3740, y: 500, w: 38, h: 40, minX: 3680, maxX: 4020, speed: 2.2, dir: -1 },
            { id: `e${stage}_7`, kind: 'fireball', x: 4600, y: 786, w: 34, h: 34, minX: 4450, maxX: 4800, speed: 3.0, dir: -1 },
        ];
    }
    // Stage 2-5: Mudah
    return [
        { id: `e${stage}_1`, kind: 'virus', x: 420, y: 780, w: 38, h: 40, minX: 290, maxX: 670, speed: 1.8, dir: 1 },
        { id: `e${stage}_2`, kind: 'virus', x: 1120, y: 480, w: 38, h: 40, minX: 975, maxX: 1270, speed: 1.7, dir: -1 },
        { id: `e${stage}_3`, kind: 'fireball', x: 1820, y: 786, w: 34, h: 34, minX: 1660, maxX: 2090, speed: 2.4, dir: 1 },
        { id: `e${stage}_4`, kind: 'virus', x: 2340, y: 640, w: 38, h: 40, minX: 2255, maxX: 2510, speed: 1.8, dir: 1 },
        { id: `e${stage}_5`, kind: 'fireball', x: 2880, y: 786, w: 34, h: 34, minX: 2750, maxX: 3030, speed: 2.5, dir: -1 },
        { id: `e${stage}_6`, kind: 'virus', x: 3280, y: 650, w: 38, h: 40, minX: 3195, maxX: 3410, speed: 1.9, dir: -1 },
        { id: `e${stage}_7`, kind: 'fireball', x: 4920, y: 786, w: 34, h: 34, minX: 4810, maxX: 5090, speed: 2.6, dir: -1 },
    ];
}
// =========================================================================
// UTILITIES
// =========================================================================
function getStageBasePlatforms(stage) {
    const src = exports.STAGE_PLATFORM_MAP[stage] ?? exports.STAGE1_PLATFORMS;
    return src.map((p) => ({ ...p }));
}
function generateQuestionBlocks(questionIds, seedStr, stage = 1) {
    if (questionIds.length === 0)
        return [];
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
    const baseSpots = exports.STAGE_QBLOCK_MAP[stage] ?? exports.QBLOCK_CANDIDATE_SPOTS;
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
        // Kotak soal dijaga pada rentang nyaman jangkauan lompat
        const spotY = spot.y < 300 ? 340 + (spot.y % 120) : spot.y;
        const finalY = Math.max(280, Math.min(exports.WORLD.groundY - 140, spotY + jitterY));
        return {
            x: Math.max(260, Math.min(5080, spot.x + jitterX + tierOffset)),
            y: finalY,
            w: 48,
            h: 48,
            type: 'qblock',
            questionId: qid,
        };
    });
}
function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
