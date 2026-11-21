import React, { useState } from "react";
import { GraduationCap, ShieldCheck, Cloud, Sparkles, LogIn, AlertCircle, Moon, Sun } from "lucide-react";
import { signInWithGoogle } from "../lib/firebase";

interface LoginViewProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ isDarkMode, onToggleDarkMode }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setError("Jendela login Google ditutup sebelum selesai. Silakan coba lagi.");
      } else if (code === "auth/popup-blocked") {
        setError("Pop-up login diblokir oleh browser. Mohon izinkan pop-up untuk situs ini lalu coba lagi.");
      } else {
        setError(err?.message || "Gagal masuk dengan akun Google. Silakan coba kembali.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 transition-colors">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onToggleDarkMode}
          className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs cursor-pointer transition-colors"
          aria-label="Ubah Tema"
          title={isDarkMode ? "Aktifkan Tema Terang" : "Aktifkan Tema Gelap"}
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        </button>
      </div>

      <div className="max-w-md w-full mx-auto bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 dark:border-slate-800 space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-amber-400 rounded-2xl flex items-center justify-center text-slate-950 mx-auto shadow-lg">
            <GraduationCap className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Aplikasi Guru AI
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Sistem Administrasi Guru Digital Terpadu &amp; Asisten AI
            </p>
          </div>
        </div>

        <div className="space-y-2.5 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-slate-600 dark:text-slate-300">
              <strong className="text-slate-800 dark:text-white">Data Aman &amp; Pribadi:</strong> Data siswa, absensi, nilai, dan perangkat ajar tersimpan aman per akun Google Anda.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-slate-600 dark:text-slate-300">
              <strong className="text-slate-800 dark:text-white">Sinkronisasi Real-Time:</strong> Akses administrasi kelas dari perangkat mana saja secara instan.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-slate-600 dark:text-slate-300">
              <strong className="text-slate-800 dark:text-white">Generator AI Lengkap:</strong> Modul Ajar Deep Learning, LKPD, Prota, Prosem, ATP, dan Asisten Guru.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-semibold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3.5 px-5 rounded-2xl text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/25 cursor-pointer transition-all active:scale-[0.98]"
        >
          <LogIn className="w-4 h-4" />
          <span>{loading ? "Menghubungkan ke Google..." : "Masuk dengan Akun Google"}</span>
        </button>
      </div>

      <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
        Aplikasi Guru AI &copy; 2026 &mdash; Terintegrasi Firebase Cloud
      </p>
    </div>
  );
};
