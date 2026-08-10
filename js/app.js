(function(){
"use strict";

/* ============================= CONFIG ============================= */
var CONFIG = { academyName: "Maana Indonesia Futsal Academy" };
document.getElementById('topbarBrandText').textContent = CONFIG.academyName;
['topbarLogo','loginLogo','setupLogo','loadingLogo'].forEach(function(id){
  var el = document.getElementById(id);
  if(el) el.src = LOGO_SRC;
});

var CORE_METRICS = [
  { key:'passing',   label:'Passing / Control', ref:'Acuan: kualitas umpan &amp; kontrol bola' },
  { key:'dribbling',  label:'Dribbling',         ref:'Acuan: penguasaan bola saat menggiring' },
  { key:'shooting',   label:'Shooting',          ref:'Acuan: akurasi &amp; kekuatan tendangan' },
  { key:'speed',      label:'Speed',             ref:'Acuan: Sprint 20 meter' },
  { key:'strength',   label:'Strength',          ref:'Acuan: Push Up 30 detik' },
  { key:'endurance',  label:'Endurance',         ref:'Acuan: Sprint 20 meter (repetisi)' },
  { key:'power',      label:'Power',             ref:'Acuan: Standing Board Jump' },
  { key:'agility',    label:'Agility',           ref:'Acuan: Illinois Run' }
];
var GK_METRICS = [
  { key:'gkReaksiDive',       label:'Reaksi Dive',        ref:'Acuan: kecepatan reaksi menjatuhkan diri' },
  { key:'gkReaksiSplit',      label:'Reaksi Split',       ref:'Acuan: kecepatan reaksi split save' },
  { key:'gkAkurasiLemparan',  label:'Akurasi Lemparan',   ref:'Acuan: ketepatan lemparan/distribusi bola' },
  { key:'gkKecepatanLangkah', label:'Kecepatan Langkah',  ref:'Acuan: footwork di area gawang' },
  { key:'gkTangkapan',        label:'Tangkapan',          ref:'Acuan: kemampuan menangkap/menepis bola' }
];

if(!FIREBASE_CONFIGURED){
  document.getElementById('screen-loading').style.display='none';
  document.getElementById('loginCard').style.display='none';
  document.getElementById('setupCard').style.display='block';
  return;
}

/* ============================= HELPERS ============================= */
function initials(name){ if(!name) return '?'; var p=name.trim().split(/\s+/); return ((p[0]||'')[0]||'')+((p[1]||'')[0]||''); }
function avatarHtml(student){ if(student && student.foto){ return '<img src="'+student.foto+'" alt="">'; } return '<span>'+initials(student?student.nama:'').toUpperCase()+'</span>'; }
function fmtDate(d){ if(!d) return '–'; var dt=new Date(d+'T00:00:00'); if(isNaN(dt)) return d; return dt.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); }
function ageFromTtl(ttl){ if(!ttl) return null; var dt=new Date(ttl+'T00:00:00'); if(isNaN(dt)) return null; return Math.floor((Date.now()-dt.getTime())/(365.25*24*3600*1000)); }
function flashMsg(id){ var el=document.getElementById(id); el.classList.add('show'); setTimeout(function(){ el.classList.remove('show'); }, 1800); }
function pad2(n){ return (n<10?'0':'')+n; }
function stat(val,label){ return '<div class="hero-stat"><b>'+val+'</b><span>'+label+'</span></div>'; }

var toastTimer = null;
function toast(msg, isError){
  var el = document.getElementById('appToast');
  if(!el){ el=document.createElement('div'); el.id='appToast'; el.className='toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = 'toast show' + (isError?' is-error':'');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.classList.remove('show'); }, 3800);
}

function mapAuthError(err){
  var code = err && err.code || '';
  var map = {
    'auth/invalid-email':'Format email tidak valid.',
    'auth/user-not-found':'Email atau kata sandi salah.',
    'auth/wrong-password':'Email atau kata sandi salah.',
    'auth/invalid-credential':'Email atau kata sandi salah.',
    'auth/too-many-requests':'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.',
    'auth/email-already-in-use':'Email ini sudah terdaftar.',
    'auth/weak-password':'Kata sandi minimal 6 karakter.',
    'auth/network-request-failed':'Gagal terhubung ke jaringan. Periksa koneksi internet Anda.'
  };
  return map[code] || (err && err.message) || 'Terjadi kesalahan, coba lagi.';
}

function compressImage(file, maxW, quality){
  return new Promise(function(resolve, reject){
    var reader = new FileReader();
    reader.onload = function(e){
      var img = new Image();
      img.onload = function(){
        var scale = Math.min(1, maxW / img.width);
        var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

var currentUser = null;
var studentsCache = [];
var pelatihCache = [];
var attendanceUnsub = null;
var studentsUnsub = null;
var pelatihUnsub = null;

/* ============================= AUTH / SESSION ============================= */
auth.onAuthStateChanged(function(user){
  document.getElementById('screen-loading').style.display = 'none';
  if(user){
    db.collection('users').doc(user.uid).get().then(function(doc){
      if(!doc.exists){
        toast('Akun ini belum terdaftar di sistem rapor. Hubungi admin akademi.', true);
        auth.signOut();
        return;
      }
      var profile = doc.data();
      currentUser = { uid:user.uid, email:user.email, nama:profile.nama, role:profile.role };
      boot(currentUser);
    }).catch(function(err){
      toast('Gagal memuat profil akun: '+mapAuthError(err), true);
      auth.signOut();
    });
  } else {
    currentUser = null;
    if(studentsUnsub){ studentsUnsub(); studentsUnsub=null; }
    if(pelatihUnsub){ pelatihUnsub(); pelatihUnsub=null; }
    if(attendanceUnsub){ attendanceUnsub(); attendanceUnsub=null; }
    showLogin();
  }
});

function showLogin(){
  document.getElementById('app').style.display='none';
  document.getElementById('screen-login').style.display='flex';
  document.getElementById('loginCard').style.display='block';
  document.getElementById('setupCard').style.display='none';
}

document.getElementById('loginBtn').addEventListener('click', function(){
  var email = document.getElementById('loginEmail').value.trim();
  var pass = document.getElementById('loginPass').value;
  var errEl = document.getElementById('loginError');
  var btn = document.getElementById('loginBtn');
  if(!email || !pass){ errEl.textContent='Email dan kata sandi wajib diisi.'; errEl.classList.add('show'); return; }
  errEl.textContent=''; errEl.classList.remove('show');
  btn.classList.add('is-loading'); btn.textContent='Memproses…';
  auth.signInWithEmailAndPassword(email, pass).catch(function(err){
    errEl.textContent = mapAuthError(err);
    errEl.classList.add('show');
  }).finally(function(){
    btn.classList.remove('is-loading'); btn.textContent='Masuk →';
  });
});
document.getElementById('loginPass').addEventListener('keydown', function(e){ if(e.key==='Enter') document.getElementById('loginBtn').click(); });

document.getElementById('forgotPass').addEventListener('click', function(){
  var email = document.getElementById('loginEmail').value.trim();
  var errEl = document.getElementById('loginError');
  if(!email){ errEl.textContent='Isi email terlebih dahulu, lalu klik "Lupa kata sandi?" lagi.'; errEl.classList.add('show'); return; }
  auth.sendPasswordResetEmail(email).then(function(){
    errEl.classList.remove('show');
    toast('Tautan reset kata sandi telah dikirim ke '+email);
  }).catch(function(err){ errEl.textContent = mapAuthError(err); errEl.classList.add('show'); });
});

document.getElementById('logoutBtn').addEventListener('click', function(){ auth.signOut(); });

/* Secondary Firebase app instance so admin can create a pelatih account
   without being signed out of their own admin session. */
function createPelatihAccount(nama, email, password){
  var secondaryApp = firebase.initializeApp(firebaseConfig, 'Secondary_'+Date.now());
  var secAuth = secondaryApp.auth();
  var secDb = secondaryApp.firestore();
  return secAuth.createUserWithEmailAndPassword(email, password).then(function(cred){
    var uid = cred.user.uid;
    return secDb.collection('users').doc(uid).set({
      nama: nama, email: email, role: 'pelatih',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(){ return secAuth.signOut(); })
      .then(function(){ return secondaryApp.delete(); })
      .then(function(){ return uid; });
  }).catch(function(err){
    return secondaryApp.delete().then(function(){ throw err; }, function(){ throw err; });
  });
}

/* ============================= NAV / SCROLL ============================= */
var track = document.getElementById('track');
var progressBar = document.getElementById('progressBar');
var SLIDE_LABELS = {
  'slide-beranda':'Beranda', 'slide-pelatih':'Kelola Pelatih', 'slide-siswa':'Kelola Siswa',
  'slide-cetak':'Cetak Rapor', 'slide-presensi':'Presensi', 'slide-penilaian':'Penilaian'
};
function visibleSlides(){
  return Array.prototype.slice.call(document.querySelectorAll('.slide')).filter(function(s){ return s.style.display!=='none'; });
}
function goTo(id){ var el=document.getElementById(id); if(el) el.scrollIntoView({ behavior:'smooth', inline:'start', block:'start' }); }

function buildNav(role){
  var order = role==='admin'
    ? ['slide-beranda','slide-pelatih','slide-siswa','slide-cetak']
    : ['slide-beranda','slide-presensi','slide-penilaian'];
  var allIds = Object.keys(SLIDE_LABELS);
  allIds.forEach(function(id){ document.getElementById(id).style.display = order.indexOf(id)>-1 ? 'block' : 'none'; });
  var slideNav = document.getElementById('slideNav');
  slideNav.innerHTML = order.map(function(id,i){
    return '<button data-target="'+id+'" class="'+(i===0?'active':'')+'"><span class="slide-nav__num">'+pad2(i+1)+' · '+SLIDE_LABELS[id]+'</span><span class="slide-nav__dot"></span></button>';
  }).join('');
  slideNav.querySelectorAll('button').forEach(function(b){ b.addEventListener('click', function(){ goTo(b.getAttribute('data-target')); }); });
  track.scrollLeft = 0;
  updateNavActive();
}
function updateNavActive(){
  var vs = visibleSlides();
  var idx = Math.round(track.scrollLeft / window.innerWidth);
  if(idx<0) idx=0; if(idx>vs.length-1) idx=vs.length-1;
  document.querySelectorAll('#slideNav button').forEach(function(b,i){ b.classList.toggle('active', i===idx); });
  progressBar.style.width = (((idx+1)/vs.length)*100)+'%';
}
track.addEventListener('scroll', function(){ requestAnimationFrame(updateNavActive); });
track.addEventListener('wheel', function(e){
  if(Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
  var slide = e.target.closest('.slide');
  if(slide){
    var canDown = e.deltaY>0 && (slide.scrollTop+slide.clientHeight < slide.scrollHeight-2);
    var canUp = e.deltaY<0 && slide.scrollTop>2;
    if(canDown || canUp) return;
  }
  e.preventDefault(); track.scrollLeft += e.deltaY;
}, { passive:false });
document.addEventListener('keydown', function(e){
  if(document.getElementById('app').style.display==='none') return;
  var vs = visibleSlides();
  var idx = Math.round(track.scrollLeft / window.innerWidth);
  if(e.key==='ArrowRight' && idx<vs.length-1) goTo(vs[idx+1].id);
  if(e.key==='ArrowLeft' && idx>0) goTo(vs[idx-1].id);
});
window.addEventListener('resize', updateNavActive);

/* ============================= BOOT ============================= */
function boot(user){
  document.getElementById('screen-login').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('userName').textContent = user.nama;
  var rb = document.getElementById('roleBadge');
  rb.textContent = user.role==='admin' ? 'Admin' : 'Pelatih';
  rb.className = 'badge ' + (user.role==='admin' ? 'role-admin' : 'role-pelatih');

  buildNav(user.role);

  if(studentsUnsub) studentsUnsub();
  studentsUnsub = db.collection('students').orderBy('nama').onSnapshot(function(snap){
    studentsCache = snap.docs.map(function(d){ var o=d.data(); o.id=d.id; return o; });
    onStudentsChanged();
  }, function(err){ toast('Gagal memuat data siswa: '+mapAuthError(err), true); });

  if(user.role==='admin'){
    if(pelatihUnsub) pelatihUnsub();
    pelatihUnsub = db.collection('users').where('role','==','pelatih').onSnapshot(function(snap){
      pelatihCache = snap.docs.map(function(d){ var o=d.data(); o.id=d.id; return o; });
      renderPelatihList(); populatePelatihSelectInForm(); renderRoster(); renderBeranda();
    }, function(err){ toast('Gagal memuat data pelatih: '+mapAuthError(err), true); });
    renderCetak();
  } else {
    renderPelatihWorkspace();
  }
  renderBeranda();
}

function onStudentsChanged(){
  if(!currentUser) return;
  if(currentUser.role==='admin'){
    renderRoster(); renderCetak(); populatePelatihSelectInForm();
  } else {
    renderPelatihWorkspace();
  }
  renderBeranda();
}

/* ============================= BERANDA ============================= */
function activeKey(){ return 'ffa_active_' + currentUser.uid; }
function getActiveId(){ return localStorage.getItem(activeKey()) || ''; }
function setActiveId(id){ localStorage.setItem(activeKey(), id); }

function renderBeranda(){
  if(!currentUser) return;
  if(currentUser.role==='admin'){ renderBerandaAdmin(); } else { renderBerandaPelatih(); }
}

function renderBerandaAdmin(){
  var students = studentsCache;
  var pelatihCount = pelatihCache.length;
  document.getElementById('berandaEyebrow').textContent = 'Panel Admin';
  document.getElementById('berandaTitle').textContent = 'Selamat datang, ' + currentUser.nama;
  document.getElementById('berandaDesc').textContent = 'Kelola akun pelatih, data siswa, dan cetak rapor akademi dari satu tempat.';
  document.getElementById('berandaCta').textContent = 'Kelola Siswa →';
  document.getElementById('berandaCta').onclick = function(){ goTo('slide-siswa'); };

  var surabayaCount = students.filter(function(s){ return s.regional==='Kota Surabaya'; }).length;
  var sidoarjoCount = students.filter(function(s){ return s.regional==='Kab. Sidoarjo'; }).length;

  document.getElementById('berandaStats').innerHTML =
    stat(students.length,'Siswa Terdaftar') + stat(pelatihCount,'Akun Pelatih') +
    stat('…','Rata-rata Kehadiran') + stat('…','Rata-rata Penilaian') +
    stat(surabayaCount,'Regional Kota Surabaya') + stat(sidoarjoCount,'Regional Kab. Sidoarjo');

  computeAggregateStats(students).then(function(agg){
    document.getElementById('berandaStats').innerHTML =
      stat(students.length,'Siswa Terdaftar') + stat(pelatihCount,'Akun Pelatih') +
      stat(agg.pct, 'Rata-rata Kehadiran') + stat(agg.avgNilai,'Rata-rata Penilaian') +
      stat(surabayaCount,'Regional Kota Surabaya') + stat(sidoarjoCount,'Regional Kab. Sidoarjo');
  });
}

function renderBerandaPelatih(){
  var mine = studentsCache.filter(function(s){ return s.pelatihId===currentUser.uid; });
  document.getElementById('berandaEyebrow').textContent = 'Panel Pelatih';
  document.getElementById('berandaTitle').textContent = 'Selamat datang, ' + currentUser.nama;
  document.getElementById('berandaDesc').textContent = 'Isi presensi dan penilaian untuk siswa yang Anda ampu.';
  document.getElementById('berandaCta').textContent = 'Isi Presensi →';
  document.getElementById('berandaCta').onclick = function(){ goTo('slide-presensi'); };

  document.getElementById('berandaStats').innerHTML =
    stat(mine.length,'Siswa Diampu') + stat('…','Rata-rata Kehadiran') + stat('…','Sesi Tercatat') + stat('…','Rata-rata Penilaian');

  computeAggregateStats(mine).then(function(agg){
    document.getElementById('berandaStats').innerHTML =
      stat(mine.length,'Siswa Diampu') + stat(agg.pct,'Rata-rata Kehadiran') + stat(agg.totalSesi,'Sesi Tercatat') + stat(agg.avgNilai,'Rata-rata Penilaian');
  });
}

function computeAggregateStats(students){
  if(!students.length) return Promise.resolve({ pct:'–', avgNilai:'–', totalSesi:0 });
  var attPromises = students.map(function(s){ return db.collection('students').doc(s.id).collection('attendance').get(); });
  var asmPromises = students.map(function(s){ return db.collection('assessments').doc(s.id).get(); });
  return Promise.all([Promise.all(attPromises), Promise.all(asmPromises)]).then(function(results){
    var attSnaps = results[0], asmSnaps = results[1];
    var totalSesi=0, totalHadir=0;
    attSnaps.forEach(function(snap){
      snap.forEach(function(doc){ totalSesi++; if(doc.data().status==='Hadir') totalHadir++; });
    });
    var avgs = [];
    asmSnaps.forEach(function(doc, i){
      if(!doc.exists) return;
      var a = doc.data(); var st = students[i];
      var keys = CORE_METRICS.map(function(m){ return m.key; });
      if(st.posisi==='Kiper'){ keys = keys.concat(GK_METRICS.map(function(m){ return m.key; })); }
      var vals = keys.map(function(k){ return a[k]||0; });
      avgs.push(vals.reduce(function(x,y){return x+y;},0)/vals.length);
    });
    return {
      pct: totalSesi ? Math.round(totalHadir/totalSesi*100)+'%' : '–',
      avgNilai: avgs.length ? Math.round(avgs.reduce(function(a,b){return a+b;},0)/avgs.length) : '–',
      totalSesi: totalSesi
    };
  }).catch(function(){ return { pct:'–', avgNilai:'–', totalSesi:0 }; });
}

/* ============================= ADMIN: KELOLA PELATIH ============================= */
var editingPelatihId = null;
function clearPelatihForm(){
  editingPelatihId = null;
  document.getElementById('pfNama').value=''; document.getElementById('pfEmail').value=''; document.getElementById('pfPassword').value='';
  document.getElementById('pfEmail').disabled=false; document.getElementById('pfPassword').disabled=false;
  document.getElementById('pfPassword').placeholder='Minimal 6 karakter';
  document.getElementById('pfEditNote').style.display='none';
  document.getElementById('savePelatih').textContent='Simpan';
}
document.getElementById('clearPelatihForm').addEventListener('click', clearPelatihForm);

document.getElementById('savePelatih').addEventListener('click', function(){
  var nama = document.getElementById('pfNama').value.trim();
  var email = document.getElementById('pfEmail').value.trim();
  var pass = document.getElementById('pfPassword').value;
  var btn = document.getElementById('savePelatih');

  if(editingPelatihId){
    if(!nama){ toast('Nama pelatih wajib diisi.', true); return; }
    btn.classList.add('is-loading');
    db.collection('users').doc(editingPelatihId).update({ nama:nama }).then(function(){
      flashMsg('pelatihMsg'); clearPelatihForm();
    }).catch(function(err){ toast('Gagal menyimpan: '+mapAuthError(err), true); })
      .finally(function(){ btn.classList.remove('is-loading'); });
    return;
  }

  if(!nama || !email || pass.length<6){ toast('Lengkapi nama, email, dan kata sandi (minimal 6 karakter).', true); return; }
  btn.classList.add('is-loading'); btn.textContent='Membuat akun…';
  createPelatihAccount(nama, email, pass).then(function(){
    flashMsg('pelatihMsg'); clearPelatihForm();
  }).catch(function(err){
    toast('Gagal membuat akun pelatih: '+mapAuthError(err), true);
  }).finally(function(){
    btn.classList.remove('is-loading'); btn.textContent='Simpan';
  });
});

function deactivatePelatih(p){
  if(!confirm('Nonaktifkan akun pelatih "'+p.nama+'"? Siswa yang diampu akan menjadi belum ditugaskan. Akun login (Firebase Authentication) tetap ada dan bisa dihapus permanen lewat Firebase Console bila perlu.')) return;
  db.collection('users').doc(p.id).delete().then(function(){
    return db.collection('students').where('pelatihId','==',p.id).get();
  }).then(function(snap){
    var batch = db.batch();
    snap.forEach(function(doc){ batch.update(doc.ref, { pelatihId:'' }); });
    return batch.commit();
  }).then(function(){
    toast('Akun pelatih dinonaktifkan.');
  }).catch(function(err){ toast('Gagal menonaktifkan akun: '+mapAuthError(err), true); });
}

function resetPelatihPassword(p){
  auth.sendPasswordResetEmail(p.email).then(function(){
    toast('Tautan reset kata sandi terkirim ke '+p.email);
  }).catch(function(err){ toast('Gagal mengirim tautan reset: '+mapAuthError(err), true); });
}

function renderPelatihList(){
  var wrap = document.getElementById('pelatihList');
  if(!pelatihCache.length){ wrap.innerHTML = '<div class="empty-roster">Belum ada akun pelatih. Tambahkan melalui formulir di atas.</div>'; return; }
  wrap.innerHTML = pelatihCache.map(function(p){
    var count = studentsCache.filter(function(s){ return s.pelatihId===p.id; }).length;
    return '<div class="pelatih-row">'+
      '<div class="pelatih-row__avatar">'+initials(p.nama).toUpperCase()+'</div>'+
      '<div class="pelatih-row__meta"><b>'+p.nama+'</b><span>'+p.email+' · '+count+' siswa diampu</span></div>'+
      '<div class="pelatih-row__actions">'+
        '<button class="icon-btn" data-reset="'+p.id+'" title="Kirim reset kata sandi"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 1 1 2.34 5.66M4 12v5h5" stroke="currentColor" stroke-width="1.6"/></svg></button>'+
        '<button class="icon-btn" data-edit="'+p.id+'" title="Sunting nama"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" stroke="currentColor" stroke-width="1.6"/></svg></button>'+
        '<button class="icon-btn" data-del="'+p.id+'" title="Nonaktifkan"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 13a1 1 0 001 1h6a1 1 0 001-1l1-13" stroke="currentColor" stroke-width="1.6"/></svg></button>'+
      '</div></div>';
  }).join('');
  wrap.querySelectorAll('[data-reset]').forEach(function(b){
    b.addEventListener('click', function(){ var p=pelatihCache.find(function(u){return u.id===b.getAttribute('data-reset');}); if(p) resetPelatihPassword(p); });
  });
  wrap.querySelectorAll('[data-edit]').forEach(function(b){
    b.addEventListener('click', function(){
      var p = pelatihCache.find(function(u){ return u.id===b.getAttribute('data-edit'); }); if(!p) return;
      editingPelatihId=p.id;
      document.getElementById('pfNama').value=p.nama;
      document.getElementById('pfEmail').value=p.email;
      document.getElementById('pfEmail').disabled=true;
      document.getElementById('pfPassword').value=''; document.getElementById('pfPassword').disabled=true;
      document.getElementById('pfPassword').placeholder='(tidak dapat diubah di sini)';
      document.getElementById('pfEditNote').style.display='block';
      document.getElementById('savePelatih').textContent='Simpan Perubahan Nama';
      goTo('slide-pelatih');
    });
  });
  wrap.querySelectorAll('[data-del]').forEach(function(b){
    b.addEventListener('click', function(){ var p=pelatihCache.find(function(u){return u.id===b.getAttribute('data-del');}); if(p) deactivatePelatih(p); });
  });
}

function populatePelatihSelectInForm(){
  var sel = document.getElementById('fPelatih');
  var current = sel.value;
  sel.innerHTML = '<option value="">— Belum ditugaskan —</option>' + pelatihCache.map(function(p){
    return '<option value="'+p.id+'">'+p.nama+'</option>';
  }).join('');
  if(current) sel.value = current;
}

/* ============================= ADMIN: KELOLA SISWA (biodata) ============================= */
var editingId = null;
var photoData = '';
var fNama=document.getElementById('fNama'), fPunggung=document.getElementById('fPunggung'),
    fTtl=document.getElementById('fTtl'), fPosisi=document.getElementById('fPosisi'),
    fKelompok=document.getElementById('fKelompok'), fJoin=document.getElementById('fJoin'),
    fWali=document.getElementById('fWali'), fKontak=document.getElementById('fKontak'),
    fCatatan=document.getElementById('fCatatan'), fPelatih=document.getElementById('fPelatih'),
    fRegional=document.getElementById('fRegional');

document.getElementById('photoFrame').addEventListener('click', function(){ document.getElementById('photoInput').click(); });
document.getElementById('photoInput').addEventListener('change', function(e){
  var file=e.target.files[0]; if(!file) return;
  compressImage(file, 480, 0.85).then(function(dataUrl){
    photoData=dataUrl;
    document.getElementById('photoPreview').src=photoData; document.getElementById('photoPreview').style.display='block';
    document.getElementById('photoEmpty').style.display='none';
  }).catch(function(){ toast('Gagal memproses foto. Coba file gambar lain.', true); });
});

function resetForm(){
  editingId=null; photoData='';
  fNama.value=''; fPunggung.value=''; fTtl.value=''; fPosisi.value='Pemain'; fKelompok.value='';
  fJoin.value=''; fWali.value=''; fKontak.value=''; fCatatan.value=''; fPelatih.value=''; fRegional.value='Kota Surabaya';
  document.getElementById('photoPreview').style.display='none'; document.getElementById('photoEmpty').style.display='flex';
}
document.getElementById('clearForm').addEventListener('click', resetForm);

function fillForm(s){
  editingId=s.id; photoData=s.foto||'';
  fNama.value=s.nama||''; fPunggung.value=s.punggung||''; fTtl.value=s.ttl||''; fPosisi.value=s.posisi||'Pemain';
  fKelompok.value=s.kelompok||''; fJoin.value=s.join||''; fWali.value=s.wali||''; fKontak.value=s.kontak||'';
  fCatatan.value=s.catatan||''; fPelatih.value=s.pelatihId||''; fRegional.value=s.regional||'Kota Surabaya';
  if(photoData){ document.getElementById('photoPreview').src=photoData; document.getElementById('photoPreview').style.display='block'; document.getElementById('photoEmpty').style.display='none'; }
  else{ document.getElementById('photoPreview').style.display='none'; document.getElementById('photoEmpty').style.display='flex'; }
}

document.getElementById('saveStudent').addEventListener('click', function(){
  if(!fNama.value.trim()){ fNama.focus(); return; }
  var btn = document.getElementById('saveStudent');
  var data={ nama:fNama.value.trim(), punggung:fPunggung.value, ttl:fTtl.value, posisi:fPosisi.value,
    kelompok:fKelompok.value.trim(), regional:fRegional.value, join:fJoin.value, wali:fWali.value.trim(), kontak:fKontak.value.trim(),
    catatan:fCatatan.value.trim(), foto:photoData, pelatihId:fPelatih.value,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  var ref = editingId ? db.collection('students').doc(editingId) : db.collection('students').doc();
  if(!editingId) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  btn.classList.add('is-loading');
  ref.set(data, { merge:true }).then(function(){
    editingId = ref.id;
    flashMsg('biodataMsg');
  }).catch(function(err){ toast('Gagal menyimpan data siswa: '+mapAuthError(err), true); })
    .finally(function(){ btn.classList.remove('is-loading'); });
});

function deleteStudent(id){
  if(!confirm('Hapus siswa ini beserta seluruh data presensi & penilaiannya?')) return;
  db.collection('students').doc(id).collection('attendance').get().then(function(snap){
    var batch = db.batch();
    snap.forEach(function(doc){ batch.delete(doc.ref); });
    batch.delete(db.collection('students').doc(id));
    batch.delete(db.collection('assessments').doc(id));
    return batch.commit();
  }).then(function(){
    if(editingId===id) resetForm();
    toast('Siswa dihapus.');
  }).catch(function(err){ toast('Gagal menghapus siswa: '+mapAuthError(err), true); });
}

function renderRoster(){
  var all = studentsCache;
  var filterVal = document.getElementById('rosterFilter').value;
  var students = filterVal ? all.filter(function(s){ return s.regional===filterVal; }) : all;
  var wrap=document.getElementById('roster');
  document.getElementById('rosterCount').textContent = students.length+' siswa'+(filterVal?(' · '+filterVal):'');
  if(!all.length){ wrap.innerHTML='<div class="empty-roster">Belum ada siswa. Isi formulir di atas untuk menambahkan siswa pertama.</div>'; return; }
  if(!students.length){ wrap.innerHTML='<div class="empty-roster">Tidak ada siswa pada regional ini.</div>'; return; }
  wrap.innerHTML = students.map(function(s){
    var isGk=s.posisi==='Kiper';
    var coach = pelatihCache.find(function(p){return p.id===s.pelatihId;});
    var regClass = s.regional==='Kab. Sidoarjo' ? 'reg-sidoarjo' : '';
    return '<div class="player-card" data-id="'+s.id+'">'+
      '<div class="player-card__actions">'+
        '<button class="icon-btn" data-edit="'+s.id+'" title="Sunting"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" stroke="currentColor" stroke-width="1.6"/></svg></button>'+
        '<button class="icon-btn" data-del="'+s.id+'" title="Hapus"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 13a1 1 0 001 1h6a1 1 0 001-1l1-13" stroke="currentColor" stroke-width="1.6"/></svg></button>'+
      '</div>'+
      '<div class="player-card__photo">'+avatarHtml(s)+'<div class="player-card__num">'+(s.punggung||'–')+'</div></div>'+
      '<div class="player-card__name">'+s.nama+'</div>'+
      '<div class="player-card__pos '+(isGk?'is-gk':'')+'">'+(isGk?'Kiper':'Pemain Lapangan')+(s.kelompok?(' · '+s.kelompok):'')+'</div>'+
      '<div class="player-card__coach">'+(coach?('Pelatih: '+coach.nama):'Belum ditugaskan')+'</div>'+
      '<span class="player-card__regional '+regClass+'">'+(s.regional||'–')+'</span>'+
    '</div>';
  }).join('');
  wrap.querySelectorAll('[data-edit]').forEach(function(b){ b.addEventListener('click', function(ev){ ev.stopPropagation(); var s=studentsCache.find(function(x){return x.id===b.getAttribute('data-edit');}); if(s) fillForm(s); }); });
  wrap.querySelectorAll('[data-del]').forEach(function(b){ b.addEventListener('click', function(ev){ ev.stopPropagation(); deleteStudent(b.getAttribute('data-del')); }); });
  wrap.querySelectorAll('.player-card').forEach(function(card){ card.addEventListener('click', function(){ var s=studentsCache.find(function(x){return x.id===card.getAttribute('data-id');}); if(s) fillForm(s); }); });
}
document.getElementById('rosterFilter').addEventListener('change', renderRoster);

/* ============================= ADMIN: CETAK RAPOR ============================= */
function renderCetak(){
  var students = studentsCache;
  document.getElementById('cetakEmpty').style.display = students.length? 'none':'block';
  document.getElementById('cetakContent').style.display = students.length? 'block':'none';
  if(!students.length) return;
  var sel=document.getElementById('cSelect');
  var current = sel.value && students.find(function(s){return s.id===sel.value;}) ? sel.value : students[0].id;
  var regions = ['Kota Surabaya','Kab. Sidoarjo'];
  var rest = students.filter(function(s){ return regions.indexOf(s.regional)===-1; });
  var groups = regions.map(function(r){
    var list = students.filter(function(s){ return s.regional===r; });
    if(!list.length) return '';
    return '<optgroup label="'+r+'">'+list.map(function(s){
      return '<option value="'+s.id+'" '+(s.id===current?'selected':'')+'>'+s.nama+'</option>';
    }).join('')+'</optgroup>';
  }).join('');
  if(rest.length){
    groups += '<optgroup label="Belum Ditentukan">'+rest.map(function(s){
      return '<option value="'+s.id+'" '+(s.id===current?'selected':'')+'>'+s.nama+'</option>';
    }).join('')+'</optgroup>';
  }
  sel.innerHTML = groups;
  renderCetakPreview(current);
}
document.getElementById('cSelect').addEventListener('change', function(){ renderCetakPreview(this.value); });

function studentSummary(studentId){
  var s = studentsCache.find(function(x){ return x.id===studentId; });
  if(!s) return Promise.resolve(null);
  return Promise.all([
    db.collection('students').doc(studentId).collection('attendance').get(),
    db.collection('assessments').doc(studentId).get()
  ]).then(function(results){
    var attSnap = results[0], asmDoc = results[1];
    var att = attSnap.docs.map(function(d){ return d.data(); });
    var asm = asmDoc.exists ? asmDoc.data() : {};
    var coach = pelatihCache.find(function(p){ return p.id===s.pelatihId; });
    var counts={Hadir:0,Izin:0,Sakit:0,Alpa:0};
    att.forEach(function(a){ counts[a.status]=(counts[a.status]||0)+1; });
    var total=att.length;
    var pct = total? Math.round(counts.Hadir/total*100):0;
    var isGk = s.posisi==='Kiper';
    var metrics = CORE_METRICS.concat(isGk?GK_METRICS:[]);
    var vals = metrics.map(function(m){ return asm[m.key]||0; });
    var avg = vals.length? Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length):0;
    var grade = avg>=85?{l:'A',t:'Sangat Baik'}:avg>=70?{l:'B',t:'Baik'}:avg>=55?{l:'C',t:'Cukup'}:{l:'D',t:'Perlu Latihan'};
    return { student:s, coach:coach, counts:counts, total:total, pct:pct, assessment:asm, metrics:metrics, avg:avg, grade:grade };
  });
}

function renderCetakPreview(studentId){
  document.getElementById('cBio').innerHTML = '<dt>Memuat…</dt>';
  studentSummary(studentId).then(function(d){
    if(!d) return;
    var s=d.student;
    document.getElementById('cPhoto').innerHTML = s.foto ? '<img src="'+s.foto+'">' : initials(s.nama).toUpperCase();
    document.getElementById('cBio').innerHTML =
      '<dt>Nama</dt><dd>'+s.nama+'</dd><dt>No. Punggung</dt><dd>'+(s.punggung||'–')+'</dd>'+
      '<dt>Posisi</dt><dd>'+(s.posisi==='Kiper'?'Kiper':'Pemain Lapangan')+'</dd><dt>Kelompok</dt><dd>'+(s.kelompok||'–')+'</dd>'+
      '<dt>Regional</dt><dd>'+(s.regional||'–')+'</dd><dt>Tanggal Lahir</dt><dd>'+fmtDate(s.ttl)+'</dd>'+
      '<dt>Bergabung</dt><dd>'+fmtDate(s.join)+'</dd><dt>Wali</dt><dd>'+(s.wali||'–')+'</dd>'+
      '<dt>Pelatih</dt><dd>'+(d.coach?d.coach.nama:'Belum ditugaskan')+'</dd>';
    document.getElementById('cAttend').innerHTML =
      '<span class="pill"><i style="background:#2E7D46"></i>Hadir '+d.counts.Hadir+'</span>'+
      '<span class="pill"><i style="background:#C98A00"></i>Izin '+d.counts.Izin+'</span>'+
      '<span class="pill"><i style="background:#7A1F00"></i>Sakit '+d.counts.Sakit+'</span>'+
      '<span class="pill"><i style="background:#C43B2F"></i>Alpa '+d.counts.Alpa+'</span>'+
      '<span class="pill">Persentase hadir '+d.pct+'%</span>';
    document.getElementById('cNilai').innerHTML = d.metrics.map(function(m){
      return '<tr><td>'+m.label+'</td><td>'+(d.assessment[m.key]||0)+'</td></tr>';
    }).join('');
    document.getElementById('cGrade').innerHTML = 'Rata-rata: <b>'+d.avg+'/100</b> · Predikat: <b>'+d.grade.l+' — '+d.grade.t+'</b>';
  }).catch(function(err){ toast('Gagal memuat pratinjau rapor: '+mapAuthError(err), true); });
}

document.getElementById('cetakBtn').addEventListener('click', function(){
  var studentId = document.getElementById('cSelect').value;
  var btn = document.getElementById('cetakBtn');
  btn.classList.add('is-loading');
  studentSummary(studentId).then(function(d){
    if(!d) return;
    var s=d.student;
    var html =
      '<div class="ps-head"><div><h1>RAPOR SISWA</h1><p>'+CONFIG.academyName+' · Regional '+(s.regional||'–')+' · Dicetak '+new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})+'</p></div></div>'+
      '<div class="ps-body">'+
        (s.foto ? '<img class="ps-photo" src="'+s.foto+'">' : '<div class="ps-photo-empty">Tanpa Foto</div>')+
        '<div><dl class="ps-bio">'+
          '<dt>Nama</dt><dd>'+s.nama+'</dd><dt>No. Punggung</dt><dd>'+(s.punggung||'–')+'</dd>'+
          '<dt>Posisi</dt><dd>'+(s.posisi==='Kiper'?'Kiper':'Pemain Lapangan')+'</dd><dt>Kelompok Usia</dt><dd>'+(s.kelompok||'–')+'</dd>'+
          '<dt>Regional</dt><dd>'+(s.regional||'–')+'</dd><dt>Tanggal Lahir</dt><dd>'+fmtDate(s.ttl)+'</dd>'+
          '<dt>Tanggal Bergabung</dt><dd>'+fmtDate(s.join)+'</dd><dt>Wali/Orang Tua</dt><dd>'+(s.wali||'–')+'</dd>'+
          '<dt>Pelatih Pengampu</dt><dd>'+(d.coach?d.coach.nama:'–')+'</dd>'+
        '</dl></div>'+
      '</div>'+
      '<div class="ps-section-title">Rekap Presensi ('+d.total+' sesi tercatat)</div>'+
      '<table class="ps-table"><thead><tr><th>Hadir</th><th>Izin</th><th>Sakit</th><th>Alpa</th><th>% Kehadiran</th></tr></thead>'+
      '<tbody><tr><td>'+d.counts.Hadir+'</td><td>'+d.counts.Izin+'</td><td>'+d.counts.Sakit+'</td><td>'+d.counts.Alpa+'</td><td>'+d.pct+'%</td></tr></tbody></table>'+
      '<div class="ps-section-title">Penilaian Teknik &amp; Fisik</div>'+
      '<table class="ps-table"><thead><tr><th>Aspek</th><th>Nilai (0–100)</th></tr></thead><tbody>'+
        d.metrics.map(function(m){ return '<tr><td>'+m.label+'</td><td>'+(d.assessment[m.key]||0)+'</td></tr>'; }).join('')+
      '</tbody></table>'+
      '<p style="margin-top:14px;font-family:\'IBM Plex Mono\',monospace;font-size:12px">Rata-rata Nilai: <span class="ps-grade">'+d.grade.l+'</span> ('+d.avg+'/100 — '+d.grade.t+')</p>'+
      '<div class="ps-section-title">Catatan Pelatih</div>'+
      '<p style="font-size:12px;line-height:1.6">'+(d.assessment.catatan ? d.assessment.catatan : '–')+'</p>'+
      '<div class="ps-sign">'+
        '<div><div class="line">Adv. M. Anas Amrullah, S.H., CBPIR., CGR.</div></div>'+
        '<div><div class="line">Coach<br>'+(d.coach?d.coach.nama:'–')+'</div></div>'+
        '<div><div class="line">Orang Tua / Wali</div></div>'+
      '</div>';
    document.getElementById('printSheet').innerHTML = html;
    window.print();
  }).catch(function(err){ toast('Gagal menyiapkan rapor cetak: '+mapAuthError(err), true); })
    .finally(function(){ btn.classList.remove('is-loading'); });
});

/* ============================= PELATIH WORKSPACE ============================= */
function myStudents(){ return studentsCache.filter(function(s){ return s.pelatihId===currentUser.uid; }); }
function populateSelect(sel, students, activeId){
  sel.innerHTML = students.map(function(s){ return '<option value="'+s.id+'" '+(s.id===activeId?'selected':'')+'>'+s.nama+'</option>'; }).join('');
}

function renderPelatihWorkspace(){
  var students = myStudents();
  var activeId = getActiveId();
  var active = students.find(function(s){ return s.id===activeId; }) || students[0];
  if(active) setActiveId(active.id);

  var has = !!active;
  document.getElementById('presensiEmpty').style.display = has?'none':'block';
  document.getElementById('presensiContent').style.display = has?'block':'none';
  document.getElementById('assessEmpty').style.display = has?'none':'block';
  document.getElementById('assessContent').style.display = has?'block':'none';
  if(!has){ if(attendanceUnsub){ attendanceUnsub(); attendanceUnsub=null; } return; }

  var age = ageFromTtl(active.ttl);
  var metaTxt = (active.posisi==='Kiper'?'Kiper':'Pemain Lapangan')+' · #'+(active.punggung||'–')+(age?(' · '+age+' th'):'')+(active.regional?(' · '+active.regional):'');

  document.getElementById('pAvatar').innerHTML = avatarHtml(active);
  document.getElementById('pName').textContent = active.nama;
  document.getElementById('pMeta').textContent = metaTxt;
  populateSelect(document.getElementById('pSelect'), students, active.id);

  document.getElementById('vAvatar').innerHTML = avatarHtml(active);
  document.getElementById('vName').textContent = active.nama;
  document.getElementById('vMeta').textContent = metaTxt;
  var posBadge=document.getElementById('vPosBadge');
  posBadge.textContent = active.posisi==='Kiper'?'Kiper':'Pemain Lapangan';
  posBadge.classList.toggle('is-gk', active.posisi==='Kiper');
  populateSelect(document.getElementById('vSelect'), students, active.id);

  listenAttendance(active.id);
  renderAssessment(active);
}
document.getElementById('pSelect').addEventListener('change', function(){ setActiveId(this.value); renderPelatihWorkspace(); });
document.getElementById('vSelect').addEventListener('change', function(){ setActiveId(this.value); renderPelatihWorkspace(); });

/* ---- Presensi ---- */
document.getElementById('addAttendance').addEventListener('click', function(){
  var id=getActiveId(); if(!id) return;
  var date=document.getElementById('aTanggal').value;
  var status=document.getElementById('aStatus').value;
  var sesi=document.getElementById('aSesi').value.trim()||'Latihan';
  if(!date){ document.getElementById('aTanggal').focus(); return; }
  db.collection('students').doc(id).collection('attendance').add({
    date:date, sesi:sesi, status:status, createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){
    document.getElementById('aSesi').value='';
    renderBeranda();
  }).catch(function(err){ toast('Gagal mencatat kehadiran: '+mapAuthError(err), true); });
});
function delAttendance(studentId, entryId){
  db.collection('students').doc(studentId).collection('attendance').doc(entryId).delete()
    .then(function(){ renderBeranda(); })
    .catch(function(err){ toast('Gagal menghapus catatan: '+mapAuthError(err), true); });
}
var STATUS_CLASS={Hadir:'status-hadir',Izin:'status-izin',Sakit:'status-sakit',Alpa:'status-alpa'};
var STATUS_DOT={Hadir:'#2E7D46',Izin:'#C98A00',Sakit:'#7A1F00',Alpa:'#C43B2F'};

function listenAttendance(studentId){
  if(attendanceUnsub) attendanceUnsub();
  attendanceUnsub = db.collection('students').doc(studentId).collection('attendance').orderBy('date','desc')
    .onSnapshot(function(snap){
      var list = snap.docs.map(function(d){ var o=d.data(); o.id=d.id; return o; });
      renderAttendanceList(studentId, list);
    }, function(err){ toast('Gagal memuat presensi: '+mapAuthError(err), true); });
}

function renderAttendanceList(studentId, att){
  var log=document.getElementById('attendLog');
  if(!att.length){ log.innerHTML='<tr><td colspan="4" class="log-empty">Belum ada catatan kehadiran.</td></tr>'; }
  else{
    log.innerHTML = att.map(function(a){
      return '<tr><td>'+fmtDate(a.date)+'</td><td>'+a.sesi+'</td><td><span class="status-tag '+(STATUS_CLASS[a.status]||'')+'">'+a.status+'</span></td>'+
        '<td><button class="icon-btn row-del" data-del="'+a.id+'" title="Hapus"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.6"/></svg></button></td></tr>';
    }).join('');
    log.querySelectorAll('[data-del]').forEach(function(b){ b.addEventListener('click', function(){ delAttendance(studentId, b.getAttribute('data-del')); }); });
  }
  var counts={Hadir:0,Izin:0,Sakit:0,Alpa:0};
  att.forEach(function(a){ counts[a.status]=(counts[a.status]||0)+1; });
  var total=att.length;
  var pct = total? Math.round(counts.Hadir/total*100):0;
  var circumference=264;
  document.getElementById('ringFg').setAttribute('stroke-dashoffset', circumference-(circumference*pct/100));
  document.getElementById('ringText').textContent=pct+'%';
  document.getElementById('statBreakdown').innerHTML = Object.keys(counts).map(function(k){
    return '<span class="pill"><i style="background:'+STATUS_DOT[k]+'"></i>'+k+' '+counts[k]+'</span>';
  }).join('');
}

/* ---- Penilaian ---- */
function metricRow(m, value){
  return '<div class="metric"><div class="metric-top"><b>'+m.label+'</b><span class="val" data-out="'+m.key+'">'+value+'</span></div>'+
    '<small>'+m.ref+'</small><input type="range" min="0" max="100" step="1" value="'+value+'" data-metric="'+m.key+'"></div>';
}
function renderAssessment(student){
  document.getElementById('coreMetrics').innerHTML = CORE_METRICS.map(function(m){ return metricRow(m, 50); }).join('');
  db.collection('assessments').doc(student.id).get().then(function(doc){
    var asm = doc.exists ? doc.data() : {};
    var isGk = student.posisi==='Kiper';
    document.getElementById('coreMetrics').innerHTML = CORE_METRICS.map(function(m){ return metricRow(m, asm[m.key]!=null?asm[m.key]:50); }).join('');
    document.getElementById('gkCard').style.display = isGk?'block':'none';
    if(isGk){ document.getElementById('gkMetrics').innerHTML = GK_METRICS.map(function(m){ return metricRow(m, asm[m.key]!=null?asm[m.key]:50); }).join(''); }
    document.getElementById('vCatatan').value = asm.catatan || '';
    bindMetricInputs();
    updateResult(student);
  }).catch(function(err){ toast('Gagal memuat penilaian: '+mapAuthError(err), true); });
}
function bindMetricInputs(){
  document.querySelectorAll('#coreMetrics input[type=range], #gkMetrics input[type=range]').forEach(function(inp){
    inp.addEventListener('input', function(){
      var out=document.querySelector('[data-out="'+inp.getAttribute('data-metric')+'"]');
      if(out) out.textContent=inp.value;
      var active = myStudents().find(function(s){ return s.id===getActiveId(); });
      if(active) updateResult(active);
    });
  });
}
function currentValues(){
  var vals={};
  document.querySelectorAll('#coreMetrics input[type=range], #gkMetrics input[type=range]').forEach(function(inp){ vals[inp.getAttribute('data-metric')]=parseInt(inp.value,10); });
  return vals;
}
function gradeFor(avg){
  if(avg>=85) return {letter:'A',label:'Sangat Baik'};
  if(avg>=70) return {letter:'B',label:'Baik'};
  if(avg>=55) return {letter:'C',label:'Cukup'};
  return {letter:'D',label:'Perlu Latihan'};
}
function updateResult(student){
  var vals=currentValues();
  var isGk = student.posisi==='Kiper';
  var coreVals = CORE_METRICS.map(function(m){ return vals[m.key]||0; });
  var allVals = isGk ? coreVals.concat(GK_METRICS.map(function(m){ return vals[m.key]||0; })) : coreVals;
  var avg = Math.round(allVals.reduce(function(a,b){return a+b;},0)/allVals.length);
  var g = gradeFor(avg);
  document.getElementById('resultGrade').textContent=g.letter;
  document.getElementById('resultAvg').textContent=avg+' / 100 · '+g.label;
  drawRadar(CORE_METRICS.map(function(m){ return { label:m.label, value:vals[m.key]||0 }; }));
  var gkMini=document.getElementById('gkMini');
  if(isGk){
    gkMini.style.display='block';
    gkMini.innerHTML = GK_METRICS.map(function(m){
      var v=vals[m.key]||0;
      return '<div class="gk-mini-row"><span>'+m.label+'</span><div class="gk-mini-bar"><i style="width:'+v+'%"></i></div><b>'+v+'</b></div>';
    }).join('');
  } else { gkMini.style.display='none'; gkMini.innerHTML=''; }
}
function drawRadar(items){
  var n=items.length, cx=130, cy=112, R=82;
  var svgNS='http://www.w3.org/2000/svg';
  var svg=document.getElementById('radar');
  svg.innerHTML='';
  function pt(i,r){ var angle=-Math.PI/2+i*(2*Math.PI/n); return { x:cx+r*Math.cos(angle), y:cy+r*Math.sin(angle) }; }
  [0.25,0.5,0.75,1].forEach(function(f){
    var pts=[]; for(var i=0;i<n;i++){ var p=pt(i,R*f); pts.push(p.x+','+p.y); }
    var poly=document.createElementNS(svgNS,'polygon');
    poly.setAttribute('points',pts.join(' ')); poly.setAttribute('fill','none'); poly.setAttribute('stroke','#D9DEE1'); poly.setAttribute('stroke-width','1');
    svg.appendChild(poly);
  });
  for(var i=0;i<n;i++){
    var p=pt(i,R);
    var line=document.createElementNS(svgNS,'line');
    line.setAttribute('x1',cx); line.setAttribute('y1',cy); line.setAttribute('x2',p.x); line.setAttribute('y2',p.y);
    line.setAttribute('stroke','#D9DEE1'); line.setAttribute('stroke-width','1');
    svg.appendChild(line);
    var lp=pt(i,R+22);
    var text=document.createElementNS(svgNS,'text');
    text.setAttribute('x',lp.x); text.setAttribute('y',lp.y+3); text.setAttribute('text-anchor','middle');
    text.setAttribute('font-family','IBM Plex Mono'); text.setAttribute('font-size','8.4'); text.setAttribute('fill','#5C6975');
    text.textContent = items[i].label.length>10 ? items[i].label.split('/')[0].trim().slice(0,9) : items[i].label;
    svg.appendChild(text);
  }
  var dataPts=[];
  for(var j=0;j<n;j++){ var val=Math.max(2,items[j].value); dataPts.push(pt(j,R*val/100)); }
  var poly2=document.createElementNS(svgNS,'polygon');
  poly2.setAttribute('points', dataPts.map(function(p){return p.x+','+p.y;}).join(' '));
  poly2.setAttribute('fill','rgba(12,147,160,0.2)'); poly2.setAttribute('stroke','#0C93A0'); poly2.setAttribute('stroke-width','2');
  svg.appendChild(poly2);
  dataPts.forEach(function(p){
    var c=document.createElementNS(svgNS,'circle');
    c.setAttribute('cx',p.x); c.setAttribute('cy',p.y); c.setAttribute('r','2.6'); c.setAttribute('fill','#0C93A0');
    svg.appendChild(c);
  });
}
document.getElementById('saveAssessment').addEventListener('click', function(){
  var id=getActiveId(); if(!id) return;
  var vals=currentValues();
  var record={};
  CORE_METRICS.concat(GK_METRICS).forEach(function(m){ record[m.key]= vals[m.key]!=null ? vals[m.key] : 0; });
  record.catatan = document.getElementById('vCatatan').value.trim();
  record.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  record.updatedBy = currentUser.uid;
  var btn = document.getElementById('saveAssessment');
  btn.classList.add('is-loading');
  db.collection('assessments').doc(id).set(record).then(function(){
    flashMsg('assessMsg');
    renderBeranda();
  }).catch(function(err){ toast('Gagal menyimpan penilaian: '+mapAuthError(err), true); })
    .finally(function(){ btn.classList.remove('is-loading'); });
});

})();
