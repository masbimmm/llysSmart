'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import StagePreviewModal from '@/components/game/stage-preview-modal';
import { STAGE_TIERS, STAGE_DEFINITIONS } from '@/game-engine/maps/world';
import { getCachedData, getPersistedCache, setCachedData } from '@/lib/client-cache';
import DashboardLoader from '@/components/dashboard/dashboard-loader';

type Room = {
  id: string;
  hostId?: string;
  name: string;
  code: string;
  status: string;
  maxPlayers: number;
  settings?: { stageCount?: number; selectedStages?: number[] };
  host?: { id: string; username: string; fullName: string } | null;
  players: { userId: string; username: string; role?: string; ready: boolean }[];
  rejoinRequests?: { userId: string; username: string; requestedAt: number }[];
  level: { id: string; name: string; mapConfig?: string } | null;
  classroom: { id: string; name: string; subject: string; grade: string } | null;
};

type Classroom = { id: string; teacherId?: string; name: string; subject: string; grade: string };
type LevelRow = { id: string; teacherId?: string; name: string; mapConfig: string; questionIds: string[] };
type TeacherOption = { id: string; username: string; fullName: string; role: string };

type RecapData = {
  room: { id: string; name: string; code: string; status: string };
  classroom: { id: string; name: string; subject: string; grade: string } | null;
  level: { id: string; name: string; subjectName: string; grade: string; objectiveName: string } | null;
  totalQuestions: number;
  maxScore: number;
  students: {
    userId: string;
    fullName: string;
    username: string;
    participated: boolean;
    answeredCount: number;
    correctCount: number;
    wrongCount: number;
    totalQuestions: number;
    rawScore: number;
    maxScore: number;
    finalGrade: number;
  }[];
};

const statusLabels: Record<string, string> = {
  waiting: 'Menunggu',
  starting: 'Memulai',
  in_progress: 'Berlangsung',
  paused: 'Jeda',
  completed: 'Selesai',
};

function parseLevelMeta(lvl: LevelRow): { subjectName: string; grade: string; objectiveName: string } {
  try {
    const parsed = JSON.parse(lvl.mapConfig || '{}');
    if (parsed && typeof parsed.subjectName === 'string' && parsed.subjectName.trim()) {
      return {
        subjectName: parsed.subjectName.trim(),
        grade: typeof parsed.grade === 'string' && parsed.grade.trim() ? parsed.grade.trim() : 'Umum',
        objectiveName:
          typeof parsed.objectiveName === 'string' && parsed.objectiveName.trim()
            ? parsed.objectiveName.trim()
            : lvl.name,
      };
    }
  } catch {
    // fallback below
  }
  const parts = lvl.name.split(' - ');
  if (parts.length >= 2) {
    return {
      subjectName: parts[0].trim(),
      grade: 'Umum',
      objectiveName: parts.slice(1).join(' - ').trim(),
    };
  }
  return {
    subjectName: 'Mapel Umum',
    grade: 'Umum',
    objectiveName: lvl.name,
  };
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>(() => getCachedData<Room[]>('teacher:rooms') ?? []);
  const [classrooms, setClassrooms] = useState<Classroom[]>(() => getCachedData<Classroom[]>('teacher:classrooms') ?? []);
  const [levels, setLevels] = useState<LevelRow[]>(() => getCachedData<LevelRow[]>('teacher:levels') ?? []);
  const [teachers, setTeachers] = useState<TeacherOption[]>(() => getCachedData<TeacherOption[]>('teacher:teachers') ?? []);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => Boolean(getCachedData<boolean>('teacher:isAdmin')));

  const [classroomId, setClassroomId] = useState('');
  const [subjectKey, setSubjectKey] = useState('');
  const [levelId, setLevelId] = useState('');
  const [customName, setCustomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(40);
  const [selectedStages, setSelectedStages] = useState<number[]>([1, 2, 3, 4]);
  const [previewStageId, setPreviewStageId] = useState<number | null>(null);
  const [stageFilterTier, setStageFilterTier] = useState<number | 'all'>('all');
  const [isStagesExpanded, setIsStagesExpanded] = useState<boolean>(false);

  function toggleStage(id: number) {
    setSelectedStages((prev) => {
      const exists = prev.includes(id);
      if (exists) {
        return prev.filter((s) => s !== id);
      } else {
        return [...prev, id].sort((a, b) => a - b);
      }
    });
  }

  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'waiting' | 'completed'>('all');
  const [filterTeacherId, setFilterTeacherId] = useState<string>('');
  const [filterClassroomId, setFilterClassroomId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(() => getCachedData<Room[]>('teacher:rooms') === null);
  const [creating, setCreating] = useState(false);
  const [, setBusyRoomId] = useState<string | null>(null);

  const [recapModal, setRecapModal] = useState<RecapData | null>(null);
  const [loadingRecapId, setLoadingRecapId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/rooms?bootstrap=1');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.rooms)) {
          setRooms(data.rooms);
          setCachedData('teacher:rooms', data.rooms);
        }
        if (Array.isArray(data.classrooms)) {
          setClassrooms(data.classrooms);
          setCachedData('teacher:classrooms', data.classrooms);
        }
        if (Array.isArray(data.levels)) {
          setLevels(data.levels);
          setCachedData('teacher:levels', data.levels);
        }
        if (Array.isArray(data.teachers)) {
          setTeachers(data.teachers);
          setCachedData('teacher:teachers', data.teachers);
        }
        if (typeof data.isAdmin === 'boolean') {
          setIsAdmin(data.isAdmin);
          setCachedData('teacher:isAdmin', data.isAdmin);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cachedRooms = getPersistedCache<Room[]>('teacher:rooms');
    const cachedClassrooms = getPersistedCache<Classroom[]>('teacher:classrooms');
    const cachedLevels = getPersistedCache<LevelRow[]>('teacher:levels');
    const cachedTeachers = getPersistedCache<TeacherOption[]>('teacher:teachers');
    const cachedIsAdmin = getPersistedCache<boolean>('teacher:isAdmin');
    if (cachedRooms) {
      setRooms(cachedRooms);
      setLoading(false);
    }
    if (cachedClassrooms) setClassrooms(cachedClassrooms);
    if (cachedLevels) setLevels(cachedLevels);
    if (cachedTeachers) setTeachers(cachedTeachers);
    if (typeof cachedIsAdmin === 'boolean') setIsAdmin(cachedIsAdmin);
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [load]);

  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);

  const subjectGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        teacherId: string;
        subjectName: string;
        grade: string;
        objectives: { level: LevelRow; objectiveName: string }[];
      }
    >();
    for (const lvl of levels) {
      const meta = parseLevelMeta(lvl);
      const ownerId = lvl.teacherId ?? '';
      const key = `${ownerId}__${meta.subjectName}__${meta.grade}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          teacherId: ownerId,
          subjectName: meta.subjectName,
          grade: meta.grade,
          objectives: [],
        });
      }
      map.get(key)!.objectives.push({ level: lvl, objectiveName: meta.objectiveName });
    }
    return Array.from(map.values());
  }, [levels]);

  const statusCounts = useMemo(() => {
    let active = 0;
    let waiting = 0;
    let completed = 0;
    for (const r of rooms) {
      if (r.status === 'in_progress' || r.status === 'paused' || r.status === 'starting') active += 1;
      else if (r.status === 'waiting') waiting += 1;
      else if (r.status === 'completed') completed += 1;
    }
    return { all: rooms.length, active, waiting, completed };
  }, [rooms]);

  const filterableClassrooms = useMemo(() => {
    if (!filterTeacherId) return classrooms;
    return classrooms.filter((c) => c.teacherId === filterTeacherId);
  }, [classrooms, filterTeacherId]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (filterStatus === 'active') {
        if (r.status !== 'in_progress' && r.status !== 'paused' && r.status !== 'starting') return false;
      } else if (filterStatus === 'waiting') {
        if (r.status !== 'waiting') return false;
      } else if (filterStatus === 'completed') {
        if (r.status !== 'completed') return false;
      }

      if (filterTeacherId) {
        const roomTeacherId = r.host?.id ?? r.hostId ?? '';
        if (roomTeacherId !== filterTeacherId) return false;
      }

      if (filterClassroomId) {
        if (r.classroom?.id !== filterClassroomId) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const teacherName = (r.host?.fullName || '').toLowerCase();
        const teacherUname = (r.host?.username || '').toLowerCase();
        const className = (r.classroom?.name || '').toLowerCase();
        const classGrade = (r.classroom?.grade || '').toLowerCase();
        const roomName = (r.name || '').toLowerCase();
        const levelName = (r.level?.name || '').toLowerCase();

        const match =
          teacherName.includes(q) ||
          teacherUname.includes(q) ||
          className.includes(q) ||
          classGrade.includes(q) ||
          roomName.includes(q) ||
          levelName.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [rooms, filterStatus, filterTeacherId, filterClassroomId, searchQuery]);

  const activeSubjectGroup = subjectGroups.find((g) => g.key === subjectKey) ?? null;

  function onSelectSubject(key: string) {
    setSubjectKey(key);
    const grp = subjectGroups.find((g) => g.key === key);
    setLevelId(grp?.objectives[0]?.level.id ?? '');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!classroomId || !levelId) {
      setError('Pilih Kelas, Mata Pelajaran, dan Tujuan Pembelajaran terlebih dahulu.');
      return;
    }
    if (selectedStages.length === 0) {
      setError('Pilih minimal 1 stage game.');
      return;
    }

    const cls = classrooms.find((c) => c.id === classroomId);
    const obj = activeSubjectGroup?.objectives.find((o) => o.level.id === levelId);
    const autoName =
      customName.trim() ||
      `${cls?.name ?? 'Kelas'} - ${activeSubjectGroup?.subjectName ?? 'Mapel'}: ${obj?.objectiveName ?? 'Sesi'}`.slice(0, 75);

    setCreating(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: autoName,
          classroomId,
          levelId,
          maxPlayers,
          settings: { stageCount: selectedStages.length, selectedStages },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Gagal membuat ruang');
        return;
      }
      setCustomName('');
      if (data.room) {
        setRooms((prev) => [data.room, ...prev]);
      } else {
        void load();
      }
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setBusyRoomId(id);
    setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    try {
      const res = await fetch(`/api/rooms/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          setRooms((prev) => prev.map((r) => (r.id === id ? data.room : r)));
        }
      } else {
        void load();
      }
      if (status === 'completed') {
        openRecap(id);
      }
    } finally {
      setBusyRoomId(null);
    }
  }

  async function openRecap(roomId: string) {
    setLoadingRecapId(roomId);
    try {
      const res = await fetch(`/api/rooms/${roomId}/recap`);
      if (res.ok) {
        const data: RecapData = await res.json();
        setRecapModal(data);
      }
    } finally {
      setLoadingRecapId(null);
    }
  }

  function downloadRecapCsv(recap: RecapData) {
    const header = 'No;Nama Lengkap;Username;Status Hadir;Dijawab;Benar;Salah;Total Soal;Skor Poin;Nilai Akhir (0-100)';
    const rows = recap.students.map((st, idx) =>
      [
        idx + 1,
        st.fullName,
        st.username,
        st.participated ? 'Hadir' : 'Tidak Hadir',
        st.answeredCount,
        st.correctCount,
        st.wrongCount,
        st.totalQuestions,
        st.rawScore,
        st.finalGrade,
      ].join(';'),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap_nilai_${recap.room.code}_${recap.classroom?.name ?? 'kelas'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onKickFromDashboard(roomId: string, playerId: string, username: string) {
    if (!confirm(`Keluarkan ${username} dari ruang game ini?`)) return;
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, players: r.players.filter((p) => p.userId !== playerId) } : r)),
    );
    try {
      const res = await fetch('/api/game/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, playerId }),
      });
      if (!res.ok) {
        void load();
      }
    } catch {
      void load();
    }
  }

  async function onKickAllFromDashboard(roomId: string) {
    if (!confirm('Keluarkan semua siswa dari ruang game ini?')) return;
    try {
      const res = await fetch('/api/game/kick-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId }),
      });
      if (res.ok) {
        const data = await res.json();
        const kickedSet = new Set<string>(Array.isArray(data.kickedIds) ? data.kickedIds : []);
        setRooms((prev) =>
          prev.map((r) =>
            r.id === roomId ? { ...r, players: r.players.filter((p) => !kickedSet.has(p.userId)) } : r,
          ),
        );
      }
    } finally {
      void load();
    }
  }

  async function onApproveRejoin(roomId: string, playerId: string) {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? { ...r, rejoinRequests: (r.rejoinRequests ?? []).filter((req) => req.userId !== playerId) }
          : r,
      ),
    );
    try {
      await fetch('/api/game/approve-rejoin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, playerId }),
      });
    } finally {
      void load();
    }
  }

  async function onRejectRejoin(roomId: string, playerId: string) {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? { ...r, rejoinRequests: (r.rejoinRequests ?? []).filter((req) => req.userId !== playerId) }
          : r,
      ),
    );
    try {
      await fetch('/api/game/reject-rejoin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, playerId }),
      });
    } finally {
      void load();
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Hapus ruang ini?')) return;
    const previous = rooms;
    setRooms((prev) => prev.filter((r) => r.id !== id));
    try {
      const res = await fetch(`/api/rooms/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setRooms(previous);
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Gagal menghapus ruang');
      }
    } catch {
      setRooms(previous);
      setError('Gagal menghapus ruang');
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Ruang Game &amp; Rekap Nilai</h1>
          <p className="mt-1 text-sm text-[var(--wood-text)]/70">
            Pilih Kelas, Mata Pelajaran, dan Tujuan Pembelajaran untuk membuka ruang game. Saat game diakhiri, rekap nilai otomatis tersedia.
          </p>
        </div>

        <form onSubmit={onSubmit} className="card-panel space-y-4">
          <div className="border-b border-black/10 pb-3">
            <h2 className="font-display text-lg font-bold">Buat Sesi Ruang Game Baru</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label-field">1. Pilih Kelas</label>
              <select
                className="input-field"
                required
                value={classroomId}
                onChange={(e) => setClassroomId(e.target.value)}
              >
                <option value="">Pilih kelas...</option>
                {classrooms.map((c) => {
                  const t = c.teacherId ? teacherMap.get(c.teacherId) : undefined;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.grade}){isAdmin && t ? ` — Guru: ${t.fullName}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="label-field">2. Pilih Mata Pelajaran</label>
              <select
                className="input-field"
                required
                value={subjectKey}
                onChange={(e) => onSelectSubject(e.target.value)}
              >
                <option value="">Pilih mapel...</option>
                {subjectGroups.map((g) => {
                  const t = g.teacherId ? teacherMap.get(g.teacherId) : undefined;
                  return (
                    <option key={g.key} value={g.key}>
                      {g.subjectName} ({g.grade}){isAdmin && t ? ` — Guru: ${t.fullName}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <label className="label-field">3. Pilih Tujuan Pembelajaran</label>
              <select
                className="input-field"
                required
                value={levelId}
                onChange={(e) => setLevelId(e.target.value)}
                disabled={!activeSubjectGroup}
              >
                <option value="">
                  {activeSubjectGroup ? 'Pilih tujuan pembelajaran...' : 'Pilih mapel dulu...'}
                </option>
                {activeSubjectGroup?.objectives.map((o) => (
                  <option key={o.level.id} value={o.level.id}>
                    {o.objectiveName} ({o.level.questionIds.length} soal)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-field">Judul Sesi Ruang (Opsional)</label>
              <input
                className="input-field"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Kosongkan agar otomatis mengikuti nama Kelas + Mapel"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-black/10 bg-black/[0.02] p-3.5 sm:p-4 transition-all">
              {/* Header / Accordion Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  className="flex flex-wrap items-center gap-2.5 cursor-pointer select-none flex-1 min-w-[240px]"
                  onClick={() => setIsStagesExpanded((v) => !v)}
                >
                  <label className="font-display text-sm sm:text-base font-bold text-gray-900 mb-0 cursor-pointer">
                    4. Pilihan Stage Game
                  </label>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300/80 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                    {selectedStages.length} dari 20 Dipilih
                  </span>

                  {/* Compact flow preview when collapsed */}
                  {!isStagesExpanded && selectedStages.length > 0 && (
                    <div className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-amber-900/80 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                      {selectedStages.map((id, idx) => (
                        <span key={id} className="inline-flex items-center gap-0.5">
                          <span>S{id}</span>
                          {idx < selectedStages.length - 1 && <span className="opacity-40">→</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-2.5 py-1.5 rounded-xl border border-amber-400/90 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer hover:border-amber-500"
                    onClick={() => setPreviewStageId(selectedStages[0] ?? 1)}
                    title="Buka Pratinjau Visual Peta & Uji Coba Fisika Karakter (Stage 1-20)"
                  >
                    <svg className="w-3.5 h-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <span>Pratinjau Peta</span>
                  </button>

                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl border border-black/10 bg-white hover:bg-black/5 text-gray-800 font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                    onClick={() => setIsStagesExpanded((v) => !v)}
                  >
                    <span>{isStagesExpanded ? 'Tutup Pilihan' : 'Pilih / Atur Stage'}</span>
                    <svg
                      className={`w-3.5 h-3.5 text-gray-600 transition-transform duration-200 ${isStagesExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Collapsible Content */}
              {isStagesExpanded && (
                <div className="mt-3.5 pt-3.5 border-t border-black/10 space-y-4 animate-in fade-in duration-200">
                  <p className="text-xs text-[var(--wood-text)]/70">
                    Atur alur petualangan dan rintangan yang akan dihadapi siswa selama sesi permainan. Bebas pilih kombinasi mana saja.
                  </p>

                  {/* Toolbar: Presets & Tier Switcher */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                    {/* Tier Filter Tabs */}
                    <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-black/5 border border-black/5">
                      <button
                        type="button"
                        className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                          stageFilterTier === 'all'
                            ? 'bg-white text-gray-900 shadow-xs border border-black/10'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                        onClick={() => setStageFilterTier('all')}
                      >
                        Semua (20)
                      </button>
                      {STAGE_TIERS.map((tier) => {
                        const tierStages = STAGE_DEFINITIONS.filter((s) => s.tier === tier.id);
                        const selectedCount = tierStages.filter((s) => selectedStages.includes(s.id)).length;
                        const tierLabel = tier.name.split(':')[1]?.split('(')[0]?.trim() || `Tier ${tier.id}`;
                        return (
                          <button
                            key={tier.id}
                            type="button"
                            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                              stageFilterTier === tier.id
                                ? 'bg-white text-gray-900 shadow-xs border border-black/10'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                            onClick={() => setStageFilterTier(tier.id)}
                          >
                            <span>{tierLabel}</span>
                            {selectedCount > 0 && (
                              <span className="h-4 px-1 rounded-full bg-amber-600 text-white text-[10px] font-black leading-none flex items-center justify-center">
                                {selectedCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Quick Presets */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-[var(--wood-text)]/60">Preset:</span>
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded-lg border border-black/10 bg-white hover:bg-amber-50 hover:border-amber-300 font-bold text-gray-700 transition-colors shadow-2xs"
                        onClick={() => setSelectedStages([1, 2, 3, 4])}
                        title="Pilih Stage 1 hingga 4"
                      >
                        Standar (1–4)
                      </button>
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded-lg border border-black/10 bg-white hover:bg-amber-50 hover:border-amber-300 font-bold text-gray-700 transition-colors shadow-2xs"
                        onClick={() => setSelectedStages(Array.from({ length: 20 }, (_, i) => i + 1))}
                        title="Pilih seluruh 20 stage"
                      >
                        Pilih Semua
                      </button>
                      {selectedStages.length > 0 && (
                        <button
                          type="button"
                          className="px-2 py-0.5 rounded-lg font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                          onClick={() => setSelectedStages([])}
                        >
                          Kosongkan
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stage Cards Grouped by Tier */}
                  <div className="space-y-4">
                    {STAGE_TIERS.filter((tier) => stageFilterTier === 'all' || stageFilterTier === tier.id).map((tier) => {
                      const tierStages = STAGE_DEFINITIONS.filter((s) => s.tier === tier.id);
                      const selectedInTier = tierStages.filter((s) => selectedStages.includes(s.id)).length;
                      const allInTierSelected = tierStages.every((s) => selectedStages.includes(s.id));
                      return (
                        <div key={tier.id} className="space-y-2">
                          <div className="flex items-center justify-between pb-1 border-b border-black/10">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-gray-800">
                                {tier.name}
                              </span>
                              <span className="text-[11px] font-medium text-gray-500">
                                • {selectedInTier}/{tierStages.length} terpilih
                              </span>
                            </div>
                            <button
                              type="button"
                              className="text-xs font-bold text-amber-800 hover:text-amber-950 transition-colors cursor-pointer"
                              onClick={() => {
                                const tierIds = tierStages.map((s) => s.id);
                                if (allInTierSelected) {
                                  setSelectedStages((prev) => prev.filter((id) => !tierIds.includes(id)));
                                } else {
                                  setSelectedStages((prev) => Array.from(new Set([...prev, ...tierIds])).sort((a, b) => a - b));
                                }
                              }}
                            >
                              {allInTierSelected ? 'Batalkan Tier Ini' : 'Pilih Semua Tier Ini'}
                            </button>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                            {tierStages.map((stg) => {
                              const isChecked = selectedStages.includes(stg.id);
                              const orderIdx = selectedStages.indexOf(stg.id);
                              return (
                                <div
                                  key={stg.id}
                                  onClick={() => toggleStage(stg.id)}
                                  className={`group relative flex flex-col justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                                    isChecked
                                      ? 'border-amber-500 bg-amber-50/70 shadow-xs ring-1 ring-amber-500/40'
                                      : 'border-black/10 bg-white hover:border-black/25 hover:bg-amber-50/20'
                                  }`}
                                >
                                  {/* Top Row: Stage Indicator + Order Badge + Subtle Eye Preview */}
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <div
                                        className={`w-4 h-4 rounded flex items-center justify-center transition-colors shrink-0 ${
                                          isChecked
                                            ? 'bg-amber-600 text-white'
                                            : 'border border-gray-300 bg-white group-hover:border-amber-400'
                                        }`}
                                      >
                                        {isChecked && (
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </div>
                                      <span className="font-bold text-xs text-gray-900 truncate">
                                        {stg.shortName}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      {isChecked && (
                                        <span
                                          className="px-1.5 py-0.5 rounded-full bg-amber-700 text-white text-[9px] font-black tracking-wider leading-none"
                                          title={`Urutan ke-${orderIdx + 1} yang dimainkan`}
                                        >
                                          #{orderIdx + 1}
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        className="p-1 rounded text-gray-400 hover:text-amber-800 hover:bg-black/5 transition-colors cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPreviewStageId(stg.id);
                                        }}
                                        title={`Pratinjau peta ${stg.shortName}`}
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Stage Name */}
                                  <div className="text-xs font-bold text-gray-800 leading-snug line-clamp-1 mb-1.5">
                                    {stg.name}
                                  </div>

                                  {/* Feature Pill */}
                                  <div>
                                    <span
                                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold leading-tight truncate max-w-full ${
                                        isChecked
                                          ? 'bg-amber-200/80 text-amber-900'
                                          : 'bg-gray-100 text-gray-600'
                                      }`}
                                    >
                                      {stg.feature}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom Flow & Question Distribution Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                    <div className="flex flex-wrap items-center gap-2 font-medium text-amber-950">
                      <span className="font-bold">Alur Stage:</span>
                      {selectedStages.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1">
                          {selectedStages.map((id, idx) => (
                            <span key={id} className="inline-flex items-center gap-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-700 text-white font-bold text-[11px] shadow-2xs">
                                S{id}
                              </span>
                              {idx < selectedStages.length - 1 && (
                                <span className="text-amber-800/60 font-bold">→</span>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="font-semibold text-rose-700">Belum ada stage yang dipilih. Centang minimal 1 stage.</span>
                      )}
                    </div>

                    {levelId && selectedStages.length > 0 && (() => {
                      const selectedLvl = levels.find((l) => l.id === levelId);
                      const qTotal = selectedLvl?.questionIds.length ?? 0;
                      if (qTotal <= 0) return null;
                      const perStage = Math.ceil(qTotal / selectedStages.length);
                      return (
                        <span className="font-semibold text-amber-950 bg-white/80 px-2.5 py-1 rounded-lg border border-amber-300/40 shadow-2xs">
                          Kalkulasi: <strong className="text-amber-900">{qTotal} soal</strong> ÷ {selectedStages.length} stage ≈ <strong className="text-emerald-700">{perStage} soal / stage</strong>
                        </span>
                      );
                    })()}
                  </div>

                  {/* Done / Collapse Button */}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setIsStagesExpanded(false)}
                      className="px-3 py-1.5 rounded-xl border border-amber-300/80 bg-amber-50/80 hover:bg-amber-100 text-amber-950 font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Selesai &amp; Simpan Pilihan</span>
                      <svg className="w-3.5 h-3.5 text-amber-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="label-field">Maks Pemain</label>
              <input
                type="number"
                min={2}
                max={60}
                className="input-field"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
              />
            </div>
          </div>

          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

          <div className="pt-1">
            <button type="submit" disabled={creating} className="btn-primary w-full sm:w-auto">
              {creating ? 'Membuat Ruang Game...' : '+ Buat Ruang Game'}
            </button>
          </div>
        </form>

        {/* FILTER BAR: Status Game, Guru, Kelas, Search */}
        <div className="card-panel space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-display text-base font-bold">Filter Daftar Ruang Game</span>
            {(filterStatus !== 'all' || filterTeacherId !== '' || filterClassroomId !== '' || searchQuery.trim() !== '') && (
              <button
                type="button"
                onClick={() => {
                  setFilterStatus('all');
                  setFilterTeacherId('');
                  setFilterClassroomId('');
                  setSearchQuery('');
                }}
                className="rounded-lg bg-black/5 px-3 py-1 text-xs font-bold text-[var(--wood-text)] hover:bg-black/10"
              >
                Reset Filter
              </button>
            )}
          </div>

          {/* SEARCH BAR: Filter pencarian nama guru host atau kelas */}
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--wood-text)]/50">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              className="input-field !pl-9 pr-8 text-xs sm:text-sm"
              placeholder="Cari nama guru host, nama kelas, atau mapel ruang game..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-bold text-[var(--wood-text)]/50 hover:text-[var(--wood-text)]"
                title="Hapus pencarian"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                filterStatus === 'all'
                  ? 'bg-[var(--navy-panel)] text-white'
                  : 'bg-[var(--cream-soft)] text-[var(--wood-text)] hover:bg-black/10'
              }`}
            >
              Semua Status ({statusCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('active')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                filterStatus === 'active'
                  ? 'bg-blue-700 text-white'
                  : 'bg-blue-100/80 text-blue-800 hover:bg-blue-200/80'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${filterStatus === 'active' ? 'bg-white' : 'bg-blue-700'}`} />
              Aktif / Berjalan ({statusCounts.active})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('waiting')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                filterStatus === 'waiting'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-100/80 text-amber-900 hover:bg-amber-200/80'
              }`}
            >
              Menunggu ({statusCounts.waiting})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('completed')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                filterStatus === 'completed'
                  ? 'bg-green-700 text-white'
                  : 'bg-green-100/80 text-green-800 hover:bg-green-200/80'
              }`}
            >
              Selesai ({statusCounts.completed})
            </button>
          </div>

          <div className={`grid gap-3 pt-1 ${isAdmin ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
            {isAdmin && (
              <div>
                <label className="label-field">Filter Berdasarkan Guru</label>
                <select
                  className="input-field"
                  value={filterTeacherId}
                  onChange={(e) => {
                    setFilterTeacherId(e.target.value);
                    setFilterClassroomId('');
                  }}
                >
                  <option value="">Semua Guru ({teachers.length})</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} (@{t.username}){t.role === 'admin' ? ' — Admin' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="label-field">Filter Berdasarkan Kelas</label>
              <select
                className="input-field"
                value={filterClassroomId}
                onChange={(e) => setFilterClassroomId(e.target.value)}
              >
                <option value="">Semua Kelas ({filterableClassrooms.length})</option>
                {filterableClassrooms.map((c) => {
                  const t = c.teacherId ? teacherMap.get(c.teacherId) : undefined;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.grade}){isAdmin && t ? ` — ${t.fullName}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <DashboardLoader label="Memuat daftar ruang game..." cards={2} />
        ) : rooms.length === 0 ? (
          <div className="card-panel py-10 text-center text-sm text-[var(--wood-text)]/60">
            Belum ada sesi ruang game.
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="card-panel py-8 text-center text-sm text-[var(--wood-text)]/70">
            Tidak ada ruang game yang cocok dengan filter yang dipilih.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRooms.map((r) => (
              <div key={r.id} className="card-panel space-y-3">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-bold sm:text-xl">{r.name}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--wood-text)]/75 sm:text-sm">
                      {r.host && (
                        <span>
                          Guru Host: <strong>{r.host.fullName} (@{r.host.username})</strong>
                        </span>
                      )}
                      <span>
                        Kelas: <strong>{r.classroom?.name ?? '-'}</strong>
                      </span>
                      <span>
                        Tujuan Pembelajaran: <strong>{r.level?.name ?? '-'}</strong>
                      </span>
                      <span>
                        Pemain: <strong>{r.players.length}/{r.maxPlayers}</strong>
                      </span>
                      <span>
                        Stage:{' '}
<strong>
  {r.settings?.selectedStages && r.settings.selectedStages.length > 0
    ? `${r.settings.selectedStages.length} Stage (${r.settings.selectedStages.map((s) => `S${s}`).join(', ')})`
    : `${r.settings?.stageCount ?? 2} Stage`}
</strong>
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold sm:text-sm ${
                        r.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : r.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-[var(--cream-soft)] text-[var(--wood-text)]'
                      }`}
                    >
                      {statusLabels[r.status] ?? r.status}
                    </span>
                  </div>
                </div>

                {r.players.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[var(--cream-bg)]/70 p-2.5 text-xs">
                    <span className="font-bold text-[var(--wood-text)]/75">Pemain di ruang:</span>
                    {r.players.map((p) => (
                      <span
                        key={p.userId}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#dcc8a6] bg-white px-2.5 py-1 font-semibold"
                      >
                        <span>
                          {p.username}
                          {p.role === 'admin' ? ' (ADMIN)' : p.role === 'teacher' ? ' (GURU)' : ''}
                        </span>
                        {p.role !== 'admin' && p.role !== 'teacher' && (
                          <button
                            type="button"
                            title={`Kick ${p.username}`}
                            onClick={() => onKickFromDashboard(r.id, p.userId, p.username)}
                            className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700 hover:bg-red-200"
                          >
                            Kick
                          </button>
                        )}
                      </span>
                    ))}
                    {r.players.some((p) => p.role !== 'admin' && p.role !== 'teacher') && (
                      <button
                        type="button"
                        onClick={() => onKickAllFromDashboard(r.id)}
                        className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-700"
                      >
                        Kick Semua
                      </button>
                    )}
                  </div>
                )}

                {r.rejoinRequests && r.rejoinRequests.length > 0 && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3">
                    <div className="text-xs font-bold text-amber-900">
                      Permintaan Masuk Kembali (Approve akan me-reset soal &amp; poin sesi siswa ke 0):
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.rejoinRequests.map((req) => (
                        <div
                          key={req.userId}
                          className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold shadow-sm"
                        >
                          <span className="font-bold text-[var(--wood-dark)]">{req.username}</span>
                          <button
                            type="button"
                            onClick={() => onApproveRejoin(r.id, req.userId)}
                            className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => onRejectRejoin(r.id, req.userId)}
                            className="rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-200"
                          >
                            Tolak
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t border-black/5 pt-3">
                  {r.status === 'waiting' && (
                    <button className="btn-success !px-3.5 !py-2 text-xs sm:text-sm" onClick={() => setStatus(r.id, 'in_progress')}>
                      Mulai Game
                    </button>
                  )}
                  {r.status === 'in_progress' && (
                    <button className="btn-secondary !px-3.5 !py-2 text-xs sm:text-sm" onClick={() => setStatus(r.id, 'paused')}>
                      Jeda
                    </button>
                  )}
                  {r.status === 'paused' && (
                    <button className="btn-success !px-3.5 !py-2 text-xs sm:text-sm" onClick={() => setStatus(r.id, 'in_progress')}>
                      Lanjutkan
                    </button>
                  )}
                  {(r.status === 'in_progress' || r.status === 'paused') && (
                    <button className="btn-primary !px-3.5 !py-2 text-xs sm:text-sm" onClick={() => setStatus(r.id, 'completed')}>
                      Akhiri &amp; Lihat Rekap
                    </button>
                  )}
                  {r.status !== 'completed' && (
                    <Link
                      className="inline-flex items-center justify-center rounded-xl bg-[var(--blue-info)] px-3.5 py-2 text-xs font-bold text-white hover:opacity-95 sm:text-sm"
                      href={`/game/${r.id}`}
                    >
                      Masuk Ruang
                    </Link>
                  )}
                  {r.status === 'completed' && (
                    <button
                      type="button"
                      className="rounded-xl bg-[var(--navy-panel)] px-3.5 py-2 text-xs font-bold text-white hover:bg-[var(--navy-deep)] sm:text-sm"
                      onClick={() => openRecap(r.id)}
                      disabled={loadingRecapId === r.id}
                    >
                      {loadingRecapId === r.id ? 'Memuat Rekap...' : 'Lihat Rekap Nilai'}
                    </button>
                  )}
                  {r.status === 'completed' && isAdmin && (
                    <button
                      type="button"
                      className="btn-success !px-3.5 !py-2 text-xs sm:text-sm"
                      onClick={() => {
                        if (confirm(`Aktifkan kembali ruang game '${r.name}'? Siswa dan guru akan dapat masuk kembali ke arena.`)) {
                          setStatus(r.id, 'in_progress');
                        }
                      }}
                    >
                      ⚡ Aktifkan Kembali
                    </button>
                  )}
                  <button
                    className="ml-auto rounded-xl bg-red-100 px-3.5 py-2 text-xs font-bold text-red-700 hover:bg-red-200 sm:text-sm"
                    onClick={() => onDelete(r.id)}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {recapModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setRecapModal(null)}
        >
          <div
            className="card-panel max-h-[88vh] w-full max-w-4xl overflow-y-auto bg-[var(--cream-bg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 pb-4">
              <div>
                <span className="rounded-lg bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-800">
                  REKAP NILAI AKHIR
                </span>
                <h2 className="mt-1 font-display text-xl font-bold sm:text-2xl">{recapModal.room.name}</h2>
                <p className="mt-0.5 text-xs text-[var(--wood-text)]/75 sm:text-sm">
                  Kelas: <strong>{recapModal.classroom?.name ?? '-'}</strong> · Mapel:{' '}
                  <strong>{recapModal.level?.subjectName ?? '-'}</strong> · Tujuan Pembelajaran:{' '}
                  <strong>{recapModal.level?.objectiveName ?? '-'}</strong> · Total Soal:{' '}
                  <strong>{recapModal.totalQuestions}</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-success !px-3.5 !py-2 text-xs sm:text-sm"
                  onClick={() => downloadRecapCsv(recapModal)}
                >
                  Unduh Nilai (CSV)
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-black/10 px-2.5 py-1.5 text-xs font-bold hover:bg-black/20"
                  onClick={() => setRecapModal(null)}
                >
                  ✕
                </button>
              </div>
            </div>

            {recapModal.students.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--wood-text)]/70">
                Belum ada data siswa atau jawaban pada sesi permainan ini.
              </p>
            ) : (
              <div className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/15 text-xs font-bold uppercase tracking-wide text-[var(--wood-text)]/75">
                      <th className="py-2.5 pr-3">Peringkat</th>
                      <th className="py-2.5 pr-3">Nama Siswa</th>
                      <th className="py-2.5 pr-3">Username</th>
                      <th className="py-2.5 pr-3 text-center">Kehadiran</th>
                      <th className="py-2.5 pr-3 text-center">Benar</th>
                      <th className="py-2.5 pr-3 text-center">Salah</th>
                      <th className="py-2.5 pr-3 text-center">Skor Game</th>
                      <th className="py-2.5 text-right">Nilai Akhir (0-100)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/10">
                    {recapModal.students.map((st, idx) => (
                      <tr key={st.userId}>
                        <td className="py-2.5 pr-3 font-bold">#{idx + 1}</td>
                        <td className="py-2.5 pr-3 font-semibold">{st.fullName}</td>
                        <td className="py-2.5 pr-3 font-mono text-xs">@{st.username}</td>
                        <td className="py-2.5 pr-3 text-center">
                          <span
                            className={`rounded-lg px-2.5 py-0.5 text-xs font-bold ${
                              st.participated ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {st.participated ? 'Hadir' : 'Belum Masuk'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-center font-bold text-green-700">{st.correctCount}</td>
                        <td className="py-2.5 pr-3 text-center font-bold text-red-600">{st.wrongCount}</td>
                        <td className="py-2.5 pr-3 text-center font-semibold">
                          {st.rawScore} / {recapModal.maxScore}
                        </td>
                        <td className="py-2.5 text-right">
                          <span
                            className={`inline-block rounded-lg px-2.5 py-0.5 font-display text-sm font-bold ${
                              st.finalGrade >= 75
                                ? 'bg-green-100 text-green-900'
                                : st.finalGrade >= 50
                                  ? 'bg-yellow-100 text-yellow-900'
                                  : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {st.finalGrade}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button type="button" className="btn-primary" onClick={() => setRecapModal(null)}>
                Tutup Rekap
              </button>
            </div>
          </div>
        </div>
      )}
      <StagePreviewModal
        isOpen={previewStageId !== null}
        onClose={() => setPreviewStageId(null)}
        initialStageId={previewStageId ?? 1}
        selectedStages={selectedStages}
        onToggleStage={toggleStage}
      />

    </>
  );
}
