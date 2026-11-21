import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
  getDocs,
  getDocFromServer,
  writeBatch,
  query,
  where,
  serverTimestamp
} from "firebase/firestore";
import firebaseConfigData from "../../firebase-applet-config.json";
import { Pengaturan } from "../types";

const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Use the explicit firestoreDatabaseId if provisioned
export const firestore = getFirestore(
  app,
  firebaseConfigData.firestoreDatabaseId || "(default)"
);

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write"
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Collections references
export const COLLECTIONS = {
  SISWA: "data_siswa",
  MAPEL: "mapel",
  JADWAL: "jadwal",
  LOG_ABSENSI: "log_absensi",
  DATA_NILAI: "data_nilai",
  JURNAL_AGENDA: "jurnal_agenda",
  SISWA_BIMBINGAN: "siswa_bimbingan",
  BIMBINGAN_WALI: "bimbingan_wali",
  PENGATURAN: "pengaturan"
};

export const DEFAULT_CONFIG: Pengaturan = {
  Nama_Guru: "Drs. Yefri Haryanto, M.Pd.",
  NIP_Guru: "19850312 201001 1 008",
  Pemerintah: "PEMERINTAH PROVINSI JAMBI",
  Nama_Sekolah: "SMP NEGERI 3 KERINCI",
  Alamat_Sekolah: "Jalan Raya Lintas Sungai Penuh, Telp: (0748) 21102",
  Nama_Kepsek: "Hamdani, S.Pd., M.Si.",
  NIP_Kepsek: "19780514 200212 1 003",
  Tempat_Tanda_Tangan: "Kerinci",
  Logo_Kiri: "",
  Logo_Kanan: ""
};

// Authentication Helpers
export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  return signOut(auth);
}

export function subscribeAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error("Sesi login belum aktif. Silakan masuk dengan akun Google terlebih dahulu.");
  }
  return uid;
}

// Deterministic, rules-safe document ID helper (^[a-zA-Z0-9_-]+$, <= 128 chars)
function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function sanitizeDocId(rawId: string, uid: string): string {
  const cleaned = String(rawId || Date.now())
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || String(Date.now());
  const prefix = `${uid}_`;
  const scoped = cleaned.startsWith(prefix) ? cleaned : `${prefix}${cleaned}`;
  if (scoped.length <= 128) return scoped;
  const suffix = `_${hashString(scoped)}`;
  return `${scoped.slice(0, 128 - suffix.length)}${suffix}`;
}

function boundStr(val: unknown, maxLen: number, fallback = ""): string {
  const str = typeof val === "string" ? val : val == null ? fallback : String(val);
  return str.slice(0, maxLen);
}

function buildValidatedPayload(
  collectionName: string,
  finalId: string,
  data: Record<string, any>,
  uid: string
): Record<string, any> {
  const base = {
    id: finalId,
    ownerId: uid,
    updatedAt: serverTimestamp()
  };

  switch (collectionName) {
    case COLLECTIONS.SISWA:
      return {
        ...base,
        nisn: boundStr(data.nisn, 50),
        nama: boundStr(data.nama, 150),
        kelas: boundStr(data.kelas, 50)
      };
    case COLLECTIONS.MAPEL:
      return {
        ...base,
        namaMapel: boundStr(data.namaMapel, 120),
        semester: boundStr(data.semester || "Ganjil", 30),
        tahunAjaran: boundStr(data.tahunAjaran || "2026/2027", 30)
      };
    case COLLECTIONS.JADWAL:
      return {
        ...base,
        hari: boundStr(data.hari, 30),
        jam: boundStr(data.jam, 50),
        kelas: boundStr(data.kelas, 50),
        mapel: boundStr(data.mapel, 120)
      };
    case COLLECTIONS.LOG_ABSENSI: {
      const validStatuses = ["Hadir", "Izin", "Sakit", "Alpa"];
      const status = validStatuses.includes(data.status) ? data.status : "Hadir";
      return {
        ...base,
        waktu: boundStr(data.waktu || data.tanggal, 30),
        tanggal: boundStr(data.tanggal || data.waktu, 30),
        kelas: boundStr(data.kelas, 50),
        mapel: boundStr(data.mapel, 120),
        idSiswa: boundStr(data.idSiswa, 128),
        namaSiswa: boundStr(data.namaSiswa, 150),
        status,
        bulan: boundStr(data.bulan || "01", 20),
        tahun: boundStr(data.tahun || "2026", 10),
        namaGuru: boundStr(data.namaGuru || "Guru", 150)
      };
    }
    case COLLECTIONS.DATA_NILAI: {
      const rawNilai = data.nilai;
      const nilai =
        rawNilai === "" || rawNilai === null || rawNilai === undefined
          ? ""
          : Math.min(100, Math.max(0, Number(rawNilai) || 0));
      return {
        ...base,
        waktu: boundStr(data.waktu, 30),
        jenis: boundStr(data.jenis, 80),
        mapel: boundStr(data.mapel, 120),
        kelas: boundStr(data.kelas, 50),
        idSiswa: boundStr(data.idSiswa, 128),
        namaSiswa: boundStr(data.namaSiswa, 150),
        nilai,
        namaGuru: boundStr(data.namaGuru || "Guru", 150)
      };
    }
    case COLLECTIONS.JURNAL_AGENDA:
      return {
        ...base,
        tanggal: boundStr(data.tanggal, 30),
        jam: boundStr(data.jam, 50),
        kelas: boundStr(data.kelas, 50),
        mapel: boundStr(data.mapel, 120),
        materi: boundStr(data.materi, 1000),
        status: boundStr(data.status || "Terlaksana", 50),
        absenSiswa: boundStr(data.absenSiswa ?? "", 500),
        ket: boundStr(data.ket ?? "", 1000),
        namaGuru: boundStr(data.namaGuru || "Guru", 150)
      };
    case COLLECTIONS.SISWA_BIMBINGAN:
      return {
        ...base,
        namaSiswa: boundStr(data.namaSiswa, 150),
        kelas: boundStr(data.kelas, 50)
      };
    case COLLECTIONS.BIMBINGAN_WALI:
      return {
        ...base,
        tanggal: boundStr(data.tanggal, 30),
        namaSiswa: boundStr(data.namaSiswa, 150),
        kelas: boundStr(data.kelas ?? "", 50),
        jenis: boundStr(data.jenis, 100),
        kasus: boundStr(data.kasus, 2000),
        tindakLanjut: boundStr(data.tindakLanjut, 2000),
        guruWali: boundStr(data.guruWali || "Guru Wali", 150)
      };
    default:
      return { ...data, ...base };
  }
}

function buildPengaturanPayload(config: Pengaturan, uid: string): Record<string, any> {
  const payload: Record<string, any> = {
    Nama_Guru: boundStr(config.Nama_Guru ?? "", 200),
    NIP_Guru: boundStr(config.NIP_Guru ?? "", 100),
    Pemerintah: boundStr(config.Pemerintah ?? "", 200),
    Nama_Sekolah: boundStr(config.Nama_Sekolah ?? "", 200),
    Alamat_Sekolah: boundStr(config.Alamat_Sekolah ?? "", 500),
    Nama_Kepsek: boundStr(config.Nama_Kepsek ?? "", 200),
    NIP_Kepsek: boundStr(config.NIP_Kepsek ?? "", 100),
    Tempat_Tanda_Tangan: boundStr(config.Tempat_Tanda_Tangan ?? "", 150),
    Logo_Kiri: boundStr(config.Logo_Kiri ?? "", 50000),
    Logo_Kanan: boundStr(config.Logo_Kanan ?? "", 50000),
    ownerId: uid,
    updatedAt: serverTimestamp()
  };
  if (typeof config.isDatabaseCleared === "boolean") {
    payload.isDatabaseCleared = config.isDatabaseCleared;
  }
  return payload;
}

// Validate Connection to Firestore on startup
async function testConnection() {
  try {
    await getDocFromServer(doc(firestore, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

// Generic Realtime Subscription scoped to the signed-in user
export function subscribeCollection<T>(
  collectionName: string,
  uid: string,
  callback: (data: T[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = query(collection(firestore, collectionName), where("ownerId", "==", uid));
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: T[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as unknown as T);
      });
      callback(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, collectionName);
      } catch (wrappedErr: any) {
        if (onError) {
          onError(wrappedErr);
        } else {
          throw wrappedErr;
        }
      }
    }
  );
}

// Single Document Save/Update
export async function saveDocument(
  collectionName: string,
  id: string,
  data: Record<string, any>
) {
  const uid = requireUid();
  const finalId = sanitizeDocId(id, uid);
  try {
    const docRef = doc(firestore, collectionName, finalId);
    const payload = buildValidatedPayload(collectionName, finalId, data, uid);
    await setDoc(docRef, payload, { merge: true });
  } catch (err: any) {
    console.error(`Error saving document in ${collectionName}:`, err);
    handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${finalId}`);
  }
}

// Single Document Delete
export async function deleteDocument(collectionName: string, id: string) {
  const uid = requireUid();
  const finalId = sanitizeDocId(id, uid);
  try {
    const docRef = doc(firestore, collectionName, finalId);
    await deleteDoc(docRef);
  } catch (err: any) {
    console.error(`Error deleting document in ${collectionName}:`, err);
    handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${finalId}`);
  }
}

// Batch Save Documents
export async function batchSaveDocuments(
  collectionName: string,
  items: Array<{ id: string; [key: string]: any }>
) {
  if (!items || items.length === 0) return;
  const uid = requireUid();
  try {
    for (let i = 0; i < items.length; i += 400) {
      const batch = writeBatch(firestore);
      const chunk = items.slice(i, i + 400);
      chunk.forEach((item) => {
        const finalId = sanitizeDocId(item.id, uid);
        const docRef = doc(firestore, collectionName, finalId);
        const payload = buildValidatedPayload(collectionName, finalId, item, uid);
        batch.set(docRef, payload, { merge: true });
      });
      await batch.commit();
    }
  } catch (err: any) {
    console.error(`Error batch saving documents in ${collectionName}:`, err);
    handleFirestoreError(err, OperationType.WRITE, collectionName);
  }
}

// Pengaturan per user (Doc ID: uid)
export async function savePengaturan(config: Pengaturan) {
  const uid = requireUid();
  try {
    const docRef = doc(firestore, COLLECTIONS.PENGATURAN, uid);
    const payload = buildPengaturanPayload(config, uid);
    await setDoc(docRef, payload, { merge: true });
  } catch (err: any) {
    console.error("Error saving pengaturan:", err);
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.PENGATURAN}/${uid}`);
  }
}

export function subscribePengaturan(
  uid: string,
  callback: (config: Pengaturan | null, exists: boolean) => void,
  onError?: (err: Error) => void
) {
  const docRef = doc(firestore, COLLECTIONS.PENGATURAN, uid);
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as Pengaturan, true);
      } else {
        callback(null, false);
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `${COLLECTIONS.PENGATURAN}/${uid}`);
      } catch (wrappedErr: any) {
        if (onError) {
          onError(wrappedErr);
        } else {
          throw wrappedErr;
        }
      }
    }
  );
}

// Clear / Wipe All Collections Owned by Current User (Except Configuration)
export async function clearAllDatabaseCollections() {
  const uid = requireUid();
  localStorage.setItem(`edadmin_database_cleared_${uid}`, "true");

  try {
    const configDocRef = doc(firestore, COLLECTIONS.PENGATURAN, uid);
    const configSnap = await getDoc(configDocRef);
    if (configSnap.exists()) {
      await setDoc(
        configDocRef,
        { isDatabaseCleared: true, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } else {
      await setDoc(
        configDocRef,
        buildPengaturanPayload({ ...DEFAULT_CONFIG, isDatabaseCleared: true }, uid),
        { merge: true }
      );
    }
  } catch (err) {
    console.warn("Could not set isDatabaseCleared flag in pengaturan collection:", err);
  }

  const collectionsToClear = [
    COLLECTIONS.SISWA,
    COLLECTIONS.MAPEL,
    COLLECTIONS.JADWAL,
    COLLECTIONS.LOG_ABSENSI,
    COLLECTIONS.DATA_NILAI,
    COLLECTIONS.JURNAL_AGENDA,
    COLLECTIONS.SISWA_BIMBINGAN,
    COLLECTIONS.BIMBINGAN_WALI
  ];

  const errors: string[] = [];

  for (const colName of collectionsToClear) {
    try {
      const colQuery = query(collection(firestore, colName), where("ownerId", "==", uid));
      const snapshot = await getDocs(colQuery);
      if (!snapshot.empty) {
        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += 400) {
          const batch = writeBatch(firestore);
          const chunk = docs.slice(i, i + 400);
          chunk.forEach((docSnap) => {
            batch.delete(docSnap.ref);
          });
          await batch.commit();
        }
      }
    } catch (err: any) {
      console.error(`Error clearing collection ${colName}:`, err);
      errors.push(`${colName}: ${err?.message || err}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Sebagian koleksi gagal dihapus: ${errors.join(", ")}`);
  }
}
