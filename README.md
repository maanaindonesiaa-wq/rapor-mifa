# Rapor Akademi Futsal — Maana Indonesia Futsal Academy (MIFA)

Aplikasi rapor online berbasis HTML/CSS/JS, terhubung ke **Firebase**
(Authentication + Cloud Firestore) sehingga data admin, pelatih, siswa,
presensi, dan penilaian tersimpan di cloud dan tersinkron otomatis di
semua perangkat.

## Struktur folder

```
├── index.html              → halaman utama (jangan diubah namanya)
├── css/
│   └── style.css           → seluruh tampilan
├── js/
│   ├── firebase-config.js  → ⚠️ WAJIB DIISI dengan konfigurasi project Anda
│   ├── app.js               → logika aplikasi (auth, data, UI)
│   └── logo.js               → logo MIFA (tersimpan sebagai base64)
├── firestore.rules         → aturan keamanan Firestore, tempel ke Firebase Console
├── .gitignore
└── README.md                → dokumen ini
```

Tidak ada proses *build* — semua file dibuka langsung oleh browser.

---

## 1. Buat Project Firebase

1. Buka **https://console.firebase.google.com**, login dengan akun Google.
2. Klik **"Add project" / "Tambah project"**.
3. Beri nama, misalnya `mifa-rapor`. Boleh matikan Google Analytics
   (tidak dibutuhkan aplikasi ini) → klik **Create project**.

## 2. Daftarkan Web App & salin konfigurasi

1. Di halaman project, klik ikon **`</>`** ("Add app" → Web).
2. Beri nickname, misalnya `mifa-rapor-web` → **Register app**.
3. Firebase akan menampilkan blok kode berisi objek `firebaseConfig`
   seperti ini:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "mifa-rapor.firebaseapp.com",
     projectId: "mifa-rapor",
     storageBucket: "mifa-rapor.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```
4. Salin nilai-nilai tersebut, buka file **`js/firebase-config.js`** di
   proyek ini, dan ganti setiap `"GANTI_DENGAN_..."` dengan nilai yang
   sesuai. Simpan file.
5. Anda bisa lewati langkah "Firebase Hosting" yang ditawarkan di
   wizard tersebut (opsional, dibahas di bagian 8).

## 3. Aktifkan Authentication

1. Di sidebar kiri Firebase Console → **Build → Authentication** →
   **Get started**.
2. Tab **Sign-in method** → pilih **Email/Password** → aktifkan toggle
   pertama (Email/Password) → **Save**.

## 4. Aktifkan Cloud Firestore

1. Sidebar kiri → **Build → Firestore Database** → **Create database**.
2. Pilih lokasi server terdekat, misalnya `asia-southeast2 (Jakarta)`.
3. Pilih **Start in production mode** (rules akan kita ganti sendiri di
   langkah berikut, jadi mode awal tidak berpengaruh) → **Enable**.

## 5. Pasang Firestore Security Rules

1. Masih di Firestore Database → tab **Rules**.
2. Hapus semua isi kotak kode, lalu tempel seluruh isi file
   **`firestore.rules`** dari proyek ini.
3. Klik **Publish**.

Aturan ini yang membuat: admin bebas mengelola semua data, sedangkan
pelatih hanya bisa mengisi presensi & penilaian untuk siswa yang
memang ditugaskan kepadanya.

## 6. Buat akun Admin pertama

Akun pelatih nantinya dibuat otomatis lewat aplikasi (menu **Kelola
Pelatih**), tapi akun **admin pertama** perlu dibuat manual satu kali
lewat Console:

1. **Authentication → Users → Add user.** Isi email & kata sandi admin
   (contoh: `admin@mifa.id`) → **Add user**.
2. Setelah dibuat, salin **User UID** yang muncul di daftar user
   (klik user tersebut untuk melihat UID lengkap).
3. Buka **Firestore Database → Data → Start collection**.
   - Collection ID: `users`
   - Document ID: **tempel UID yang tadi disalin** (jangan pakai
     "Auto-ID")
   - Tambahkan field:
     | Field | Type    | Value                  |
     |-------|---------|------------------------|
     | nama  | string  | Nama admin, mis. `Admin MIFA` |
     | email | string  | email admin yang sama di atas |
     | role  | string  | `admin`                |
4. **Save.**

Login pertama kali menggunakan email & kata sandi admin tadi.

## 7. Menjalankan secara lokal (sebelum di-deploy)

Karena Firebase SDK butuh dijalankan lewat `http://`, jangan buka
`index.html` dengan cara *double click* (protokol `file://` bisa
bermasalah). Jalankan server lokal sederhana dari folder proyek:

```bash
# Python (biasanya sudah terpasang)
python3 -m http.server 8080

# atau Node.js
npx serve .
```

Lalu buka `http://localhost:8080` di browser.

## 8. Push ke GitHub

Karena repo Anda sudah siap, tinggal:

```bash
git add .
git commit -m "Integrasi Firebase: auth, Firestore, rapor cetak"
git push
```

### (Opsional) Publikasikan agar bisa diakses online

- **GitHub Pages** — Repo Settings → Pages → pilih branch → Save.
  Situs akan tersedia di `https://<username>.github.io/<repo>/`.
- **Firebase Hosting** — alternatif lain, perlu Firebase CLI
  (`npm install -g firebase-tools` → `firebase login` →
  `firebase init hosting` → `firebase deploy`).

Setelah online, cukup bagikan link tersebut ke pelatih — mereka tidak
perlu instalasi apa pun, cukup login lewat browser (HP maupun laptop).

---

## Alur pemakaian

- **Admin** login → *Kelola Pelatih* (buat akun pelatih baru: nama,
  email, kata sandi awal) → *Kelola Siswa* (biodata + foto 3×4 +
  regional + tugaskan ke pelatih) → *Cetak Rapor* (pilih siswa →
  cetak/simpan PDF).
- **Pelatih** login dengan email & kata sandi yang dibuatkan admin →
  hanya melihat siswa yang ditugaskan kepadanya → isi *Presensi* dan
  *Penilaian*.

Semua perubahan tersimpan otomatis ke Firestore dan langsung terlihat
di perangkat lain yang sedang login (real-time).

---

## Keterbatasan & catatan penting

- **Menghapus akun pelatih** dari menu *Kelola Pelatih* hanya menonaktifkan
  aksesnya di aplikasi (dokumen profilnya di Firestore dihapus). Akun
  login-nya di Firebase Authentication **tidak otomatis ikut terhapus**
  — hapus manual lewat *Authentication → Users* di Console bila perlu
  penghapusan permanen (ini keterbatasan bawaan karena aplikasi murni
  client-side, tanpa server/Cloud Functions).
- **Mengubah email pelatih** yang sudah ada tidak didukung dari
  aplikasi. Solusinya: nonaktifkan akun lama, buat akun baru dengan
  email baru. Untuk lupa kata sandi, gunakan tombol *"Kirim reset kata
  sandi"* di menu Kelola Pelatih, atau *"Lupa kata sandi?"* di halaman
  login.
- **Foto siswa** disimpan sebagai teks base64 langsung di dalam
  dokumen Firestore (dikompres otomatis oleh aplikasi ke lebar ±480px
  agar tetap kecil). Ini cukup untuk skala akademi biasa; jika suatu
  saat jumlah siswa & foto sangat besar, pertimbangkan migrasi ke
  **Firebase Storage** (bucket file terpisah) untuk skalabilitas lebih
  baik.
- Firestore Security Rules yang disertakan sudah cukup ketat untuk
  membedakan admin vs pelatih, tapi setiap pelatih yang sedang login
  masih bisa **membaca** data seluruh siswa (bukan hanya siswa
  asuhannya) — mereka hanya dibatasi agar tidak bisa **menulis** data
  siswa milik pelatih lain. Ini trade-off yang wajar untuk aplikasi
  seukuran akademi futsal; jika perlu dibatasi lebih ketat lagi
  (pelatih benar-benar tidak bisa membaca siswa lain), perlu penyesuaian
  lanjutan pada `firestore.rules` dan cara aplikasi melakukan query.
- Paket gratis Firebase (**Spark plan**) sudah lebih dari cukup untuk
  kebutuhan ini (Authentication & Firestore di skala kecil-menengah
  tidak dikenakan biaya).
