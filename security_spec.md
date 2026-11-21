# Firestore Security Specification

## 1. Data Invariants
1. **Strict Ownership**: Every document in `data_siswa`, `mapel`, `jadwal`, `log_absensi`, `data_nilai`, `jurnal_agenda`, `siswa_bimbingan`, and `bimbingan_wali` must carry an `ownerId` matching the authenticated creator's `request.auth.uid`, and `ownerId` is immutable after creation.
2. **User-Isolated Configuration**: Each teacher's `pengaturan` document is keyed by their own `{userId}` (`pengaturan/{userId}`), preventing cross-user reads or overwrites.
3. **Verified Authentication**: All read and write operations require an authenticated, email-verified user (`request.auth != null && request.auth.token.email_verified == true`).
4. **Strict Schema & Bounds**: Every document write (`create` and `update`) must pass a `isValid*` blueprint enforcing exact required/allowed keys (`hasAll` + `hasOnly`), string length bounds, numeric value bounds (`nilai` between 0 and 100 or `""`), valid attendance status enum (`Hadir`, `Izin`, `Sakit`, `Alpa`), and server timestamp (`updatedAt == request.time`).
5. **Path ID Hardening**: Document IDs on single-document operations must satisfy `^[a-zA-Z0-9_-]+$` and length `<= 128`.
6. **Secure List Queries**: `allow list` enforces `resource.data.ownerId == request.auth.uid` (or bootstrapped verified admin email) directly in rules without `get()`/`exists()` lookups.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated List (`data_siswa`)**: Anonymous/unauthenticated `list` on `/data_siswa` -> DENIED.
2. **Cross-Tenant Read (`data_siswa`)**: User B attempting `get` on User A's `/data_siswa/{id}` -> DENIED.
3. **Unfiltered List Query (`data_siswa`)**: User A querying `/data_siswa` without `where('ownerId', '==', userA.uid)` -> DENIED.
4. **Identity Spoofing on Create (`data_siswa`)**: User A creating a doc with `ownerId: userB.uid` -> DENIED.
5. **Owner Mutation on Update (`data_siswa`)**: User A updating `ownerId` to `userB.uid` -> DENIED.
6. **Shadow / Ghost Field Injection (`mapel`)**: Creating `/mapel/{id}` with extra field `isAdmin: true` -> DENIED (`hasOnly` check).
7. **Timestamp Forgery (`jadwal`)**: Creating `/jadwal/{id}` with client `updatedAt: 1700000000` instead of server timestamp `request.time` -> DENIED.
8. **Resource Exhaustion / 1MB String (`bimbingan_wali`)**: Writing `kasus` with 10,000+ characters (`> 2000`) -> DENIED.
9. **ID Poisoning (`data_siswa`)**: Creating doc with ID containing spaces, slashes, or length `> 128` -> DENIED (`isValidId`).
10. **Invalid Enum / Value Poisoning (`log_absensi`, `data_nilai`)**: Writing `status: "Bolos"` or `nilai: 999` -> DENIED.
11. **Unverified Email Admin Spoof**: Token with `email: "anugrahluput@gmail.com"` and `email_verified: false` -> DENIED.
12. **Cross-User Config Overwrite (`pengaturan`)**: User A writing `/pengaturan/{userB.uid}` -> DENIED.
