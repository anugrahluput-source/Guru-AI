import React, { useState, useEffect, useRef } from "react";
import { PieChart, ClipboardCheck, Star, Sparkles, Menu, Loader2 } from "lucide-react";
import { User } from "firebase/auth";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { LoginView } from "./components/LoginView";
import { DashboardView } from "./components/DashboardView";
import { KelolaSiswaView } from "./components/KelolaSiswaView";
import { CetakKartuQRView } from "./components/CetakKartuQRView";
import { KelolaMapelView } from "./components/KelolaMapelView";
import { JadwalMengajarView } from "./components/JadwalMengajarView";
import { InputAbsensiView } from "./components/InputAbsensiView";
import { InputPenilaianView } from "./components/InputPenilaianView";
import { AgendaMengajarView } from "./components/AgendaMengajarView";
import { BimbinganWaliView } from "./components/BimbinganWaliView";
import { DownloadPerangkatAjarView } from "./components/DownloadPerangkatAjarView";
import { GeneratorPerangkatAjarAIView } from "./components/GeneratorPerangkatAjarAIView";
import { ModulAjarAIView } from "./components/ModulAjarAIView";
import { AsistenGuruAIView } from "./components/AsistenGuruAIView";
import { GeneratorLkpdAIView } from "./components/GeneratorLkpdAIView";
import { GeneratorAILainnyaView } from "./components/GeneratorAILainnyaView";
import { PusatLaporanView } from "./components/PusatLaporanView";
import { PengaturanView } from "./components/PengaturanView";
import { ResetDatabaseView } from "./components/ResetDatabaseView";

import {
  subscribeAuth,
  signOutUser,
  subscribeCollection,
  subscribePengaturan,
  batchSaveDocuments,
  savePengaturan,
  COLLECTIONS,
  DEFAULT_CONFIG
} from "./lib/firebase";

import {
  Siswa,
  Mapel,
  Jadwal,
  LogAbsensi,
  DataNilai,
  JurnalAgenda,
  SiswaBimbingan,
  BimbinganWali,
  Pengaturan
} from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("edadmin_theme") === "dark";
  });

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [firestoreError, setFirestoreError] = useState<Error | null>(null);

  // Sync dark class on documentElement and body for Tailwind CSS theme switching
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
      localStorage.setItem("edadmin_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
      localStorage.setItem("edadmin_theme", "light");
    }
  }, [isDarkMode]);

  // Firestore Data Collections
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [mapelList, setMapelList] = useState<Mapel[]>([]);
  const [jadwalList, setJadwalList] = useState<Jadwal[]>([]);
  const [absensiList, setAbsensiList] = useState<LogAbsensi[]>([]);
  const [nilaiList, setNilaiList] = useState<DataNilai[]>([]);
  const [agendaList, setAgendaList] = useState<JurnalAgenda[]>([]);
  const [siswaBimbinganList, setSiswaBimbinganList] = useState<SiswaBimbingan[]>([]);
  const [bimbinganList, setBimbinganList] = useState<BimbinganWali[]>([]);
  const [config, setConfig] = useState<Pengaturan>(DEFAULT_CONFIG);
  const [configExists, setConfigExists] = useState<boolean | null>(null);

  const seededForUidRef = useRef<string | null>(null);

  // Subscribe to Firebase Auth state
  useEffect(() => {
    const unsubAuth = subscribeAuth((currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (!currentUser) {
        setIsConnected(false);
        setSiswaList([]);
        setMapelList([]);
        setJadwalList([]);
        setAbsensiList([]);
        setNilaiList([]);
        setAgendaList([]);
        setSiswaBimbinganList([]);
        setBimbinganList([]);
        setConfig(DEFAULT_CONFIG);
        setConfigExists(null);
        seededForUidRef.current = null;
      }
    });
    return () => unsubAuth();
  }, []);

  // Subscribe to user-scoped Firebase real-time collections ONLY when authenticated
  useEffect(() => {
    if (!authReady || !user) return;

    const uid = user.uid;
    const handleSubError = (err: Error) => {
      setFirestoreError(err);
    };

    const unsubs: Array<() => void> = [];

    unsubs.push(
      subscribeCollection<Siswa>(
        COLLECTIONS.SISWA,
        uid,
        (data) => {
          setSiswaList(data);
          setIsConnected(true);
        },
        handleSubError
      )
    );

    unsubs.push(
      subscribeCollection<Mapel>(COLLECTIONS.MAPEL, uid, setMapelList, handleSubError)
    );

    unsubs.push(
      subscribeCollection<Jadwal>(COLLECTIONS.JADWAL, uid, setJadwalList, handleSubError)
    );

    unsubs.push(
      subscribeCollection<LogAbsensi>(COLLECTIONS.LOG_ABSENSI, uid, setAbsensiList, handleSubError)
    );

    unsubs.push(
      subscribeCollection<DataNilai>(COLLECTIONS.DATA_NILAI, uid, setNilaiList, handleSubError)
    );

    unsubs.push(
      subscribeCollection<JurnalAgenda>(COLLECTIONS.JURNAL_AGENDA, uid, setAgendaList, handleSubError)
    );

    unsubs.push(
      subscribeCollection<SiswaBimbingan>(
        COLLECTIONS.SISWA_BIMBINGAN,
        uid,
        setSiswaBimbinganList,
        handleSubError
      )
    );

    unsubs.push(
      subscribeCollection<BimbinganWali>(
        COLLECTIONS.BIMBINGAN_WALI,
        uid,
        setBimbinganList,
        handleSubError
      )
    );

    unsubs.push(
      subscribePengaturan(
        uid,
        (cfg, exists) => {
          setConfigExists(exists);
          if (exists && cfg) {
            setConfig((prev) => ({ ...prev, ...cfg }));
          }
        },
        handleSubError
      )
    );

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [authReady, user]);

  // Seed sample initial data once per authenticated user if their database is empty
  useEffect(() => {
    if (!user || !isConnected || configExists === null) return;
    if (seededForUidRef.current === user.uid) return;

    const seedInitialData = async () => {
      seededForUidRef.current = user.uid;

      if (
        localStorage.getItem(`edadmin_database_cleared_${user.uid}`) === "true" ||
        config?.isDatabaseCleared === true
      ) {
        return;
      }

      try {
        if (!configExists) {
          const initialConfig: Pengaturan = {
            ...DEFAULT_CONFIG,
            Nama_Guru: user.displayName || DEFAULT_CONFIG.Nama_Guru
          };
          await savePengaturan(initialConfig);
        }

        if (siswaList.length === 0) {
          const sampleSiswa: Siswa[] = [
            { id: "1001", nisn: "0012345678", nama: "Ahmad Fulan", kelas: "VII A" },
            { id: "1002", nisn: "0012345679", nama: "Siti Aminah", kelas: "VII A" },
            { id: "1003", nisn: "0012345680", nama: "Budi Pratama", kelas: "VII B" },
            { id: "1004", nisn: "0012345681", nama: "Rizky Febrian", kelas: "VII B" }
          ];
          await batchSaveDocuments(COLLECTIONS.SISWA, sampleSiswa);
        }

        if (mapelList.length === 0) {
          const sampleMapel: Mapel[] = [
            { id: "m1", namaMapel: "Informatika", semester: "Ganjil", tahunAjaran: "2026/2027" },
            { id: "m2", namaMapel: "Matematika", semester: "Ganjil", tahunAjaran: "2026/2027" },
            { id: "m3", namaMapel: "Bahasa Indonesia", semester: "Ganjil", tahunAjaran: "2026/2027" },
            { id: "m4", namaMapel: "IPA Terpadu", semester: "Ganjil", tahunAjaran: "2026/2027" }
          ];
          await batchSaveDocuments(COLLECTIONS.MAPEL, sampleMapel);
        }

        if (jadwalList.length === 0) {
          const sampleJadwal: Jadwal[] = [
            { id: "j1", hari: "Senin", jam: "07:30 - 09:00", kelas: "VII A", mapel: "Informatika" },
            { id: "j2", hari: "Selasa", jam: "09:15 - 10:45", kelas: "VII B", mapel: "Informatika" }
          ];
          await batchSaveDocuments(COLLECTIONS.JADWAL, sampleJadwal);
        }
      } catch (err) {
        console.error("Gagal melakukan inisialisasi data awal:", err);
      }
    };

    seedInitialData();
  }, [
    user,
    isConnected,
    configExists,
    siswaList.length,
    mapelList.length,
    jadwalList.length,
    config?.isDatabaseCleared
  ]);

  if (firestoreError) {
    throw firestoreError;
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-600 dark:text-slate-300 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-xs font-semibold">Memuat sesi aplikasi...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginView
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      />
    );
  }

  const handleSuccessReset = () => {
    setSiswaList([]);
    setMapelList([]);
    setJadwalList([]);
    setAbsensiList([]);
    setNilaiList([]);
    setAgendaList([]);
    setSiswaBimbinganList([]);
    setBimbinganList([]);
  };

  return (
    <div className={`min-h-screen flex bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors ${isDarkMode ? "dark" : ""}`}>
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
      />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          activeTab={activeTab}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          isDarkMode={isDarkMode}
          onSetDarkMode={(isDark) => setIsDarkMode(isDark)}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          isConnected={isConnected}
          config={config}
          userEmail={user.email}
          onSignOut={() => signOutUser()}
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-8 custom-scrollbar pb-24 lg:pb-8">
          {activeTab === "dashboard" && (
            <DashboardView
              siswaList={siswaList}
              mapelList={mapelList}
              absensiList={absensiList}
              nilaiList={nilaiList}
              jadwalList={jadwalList}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === "siswa" && <KelolaSiswaView siswaList={siswaList} />}

          {activeTab === "kartu" && <CetakKartuQRView siswaList={siswaList} config={config} />}

          {activeTab === "mapel" && <KelolaMapelView mapelList={mapelList} />}

          {activeTab === "jadwal" && (
            <JadwalMengajarView
              jadwalList={jadwalList}
              mapelList={mapelList}
              siswaList={siswaList}
            />
          )}

          {activeTab === "absensi" && (
            <InputAbsensiView
              siswaList={siswaList}
              mapelList={mapelList}
              absensiList={absensiList}
              config={config}
            />
          )}

          {activeTab === "penilaian" && (
            <InputPenilaianView
              siswaList={siswaList}
              mapelList={mapelList}
              nilaiList={nilaiList}
              config={config}
            />
          )}

          {activeTab === "agenda" && (
            <AgendaMengajarView
              agendaList={agendaList}
              mapelList={mapelList}
              siswaList={siswaList}
              config={config}
            />
          )}

          {activeTab === "bimbingan" && (
            <BimbinganWaliView
              bimbinganList={bimbinganList}
              siswaBimbinganList={siswaBimbinganList}
              siswaList={siswaList}
              config={config}
            />
          )}

          {activeTab === "downloadperangkat" && <DownloadPerangkatAjarView />}

          {activeTab === "perangkat_ai" && <GeneratorPerangkatAjarAIView config={config} />}

          {activeTab === "modulai" && <ModulAjarAIView config={config} />}

          {activeTab === "asistenai" && <AsistenGuruAIView config={config} />}

          {activeTab === "lkpdai" && <GeneratorLkpdAIView config={config} />}

          {activeTab === "ailainnya" && <GeneratorAILainnyaView />}

          {activeTab === "laporan" && (
            <PusatLaporanView
              siswaList={siswaList}
              mapelList={mapelList}
              absensiList={absensiList}
              nilaiList={nilaiList}
              agendaList={agendaList}
              bimbinganList={bimbinganList}
              config={config}
            />
          )}

          {activeTab === "pengaturan" && (
            <PengaturanView
              config={config}
              onNavigateToReset={() => setActiveTab("resetdb")}
            />
          )}

          {activeTab === "resetdb" && (
            <ResetDatabaseView onSuccessReset={handleSuccessReset} />
          )}
        </main>

        {/* Native Mobile Bottom Navigation Bar */}
        <nav 
          className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 z-30 lg:hidden px-2 py-1.5 pb-safe shadow-lg flex items-center justify-around transition-colors"
          aria-label="Navigasi Bawah Mobile"
        >
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl transition-all active:scale-90 ${
              activeTab === "dashboard"
                ? "text-blue-600 dark:text-blue-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <PieChart className={`w-5 h-5 ${activeTab === "dashboard" ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-0.5 tracking-tight truncate">Beranda</span>
          </button>

          <button
            onClick={() => setActiveTab("absensi")}
            className={`flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl transition-all active:scale-90 ${
              activeTab === "absensi"
                ? "text-blue-600 dark:text-blue-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <ClipboardCheck className={`w-5 h-5 ${activeTab === "absensi" ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-0.5 tracking-tight truncate">Absensi</span>
          </button>

          <button
            onClick={() => setActiveTab("penilaian")}
            className={`flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl transition-all active:scale-90 ${
              activeTab === "penilaian"
                ? "text-blue-600 dark:text-blue-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Star className={`w-5 h-5 ${activeTab === "penilaian" ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-0.5 tracking-tight truncate">Nilai</span>
          </button>

          <button
            onClick={() => setActiveTab("perangkat_ai")}
            className={`flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl transition-all active:scale-90 ${
              activeTab === "perangkat_ai" || activeTab === "modulai" || activeTab === "asistenai"
                ? "text-amber-500 dark:text-amber-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400"
            }`}
          >
            <Sparkles className={`w-5 h-5 ${activeTab === "perangkat_ai" || activeTab === "modulai" || activeTab === "asistenai" ? "scale-110 text-amber-500" : ""}`} />
            <span className="text-[10px] mt-0.5 tracking-tight truncate">Asisten AI</span>
          </button>

          <button
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all active:scale-90"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 tracking-tight truncate">Menu</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
