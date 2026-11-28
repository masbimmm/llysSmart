import Link from 'next/link';
import { getCurrentUser } from '@/server/auth/session';

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen bg-gradient-to-b from-[var(--sky-top)] to-[var(--sky-bottom)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <img
            src="/icons/icon-192.png"
            alt="Logo llysSmart"
            className="h-12 w-12 rounded-2xl shadow-md"
          />
          <div>
            <span className="block font-display text-2xl font-bold leading-none text-white drop-shadow">llysSmart</span>
            <span className="text-xs font-bold text-white/85">Let&apos;s Learn Your Skills</span>
          </div>
        </div>
        <nav className="flex items-center gap-3">
          {user ? (
            <Link
              href={user.role === 'teacher' || user.role === 'admin' ? '/dashboard/teacher' : '/dashboard/student'}
              className="btn-primary text-sm"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-secondary text-sm">
                Login
              </Link>
              <Link href="/register" className="btn-primary text-sm">
                Register
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-10 text-center">
        <h1 className="font-display text-5xl font-bold text-white drop-shadow-lg md:text-6xl">
          Belajar Jadi Petualangan
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-white/90">
          Platform game edukasi multiplayer. Guru bikin kelas dan soal, siswa berlomba menjawab
          di dunia 2D yang seru.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href={user ? (user.role === 'teacher' || user.role === 'admin' ? '/dashboard/teacher' : '/dashboard/student') : '/register'} className="btn-primary text-lg">
            Mulai Main ▶
          </Link>
          {!user && (
            <Link href="/login" className="btn-secondary text-lg">
              Sudah Punya Akun
            </Link>
          )}
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-3">
          {[
            { icon: '🏫', title: 'Buat Kelas', desc: 'Guru membuat kelas dengan kode join 6 karakter.' },
            { icon: '❓', title: 'Bank Soal', desc: 'Pilihan ganda, benar/salah, isian singkat, dan melengkapi.' },
            { icon: '🏆', title: 'Multiplayer', desc: 'Hingga 40 siswa bertanding real-time dalam satu ruang.' },
          ].map((f) => (
            <div key={f.title} className="card-panel text-left">
              <span className="text-3xl">{f.icon}</span>
              <h3 className="mt-3 font-display text-xl font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-[var(--wood-text)]/80">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
