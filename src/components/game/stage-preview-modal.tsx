'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  WORLD,
  STAGE_TIERS,
  STAGE_DEFINITIONS,
  getStageBasePlatforms,
  createStageEnemies,
  createStageBosses,
  createStagePowerUps,
  STAGE_QBLOCK_MAP,
  type Platform,
  type StageEnemy,
  type StageBoss,
  type StagePowerUp,
} from '@/game-engine/maps/world';
import {
  updateStageEntities,
  updatePlayerPhysics,
  type Player,
  type PhysicsSoundEvent,
} from '@/game-engine/physics/physics';
import {
  drawWorld,
  drawPlatforms,
  drawEnemies,
  drawBosses,
  drawPowerUps,
  drawCat,
} from '@/game-engine/entities/render';

type StagePreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialStageId?: number;
  selectedStages: number[];
  onToggleStage: (stageId: number) => void;
};

type ViewMode = 'detail' | 'overview' | 'playtest';

export default function StagePreviewModal({
  isOpen,
  onClose,
  initialStageId = 1,
  selectedStages,
  onToggleStage,
}: StagePreviewModalProps) {
  const [currentStage, setCurrentStage] = useState(initialStageId);
  const [viewMode, setViewMode] = useState<ViewMode>('detail');
  const [cameraX, setCameraX] = useState(0);
  const [godMode, setGodMode] = useState(true);

  // Sync initialStageId when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStage(initialStageId);
      setCameraX(0);
    }
  }, [isOpen, initialStageId]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Stage definition metadata
  const stageMeta = useMemo(() => {
    return (
      STAGE_DEFINITIONS.find((s) => s.id === currentStage) ??
      STAGE_DEFINITIONS[0]
    );
  }, [currentStage]);

  const stageTier = useMemo(() => {
    return STAGE_TIERS.find((t) => t.id === stageMeta.tier) ?? STAGE_TIERS[0];
  }, [stageMeta.tier]);

  // Stage entities state (fresh per stage switch)
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [enemies, setEnemies] = useState<StageEnemy[]>([]);
  const [bosses, setBosses] = useState<StageBoss[]>([]);
  const [powerUps, setPowerUps] = useState<StagePowerUp[]>([]);

  // Reset & load stage entities whenever currentStage changes
  useEffect(() => {
    const basePlats = getStageBasePlatforms(currentStage);
    const qSpots = STAGE_QBLOCK_MAP[currentStage] ?? [];
    const qblockPlats: Platform[] = qSpots.map((spot, idx) => ({
      x: spot.x,
      y: spot.y,
      w: 48,
      h: 48,
      type: 'qblock' as const,
      questionId: `preview_q_${idx + 1}`,
    }));
    setPlatforms([...basePlats, ...qblockPlats]);
    setEnemies(createStageEnemies(currentStage));
    setBosses(createStageBosses(currentStage));
    setPowerUps(createStagePowerUps(currentStage));
    setCameraX(0);
  }, [currentStage]);

  // Playtest avatar state
  const playerRef = useRef<Player>({
    id: 'test_player',
    username: 'PreviewGuru',
    fullName: 'Tester Guru',
    avatar: 'cat-blue',
    role: 'teacher',
    stage: currentStage,
    x: 80,
    y: 700,
    vx: 0,
    vy: 0,
    onGround: true,
    facing: 1,
    isGodMode: true,
    gun: 'blaster',
    hasAdminGun: true,
    blasterAmmo: Infinity,
  });

  const keysRef = useRef({
    left: false,
    right: false,
    jump: false,
  });

  const resetPlayerPosition = useCallback(() => {
    playerRef.current.x = 80;
    playerRef.current.y = 700;
    playerRef.current.vx = 0;
    playerRef.current.vy = 0;
    playerRef.current.isDying = false;
    playerRef.current.isGodMode = godMode;
    setCameraX(0);
  }, [godMode]);

  // Handle keyboard inputs for Playtest mode
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysRef.current.left = true;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysRef.current.right = true;
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
        keysRef.current.jump = true;
        if (e.key === ' ') e.preventDefault();
      } else if (e.key === 'Escape') {
        onClose();
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysRef.current.left = false;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysRef.current.right = false;
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
        keysRef.current.jump = false;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, onClose]);

  // Main animation / render loop
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();

    function loop(nowMs: number) {
      const dtMs = Math.min(32, nowMs - lastTime);
      lastTime = nowMs;
      const dtScale = dtMs / 16.667;
      const now = Date.now();

      // 1. Update entities (moving lifts, cruising planes, crumbling blocks, enemy pacing)
      updateStageEntities(
        platforms,
        enemies,
        dtScale,
        now,
        powerUps,
        [],
        undefined,
        bosses,
      );

      // 2. Playtest mode: update test player physics
      if (viewMode === 'playtest') {
        const p = playerRef.current;
        p.isGodMode = godMode;
        p.stage = currentStage;
        updatePlayerPhysics(
          p,
          keysRef.current,
          [],
          platforms,
          undefined,
          dtScale,
          undefined,
          {
            basePlatforms: platforms,
            enemies,
            bosses,
            powerUps,
            isGateUnlocked: true,
          },
        );

        // Center camera on player
        const targetCamX = p.x - canvas!.width / 2 + 20;
        const clampedCamX = Math.max(0, Math.min(WORLD.width - canvas!.width, targetCamX));
        setCameraX(clampedCamX);
      }

      // 3. Clear canvas
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      ctx!.save();
      if (viewMode === 'overview') {
        // OVERVIEW MODE: Fit full 5600px into canvas width
        const scaleX = canvas!.width / WORLD.width;
        const scaleY = canvas!.height / WORLD.height;
        ctx!.scale(scaleX, scaleY);

        drawWorld(ctx!, {
          stage: currentStage,
          totalStages: 20,
          stageAnswered: 0,
          stageTotal: 10,
          isGateUnlocked: true,
          bossAlive: bosses.some((b) => b.alive),
        });
        drawPlatforms(ctx!, platforms, currentStage, bosses.some((b) => b.alive));
        drawEnemies(ctx!, enemies, now);
        drawBosses(ctx!, bosses, now);
        drawPowerUps(ctx!, powerUps, now);

        // Highlight camera viewport overlay on minimap
        const vpW = 960;
        ctx!.strokeStyle = '#f59e0b';
        ctx!.lineWidth = 8;
        ctx!.strokeRect(cameraX, 0, vpW, WORLD.height);
        ctx!.fillStyle = 'rgba(245, 158, 11, 0.15)';
        ctx!.fillRect(cameraX, 0, vpW, WORLD.height);
      } else {
        // DETAIL / PLAYTEST MODE: 1:1 Scale with camera translation
        ctx!.translate(-cameraX, -(WORLD.height - canvas!.height));

        drawWorld(ctx!, {
          stage: currentStage,
          totalStages: 20,
          stageAnswered: 0,
          stageTotal: 10,
          isGateUnlocked: true,
          bossAlive: bosses.some((b) => b.alive),
        });
        drawPlatforms(ctx!, platforms, currentStage, bosses.some((b) => b.alive));
        drawEnemies(ctx!, enemies, now);
        drawBosses(ctx!, bosses, now);
        drawPowerUps(ctx!, powerUps, now);

        if (viewMode === 'playtest') {
          const p = playerRef.current;
          drawCat(
            ctx!,
            p.x,
            p.y,
            38,
            42,
            p.avatar,
            p.facing,
            p.username,
            p.role ?? 'teacher',
            null,
            { isDying: p.isDying, burnUntil: p.burnUntil },
          );
        }
      }
      ctx!.restore();

      animId = requestAnimationFrame(loop);
    }

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, viewMode, cameraX, currentStage, platforms, enemies, bosses, powerUps, godMode]);

  // Mouse / Touch Drag to pan camera in detail view
  const isDraggingRef = useRef(false);
  const startDragXRef = useRef(0);
  const startCamXRef = useRef(0);

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (viewMode === 'overview') {
      // Click on overview to jump camera
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = clickX / rect.width;
      const targetX = pct * WORLD.width - 480;
      setCameraX(Math.max(0, Math.min(WORLD.width - 960, targetX)));
      return;
    }
    if (viewMode === 'detail') {
      isDraggingRef.current = true;
      startDragXRef.current = e.clientX;
      startCamXRef.current = cameraX;
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (isDraggingRef.current && viewMode === 'detail') {
      const deltaX = e.clientX - startDragXRef.current;
      const newCamX = startCamXRef.current - deltaX;
      setCameraX(Math.max(0, Math.min(WORLD.width - 960, newCamX)));
    }
  }

  function handleMouseUp() {
    isDraggingRef.current = false;
  }

  // Stage navigation
  function prevStage() {
    setCurrentStage((prev) => (prev > 1 ? prev - 1 : 20));
  }
  function nextStage() {
    setCurrentStage((prev) => (prev < 20 ? prev + 1 : 1));
  }

  // Check if stage is selected in room settings
  const isSelected = selectedStages.includes(currentStage);
  const selectedOrder = selectedStages.indexOf(currentStage);

  // Statistics calculation for current stage
  const stats = useMemo(() => {
    const fans = platforms.filter((p) => p.type === 'fan').length;
    const planes = platforms.filter((p) => p.type === 'plane').length;
    const thunders = platforms.filter((p) => p.type === 'thunder').length;
    const qblocks = platforms.filter((p) => p.type === 'qblock').length;
    const boss = bosses[0];
    return {
      totalPlatforms: platforms.length,
      fans,
      planes,
      thunders,
      qblocks,
      enemiesCount: enemies.length,
      bossName: boss?.name ?? 'Tidak Ada',
      bossHp: boss?.maxHp ?? 0,
      powerUpsCount: powerUps.length,
    };
  }, [platforms, enemies, bosses, powerUps]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-6xl max-h-[96vh] rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl text-white overflow-hidden">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{stageMeta.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  <span>{stageMeta.shortName}:</span>
                  <span>{stageMeta.name}</span>
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${stageTier.badge}`}>
                  {stageTier.name.split(':')[0]}
                </span>
              </div>
              <p className="text-xs text-slate-400">{stageMeta.theme}</p>
            </div>
          </div>

          {/* Quick Stage Switcher & Close */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg bg-slate-800 border border-slate-700 p-0.5">
              <button
                type="button"
                className="px-2 py-1 rounded text-xs font-bold hover:bg-slate-700 text-slate-200 transition-colors"
                onClick={prevStage}
                title="Stage Sebelumnya (Arah Kiri)"
              >
                ◀ Prev
              </button>

              <select
                className="bg-transparent text-xs font-black text-amber-400 px-2 py-1 outline-none cursor-pointer"
                value={currentStage}
                onChange={(e) => setCurrentStage(Number(e.target.value))}
              >
                {STAGE_DEFINITIONS.map((s) => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                    {s.shortName}: {s.name} ({s.feature})
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="px-2 py-1 rounded text-xs font-bold hover:bg-slate-700 text-slate-200 transition-colors"
                onClick={nextStage}
                title="Stage Selanjutnya (Arah Kanan)"
              >
                Next ▶
              </button>
            </div>

            {/* Checkbox: Sertakan Stage ini dalam Room */}
            <button
              type="button"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                isSelected
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-xs'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              onClick={() => onToggleStage(currentStage)}
            >
              <span>{isSelected ? '✓ Terpilih' : '+ Pilih Stage'}</span>
              {isSelected && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-slate-950 px-1">
                  #{selectedOrder + 1}
                </span>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-400 transition-colors"
              onClick={onClose}
              title="Tutup Preview (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Control Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b border-slate-800 bg-slate-900/90 text-xs">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold transition-all ${
                viewMode === 'detail'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              onClick={() => setViewMode('detail')}
            >
              <span>🔍 Kamera Detail (1:1)</span>
            </button>
            <button
              type="button"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold transition-all ${
                viewMode === 'overview'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              onClick={() => setViewMode('overview')}
            >
              <span>🗺️ Minimap Seluruh Map</span>
            </button>
            <button
              type="button"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold transition-all ${
                viewMode === 'playtest'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              onClick={() => {
                setViewMode('playtest');
                resetPlayerPosition();
              }}
            >
              <span>🎮 Uji Karakter (Playtest)</span>
            </button>
          </div>

          {/* Navigation Bookmarks & Actions */}
          <div className="flex items-center gap-2">
            {viewMode === 'detail' && (
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-slate-400 mr-1">Lompat Cepat:</span>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  onClick={() => setCameraX(0)}
                >
                  🏁 Awal (0m)
                </button>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  onClick={() => setCameraX(1400)}
                >
                  📍 Tengah 1 (1.4km)
                </button>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  onClick={() => setCameraX(2800)}
                >
                  📍 Tengah 2 (2.8km)
                </button>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  onClick={() => setCameraX(4100)}
                >
                  📍 Rintangan (4.1km)
                </button>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-500/50 font-bold flex items-center gap-1"
                  onClick={() => setCameraX(4640)}
                  title="Lompat ke Arena Boss (4.8km) & Pintu Checkpoint Pojok Kanan (5.4km)"
                >
                  <span>👑 Boss &amp; Pintu Pojok (5.4km)</span>
                </button>
              </div>
            )}

            {viewMode === 'playtest' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700"
                  onClick={resetPlayerPosition}
                >
                  🔄 Reset Posisi
                </button>
                <label className="flex items-center gap-1 text-xs cursor-pointer select-none text-amber-300">
                  <input
                    type="checkbox"
                    checked={godMode}
                    onChange={(e) => setGodMode(e.target.checked)}
                    className="rounded border-slate-700 text-amber-500"
                  />
                  <span>🛡️ Mode Kebal (God Mode)</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Live Canvas Viewport */}
        <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center min-h-[360px] max-h-[540px]">
          <canvas
            ref={canvasRef}
            width={viewMode === 'overview' ? 1040 : 960}
            height={viewMode === 'overview' ? 340 : 480}
            className={`w-full h-full object-contain ${
              viewMode === 'detail' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
            }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />

          {/* Guide Overlay for Playtest */}
          {viewMode === 'playtest' && (
            <div className="absolute top-2 left-2 flex items-center gap-2 rounded-md bg-black/70 backdrop-blur-xs px-2.5 py-1 text-[11px] text-slate-300 border border-white/10 pointer-events-none">
              <span>🎮 <strong>A/D</strong> atau <strong>Panah</strong>: Jalan</span>
              <span>•</span>
              <span><strong>Spasi / W</strong>: Lompat</span>
            </div>
          )}

          {/* Guide Overlay for Detail Pan */}
          {viewMode === 'detail' && (
            <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded-md bg-black/70 backdrop-blur-xs px-2.5 py-1 text-[11px] text-slate-400 border border-white/10 pointer-events-none">
              <span>🖱️ Drag mouse untuk menggeser kamera | Posisi: <strong>{Math.round(cameraX)}px / 5600px</strong></span>
            </div>
          )}
        </div>

        {/* Camera Horizontal Scroller Slider (In Detail Mode) */}
        {viewMode === 'detail' && (
          <div className="flex items-center gap-3 px-4 py-1.5 bg-slate-950 border-t border-slate-800 text-xs">
            <span className="text-slate-400 text-[11px] font-semibold whitespace-nowrap">
              Jelajah Kamera:
            </span>
            <input
              type="range"
              min={0}
              max={WORLD.width - 960}
              value={cameraX}
              onChange={(e) => setCameraX(Number(e.target.value))}
              className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <span className="font-mono text-[11px] text-amber-400 whitespace-nowrap">
              {Math.round((cameraX / (WORLD.width - 960)) * 100)}% ({Math.round(cameraX)}m)
            </span>
          </div>
        )}

        {/* Entities Summary & Feature Badges Bar */}
        <div className="px-4 py-2.5 bg-slate-950/90 border-t border-slate-800 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-400">Rintangan & Objek:</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                🧱 {stats.totalPlatforms} Platform
              </span>
              {stats.fans > 0 && (
                <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-bold">
                  💨 {stats.fans} Kipas Angin
                </span>
              )}
              {stats.planes > 0 && (
                <span className="px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800/60 font-bold">
                  ✈️ {stats.planes} Pesawat Awan
                </span>
              )}
              {stats.thunders > 0 && (
                <span className="px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60 font-bold">
                  ⚡ {stats.thunders} Awan Petir
                </span>
              )}
              <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/50">
                ❓ {stats.qblocks} Kotak Soal
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/50">
                👾 {stats.enemiesCount} Musuh Patroli
              </span>
              <span className="px-2 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-800/60 font-bold">
                👑 Boss: {stats.bossName} ({stats.bossHp} HP)
              </span>
            </div>

            <div className="text-[11px] text-slate-400">
              Panjang Map: <strong className="text-white">5600px</strong> • Tinggi: <strong className="text-white">1100px</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
