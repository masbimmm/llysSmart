'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import StagePreviewModal from '@/components/game/stage-preview-modal';
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

const STAGE_TIERS = [
  { id: 1, name: 'Tier 1: Rintangan Mudah (Stage 1-5)', color: 'border-emerald-300 bg-emerald-50/60 text-emerald-900', badge: 'bg-emerald-600 text-white' },
  { id: 2, name: 'Tier 2: Rintangan Sedang (Stage 6-10)', color: 'border-amber-300 bg-amber-50/60 text-amber-900', badge: 'bg-amber-600 text-white' },
  { id: 3, name: 'Tier 3: Rintangan Sulit (Stage 11-15)', color: 'border-rose-300 bg-rose-50/60 text-rose-900', badge: 'bg-rose-600 text-white' },
  { id: 4, name: 'Tier 4: Rintangan Gak Masuk Akal (Stage 16-20)', color: 'border-purple-300 bg-purple-50/60 text-purple-900', badge: 'bg-purple-600 text-white' },
];

const STAGE_DEFINITIONS = [
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

            <div className="sm:col-span-2 lg:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <label className="label-field mb-0">
                    4. Pilihan Stage Game (20 Stage / 4 Tingkat Kesulitan){' '}
                    <span className="font-bold text-amber-800">
                      ({selectedStages.length} Stage Terpilih)
                    </span>
                  </label>
                  <button
                    type="button"
                    className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 font-bold text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer text-xs"
                    onClick={() => setPreviewStageId(selectedStages[0] ?? 1)}
                    title="Buka Preview Visual Map & Uji Coba Stage (1-20)"
                  >
                    <span>👁️ Preview Map (Stage 1-20)</span>
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-[var(--wood-text)]/60 font-medium mr-1">Preset:</span>
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 font-semibold text-emerald-900 transition-colors"
                    onClick={() => setSelectedStages([1, 2, 3, 4, 5])}
                    title="Pilih semua Stage Mudah"
                  >
                    🟢 Mudah (1-5)
                  </button>
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 font-semibold text-amber-900 transition-colors"
                    onClick={() => setSelectedStages([6, 7, 8, 9, 10])}
                    title="Pilih semua Stage Sedang (Termasuk Naik Pesawat)"
                  >
                    🟡 Sedang (6-10)
                  </button>
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded border border-rose-300 bg-rose-50 hover:bg-rose-100 font-semibold text-rose-900 transition-colors"
                    onClick={() => setSelectedStages([11, 12, 13, 14, 15])}
                    title="Pilih semua Stage Sulit"
                  >
                    🔴 Sulit (11-15)
                  </button>
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded border border-purple-300 bg-purple-50 hover:bg-purple-100 font-semibold text-purple-900 transition-colors"
                    onClick={() => setSelectedStages([16, 17, 18, 19, 20])}
                    title="Pilih semua Stage Gak Masuk Akal (Ekstrem)"
                  >
                    🟣 Gak Masuk Akal (16-20)
                  </button>
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded border border-blue-400 bg-blue-50 hover:bg-blue-100 font-semibold text-blue-900 transition-colors"
                    onClick={() => setSelectedStages(Array.from({ length: 20 }, (_, i) => i + 1))}
                    title="Pilih semua 20 Stage"
                  >
                    ⚡ Semua 20 Stage
                  </button>
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 font-semibold text-slate-700 transition-colors"
                    onClick={() => setSelectedStages([1, 2, 3, 4])}
                    title="Reset ke Default 4 Stage"
                  >
                    Default (1-4)
                  </button>
                </div>
              </div>

              <p className="text-xs text-[var(--wood-text)]/70 mb-3">
                Centang stage yang ingin dimainkan. Bebas pilih kombinasi mana saja (contoh: hanya Stage 1, 3 Kipas Angin, dan 10 Pesawat).
              </p>

              {/* 4 Grouped Tiers */}
              <div className="space-y-3">
                {STAGE_TIERS.map((tier) => {
                  const tierStages = STAGE_DEFINITIONS.filter((s) => s.tier === tier.id);
                  const selectedInTier = tierStages.filter((s) => selectedStages.includes(s.id)).length;
                  return (
                    <div key={tier.id} className={`rounded-xl border p-2.5 ${tier.color}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold tracking-wide">
                          {tier.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="font-semibold opacity-75">
                            {selectedInTier}/{tierStages.length} Terpilih
                          </span>
                          <button
                            type="button"
                            className="px-1.5 py-0.5 rounded bg-white/80 hover:bg-white text-[10px] font-bold border border-black/10 transition-colors shadow-xs cursor-pointer"
                            onClick={() => {
                              const tierIds = tierStages.map((s) => s.id);
                              const allInTierSelected = tierIds.every((id) => selectedStages.includes(id));
                              if (allInTierSelected) {
                                setSelectedStages((prev) => prev.filter((id) => !tierIds.includes(id)));
                              } else {
                                setSelectedStages((prev) => Array.from(new Set([...prev, ...tierIds])).sort((a, b) => a - b));
                              }
                            }}
                          >
                            {selectedInTier === tierStages.length ? 'Batal Semua' : 'Pilih Semua Tier Ini'}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
                        {tierStages.map((stg) => {
                          const isChecked = selectedStages.includes(stg.id);
                          const orderIdx = selectedStages.indexOf(stg.id);
                          return (
                            <label
                              key={stg.id}
                              className={`relative flex items-start gap-2 p-2 rounded-lg border cursor-pointer select-none transition-all ${
                                isChecked
                                  ? 'border-amber-500 bg-white shadow-sm ring-2 ring-amber-400'
                                  : 'border-black/10 bg-white/70 hover:border-black/25 hover:bg-white'
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                checked={isChecked}
                                onChange={() => toggleStage(stg.id)}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-sm">{stg.icon}</span>
                                  <span className={`text-xs font-bold leading-tight ${isChecked ? 'text-amber-950' : 'text-gray-800'}`}>
                                    {stg.shortName}
                                  </span>
                                </div>
                                <div className="text-[11px] font-medium text-gray-700 leading-tight mt-0.5 truncate">
                                  {stg.name}
                                </div>
                                <div className="mt-1 flex items-center justify-between gap-1">
                                  <span className={`inline-block px-1 py-0.2 rounded text-[9px] font-semibold truncate ${
                                    isChecked ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {stg.feature}
                                  </span>
                                  <button
                                    type="button"
                                    className="px-1.5 py-0.5 rounded bg-amber-100/90 hover:bg-amber-200 text-[10px] font-bold text-amber-900 border border-amber-300 transition-colors flex items-center gap-0.5 cursor-pointer shadow-xs shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setPreviewStageId(stg.id);
                                    }}
                                    title={`Preview / Intip Peta ${stg.shortName}`}
                                  >
                                    <span>👁️ Intip</span>
                                  </button>
                                </div>
                              </div>
                              {isChecked && (
                                <span
                                  className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[9px] font-extrabold text-white shadow-xs"
                                  title={`Urutan ke-${orderIdx + 1} yang dimainkan`}
                                >
                                  #{orderIdx + 1}
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-500/10 p-2 text-xs border border-amber-500/20">
                <div className="flex items-center gap-1.5 font-medium text-amber-950">
                  <span>🚀 Alur Stage:</span>
                  {selectedStages.length > 0 ? (
                    <span className="font-bold">
                      {selectedStages.map((id) => `Stage ${id}`).join(' ➔ ')}
                    </span>
                  ) : (
                    <span className="font-bold text-rose-600">⚠️ Belum ada stage yang dipilih! Centang minimal 1 stage.</span>
                  )}
                </div>

                {levelId && selectedStages.length > 0 && (() => {
                  const selectedLvl = levels.find((l) => l.id === levelId);
                  const qTotal = selectedLvl?.questionIds.length ?? 0;
                  if (qTotal <= 0) return null;
                  const perStage = Math.ceil(qTotal / selectedStages.length);
                  return (
                    <span className="font-semibold text-blue-900">
                      Kalkulasi: {qTotal} soal ÷ {selectedStages.length} stage = <strong>~{perStage} kotak soal / stage</strong>
                    </span>
                  );
                })()}
              </div>
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
