/**
 * KONFIGURASI FIREBASE
 * =====================================================================
 * Ganti SELURUH isi objek firebaseConfig di bawah ini dengan konfigurasi
 * proyek Firebase Anda sendiri.
 *
 * Cara mendapatkannya (lihat juga README.md bagian "1. Buat Project Firebase"):
 *   1. Buka https://console.firebase.google.com
 *   2. Pilih project Anda → klik ikon gerigi (⚙) → "Project settings"
 *   3. Scroll ke bagian "Your apps" → pilih app web (ikon </>)
 *   4. Salin objek firebaseConfig yang muncul, tempel di bawah ini
 *
 * File ini SENGAJA dipisah dari app.js supaya gampang diganti tanpa
 * menyentuh logika aplikasi, dan supaya jelas bagian mana yang wajib
 * disesuaikan sebelum aplikasi bisa dipakai.
 * =====================================================================
 */
var firebaseConfig = {
  apiKey: "AIzaSyCSWWMHyp6olO1_iRfRsUlTBMViQ22wZ_0",
  authDomain: "rapor-mifa.firebaseapp.com",
  projectId: "rapor-mifa",
  storageBucket: "rapor-mifa.firebasestorage.app",
  messagingSenderId: "725135381820",
  appId: "1:725135381820:web:d67bcc1096e6d66018fa39"
};

// Penanda supaya app.js tahu apakah konfigurasi di atas sudah diisi atau belum.
var FIREBASE_CONFIGURED = firebaseConfig.apiKey.indexOf('GANTI_DENGAN') === -1;

if (FIREBASE_CONFIGURED) {
  firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  var db = firebase.firestore();
}
