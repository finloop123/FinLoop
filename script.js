/* FinLoop — Frontend (GitHub Pages + Vercel) */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider, GithubAuthProvider, signOut
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

import {
  firebaseConfig,
  API_URL,
  CLIENT_KEY,
  CS_NUMBER,
  CS_MESSAGE,
  SESSION_KEY,
  SESSION_TTL,
  LB_CACHE_KEY,
  LB_CACHE_TTL,
  REQ_TIMEOUT_MS,
  MAX_RETRY,
  RETRY_DELAY_MS,
  MAX_TRX_DISPLAY,
  MONTHS_SHORT,
  DAYS_SHORT,
  MS_DAY
} from './config.js';

/* ---------- FIREBASE INIT ---------- */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({ prompt: 'select_account' });

const githubProvider = new GithubAuthProvider();
githubProvider.addScope('read:user');
githubProvider.addScope('user:email');
githubProvider.setCustomParameters({ prompt: 'select_account' });

const $ = (id) => document.getElementById(id);

let preloadedData = null;

/* ---------- HELPERS ---------- */
function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.email) return null;
    if (s.expiresAt && Date.now() > s.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch (_) { return null; }
}
function setSession(s) {
  s.expiresAt = Date.now() + SESSION_TTL;
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}
function updateSession(partial) {
  const s = getSession();
  if (!s) return;
  Object.assign(s, partial);
  setSession(s);
}
function clearSession() { localStorage.removeItem(SESSION_KEY); }

function getLbCache() {
  try {
    const raw = localStorage.getItem(LB_CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || !c.ts || !c.data) return null;
    if (Date.now() - c.ts > LB_CACHE_TTL) return null;
    return c.data;
  } catch (_) { return null; }
}
function setLbCache(data) {
  try {
    localStorage.setItem(LB_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch (_) {}
}

function fmt(n) {
  return String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (isSameDay(d, now)) return 'Hari ini, ' + hh + ':' + mm;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(d, yesterday)) return 'Kemarin, ' + hh + ':' + mm;
  return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + ', ' + hh + ':' + mm;
}
function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function setBtnLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.classList.add('loading');
    btn.disabled = true;
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

/* ---------- SECURITY ---------- */
function initSecurity() {
  // Proteksi view-source & DevTools dimatikan sementara.
}

/* ---------- API ---------- */
async function apiCallOnce(action, data) {
  const payload = Object.assign({ action }, data || {});

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQ_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-FinLoop-Key': CLIENT_KEY,
        'X-FinLoop-Action': action
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store'
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('Timeout');
    throw new Error('Network error: ' + (err.message || err));
  }
  clearTimeout(timeoutId);

  if (!res.ok) throw new Error('HTTP ' + res.status);
  const text = await res.text();
  if (text.trim().indexOf('<') === 0) throw new Error('Server balik HTML.');
  let json;
  try { json = JSON.parse(text); } catch (_) { throw new Error('Bukan JSON'); }
  if (!json.ok) throw new Error(json.error || 'Server error');
  return json.data;
}

async function apiCall(action, data) {
  let lastErr;
  for (let i = 1; i <= MAX_RETRY; i++) {
    try { return await apiCallOnce(action, data); }
    catch (err) {
      lastErr = err;
      if (i < MAX_RETRY) await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  throw lastErr;
}

/* ============================================================
   LOGIN FLOW
   ============================================================ */
const loginState = { switching: false, email: '', name: '', provider: '', photoURL: '' };

function showOtpStep(email, name, provider) {
  loginState.email = email;
  loginState.name = name;
  loginState.provider = provider;

  $('otpSub').innerHTML = 'Kode 4 digit telah dikirim ke <b>' + escapeHtml(email) + '</b>';

  const step1 = $('step1');
  const step2 = $('step2');

  step1.style.opacity = '0';
  step1.style.transform = 'translateY(-10px)';

  setTimeout(() => {
    step1.style.display = 'none';
    step2.classList.add('show');
    step2.style.transform = 'translateY(10px)';
    step2.style.opacity = '0';
    void step2.offsetWidth;
    step2.style.transform = 'translateY(0)';
    step2.style.opacity = '1';

    setTimeout(() => {
      const inputs = $('otpWrap').querySelectorAll('.otp-input');
      if (inputs[0]) inputs[0].focus();
    }, 400);
  }, 400);
}

function showLoginStep() {
  const step1 = $('step1');
  const step2 = $('step2');

  step2.classList.remove('show');
  step1.style.display = 'flex';
  step1.style.opacity = '0';
  step1.style.transform = 'translateY(-10px)';
  void step1.offsetWidth;
  step1.style.opacity = '1';
  step1.style.transform = 'translateY(0)';

  const inputs = $('otpWrap').querySelectorAll('.otp-input');
  inputs.forEach(i => { i.value = ''; i.classList.remove('filled', 'err'); i.disabled = false; });
  $('otpError').classList.remove('show');

  const btnVerify = $('btnVerify');
  if (btnVerify) {
    btnVerify.classList.remove('loading');
    btnVerify.disabled = true;
  }

  signOut(auth).catch(() => {});
  loginState.email = '';
  loginState.photoURL = '';
}

function showOtpError(msg) {
  const errEl = $('otpError');
  errEl.textContent = msg || 'Kode salah, coba lagi';
  errEl.classList.add('show');
  const wrap = $('otpWrap');
  wrap.classList.remove('shake');
  void wrap.offsetWidth;
  wrap.classList.add('shake');

  const inputs = wrap.querySelectorAll('.otp-input');
  inputs.forEach(i => { i.value = ''; i.classList.remove('filled'); i.classList.add('err'); });
  setTimeout(() => {
    inputs.forEach(i => i.classList.remove('err'));
    inputs[0].focus();
  }, 600);
}

async function sendOtpToBackend(email, name, provider, photoURL) {
  return await apiCall('sendOtp', { email, name, provider, photoURL: photoURL || '' });
}

async function handleProviderLogin(providerType) {
  const btn = providerType === 'google' ? $('btnGoogle') : $('btnGithub');
  setBtnLoading(btn, true);
  try {
    const provider = providerType === 'google' ? googleProvider : githubProvider;
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const email = user.email;
    const name = user.displayName
      || (user.reloadUserInfo && user.reloadUserInfo.screenName)
      || (user.providerData && user.providerData[0] && user.providerData[0].displayName)
      || email.split('@')[0];

    let photoURL = user.photoURL || '';
    if (!photoURL && user.providerData && user.providerData[0]) {
      photoURL = user.providerData[0].photoURL || '';
    }

    if (!email) throw new Error('Email tidak tersedia dari provider.');

    loginState.photoURL = photoURL;

    await sendOtpToBackend(email, name, providerType, photoURL);
    setBtnLoading(btn, false);
    showOtpStep(email, name, providerType);
  } catch (err) {
    console.error(err);
    try { await signOut(auth); } catch (_) {}
    setBtnLoading(btn, false);
    alert('Gagal login: ' + (err.message || err));
  }
}

async function handleManualEmail() {
  const input = $('manualEmail');
  const btn = $('btnManualEmail');
  const email = (input.value || '').trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert('Masukkan email yang valid.');
    input.focus();
    return;
  }

  setBtnLoading(btn, true);
  try {
    loginState.photoURL = '';
    await sendOtpToBackend(email, '', 'manual', '');
    setBtnLoading(btn, false);
    showOtpStep(email, '', 'manual');
  } catch (err) {
    setBtnLoading(btn, false);
    alert('Gagal kirim OTP: ' + (err.message || err));
  }
}

async function verifyOtpCode(code) {
  const btn = $('btnVerify');
  setBtnLoading(btn, true);

  const inputs = $('otpWrap').querySelectorAll('.otp-input');
  inputs.forEach(i => i.disabled = true);

  try {
    const user = await apiCall('verifyOtp', { email: loginState.email, code });
    if (!user) throw new Error('Verifikasi gagal');

    setSession({
      email: user.email,
      name: user.name,
      provider: user.provider,
      accountNum: user.accountNum,
      photoURL: loginState.photoURL || user.photoURL || '',
      nickname: user.nickname || ''
    });

    const [trxRes, lbRes] = await Promise.all([
      apiCall('getAll', { userId: user.email }),
      apiCall('getLeaderboard', { userId: user.email })
    ]);

    preloadedData = {
      transactions: (trxRes && trxRes.transactions) || [],
      leaderboard: lbRes || { top: [], me: null, total: 0 },
      needsNickname: !user.nickname
    };

    onLoginSuccess();

  } catch (err) {
    inputs.forEach(i => i.disabled = false);
    setBtnLoading(btn, false);
    showOtpError(err.message || 'Kode salah');
  }
}

function onLoginSuccess() {
  $('decoBL').classList.add('exit-left');
  $('decoBR').classList.add('exit-right');

  setTimeout(() => {
    initDashboard();
    const page2 = $('page2');
    page2.style.transition = 'transform 0.9s cubic-bezier(.7,0,.3,1)';
    page2.style.transform = 'translateY(0)';
    $('page1').classList.add('slide-up');
  }, 300);
}

function initLogin() {
  $('btnGoogle').addEventListener('click', () => handleProviderLogin('google'));
  $('btnGithub').addEventListener('click', () => handleProviderLogin('github'));
  $('btnManualEmail').addEventListener('click', handleManualEmail);
  $('manualEmail').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleManualEmail(); }
  });
  $('btnBack').addEventListener('click', showLoginStep);

  const btnVerify = $('btnVerify');
  const inputs = Array.from($('otpWrap').querySelectorAll('.otp-input'));

  function updateVerifyBtn() {
    const code = inputs.map(x => x.value).join('');
    btnVerify.disabled = code.length !== 4;
  }

  btnVerify.addEventListener('click', () => {
    const code = inputs.map(x => x.value).join('');
    if (code.length === 4) verifyOtpCode(code);
  });

  inputs.forEach((inp, i) => {
    inp.addEventListener('input', (e) => {
      $('otpError').classList.remove('show');
      let val = e.target.value.replace(/\D/g, '');
      if (val.length > 1) {
        const chars = val.split('');
        for (let j = 0; j < chars.length && (i + j) < inputs.length; j++) {
          inputs[i + j].value = chars[j];
          inputs[i + j].classList.add('filled');
        }
        const next = Math.min(i + chars.length, inputs.length - 1);
        inputs[next].focus();
      } else {
        e.target.value = val;
        if (val) {
          e.target.classList.add('filled');
          if (i < inputs.length - 1) inputs[i + 1].focus();
        } else {
          e.target.classList.remove('filled');
        }
      }
      updateVerifyBtn();
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && i > 0) {
        inputs[i - 1].focus();
        inputs[i - 1].value = '';
        inputs[i - 1].classList.remove('filled');
        e.preventDefault();
        updateVerifyBtn();
      }
      if (e.key === 'ArrowLeft' && i > 0) { inputs[i - 1].focus(); e.preventDefault(); }
      if (e.key === 'ArrowRight' && i < inputs.length - 1) { inputs[i + 1].focus(); e.preventDefault(); }
      if (e.key === 'Enter') {
        const code = inputs.map(x => x.value).join('');
        if (code.length === 4) verifyOtpCode(code);
      }
    });
    inp.addEventListener('paste', (e) => {
      e.preventDefault();
      $('otpError').classList.remove('show');
      const text = (e.clipboardData || window.clipboardData).getData('text') || '';
      const digits = text.replace(/\D/g, '').slice(0, inputs.length);
      for (let j = 0; j < digits.length; j++) {
        inputs[j].value = digits[j];
        inputs[j].classList.add('filled');
      }
      if (digits.length > 0) {
        const next = Math.min(digits.length, inputs.length - 1);
        inputs[next].focus();
      }
      updateVerifyBtn();
    });
    inp.addEventListener('focus', () => inp.select());
  });
}

/* ============================================================
   DASHBOARD
   ============================================================ */
let dashInitialized = false;
let _t0 = 0;
const state = { transactions: [] };
let currentRange = 'week';
let firstRenderDone = false;
let currentUser = null;

function getAbsoluteDelay(targetMs) {
  return Math.max(0, (targetMs - (performance.now() - _t0)) / 1000);
}

async function loadState() {
  try {
    const data = await apiCall('getAll', { userId: currentUser.email });
    state.transactions = Array.isArray(data && data.transactions) ? data.transactions : [];
    return true;
  } catch (err) {
    state.transactions = [];
    return false;
  }
}

const compute = {
  balance() { return state.transactions.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0); },
  income() { return state.transactions.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0); },
  expense() { return state.transactions.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0); }
};

function renderBalance(animate) {
  const balance = compute.balance();
  const income = compute.income();
  const expense = compute.expense();

  if (animate === false) {
    $('totalBalance').textContent = fmt(balance);
    $('totalIncome').textContent = '+' + fmt(income);
    $('totalExpense').textContent = '-' + fmt(expense);
    return;
  }
  countUp($('totalBalance'), balance, '');
  countUp($('totalIncome'), income, '+');
  countUp($('totalExpense'), expense, '-');
}

function countUp(el, target, sign) {
  const duration = 550;
  const startVal = parseInt((el.textContent || '0').replace(/\D/g, ''), 10) || 0;
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = Math.round(startVal + (target - startVal) * eased);
    el.textContent = sign + fmt(val);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = sign + fmt(target);
  }
  requestAnimationFrame(tick);
}

function createTrxElement(tx) {
  const el = document.createElement('div');
  el.className = 'trx trx-' + (tx.type === 'in' ? 'in' : 'out');
  const icon = tx.type === 'in'
    ? '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>'
    : '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>';
  el.innerHTML =
    '<div class="trx-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' + icon + '</svg></div>' +
    '<div class="trx-info"><div class="trx-title"></div><div class="trx-date"></div></div>' +
    '<div class="trx-amount">' + (tx.type === 'in' ? '+' : '-') + fmt(tx.amount) + '</div>';
  el.querySelector('.trx-title').textContent = tx.title;
  el.querySelector('.trx-date').textContent = formatDate(tx.timestamp);
  return el;
}

function renderHistoryInitial() {
  const list = $('historyList');
  const empty = $('historyEmpty');
  list.innerHTML = '';
  const txs = state.transactions.slice(0, MAX_TRX_DISPLAY);
  if (txs.length === 0) {
    empty.style.display = 'flex';
    const delay = getAbsoluteDelay(1650);
    empty.style.animation = 'fadeUp .55s ' + delay.toFixed(2) + 's cubic-bezier(.4,0,.2,1) both';
    return;
  }
  empty.style.display = 'none';
  txs.forEach((tx, i) => {
    const el = createTrxElement(tx);
    const delay = getAbsoluteDelay(1620 + i * 160);
    el.style.animation = 'fadeRight .55s ' + delay.toFixed(2) + 's cubic-bezier(.4,0,.2,1) both';
    list.appendChild(el);
  });
}

function prependHistory(tx) {
  const list = $('historyList');
  const empty = $('historyEmpty');
  empty.style.display = 'none';
  const el = createTrxElement(tx);
  el.style.animation = 'fadeRight .5s cubic-bezier(.4,0,.2,1) both';
  list.insertBefore(el, list.firstChild);
  while (list.children.length > MAX_TRX_DISPLAY) list.removeChild(list.lastElementChild);
}

function computeHeatLevels(type) {
  const now = new Date(); now.setHours(0,0,0,0);
  const buckets = new Array(30).fill(0);
  const keyToIndex = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getTime() - (29 - i) * MS_DAY);
    keyToIndex[dayKey(d)] = i;
  }
  state.transactions.forEach(tx => {
    if (tx.type !== type) return;
    const d = new Date(tx.timestamp); d.setHours(0,0,0,0);
    const k = dayKey(d);
    if (k in keyToIndex) buckets[keyToIndex[k]]++;
  });
  return buckets.map(c => c === 0 ? 0 : c === 1 ? 1 : c <= 3 ? 2 : c <= 5 ? 3 : 4);
}

function renderHeatmap() {
  renderHeatGroup($('heatIncome'), computeHeatLevels('in'), 2100);
  renderHeatGroup($('heatExpense'), computeHeatLevels('out'), 2700);
}
function renderHeatGroup(container, levels, baseMs) {
  container.innerHTML = '';
  levels.forEach((lvl, i) => {
    const row = Math.floor(i / 10), col = i % 10;
    const wave = (row + col) * 35;
    const delay = getAbsoluteDelay(baseMs + wave);
    const span = document.createElement('span');
    span.className = 'heat h' + lvl;
    span.style.animationDelay = delay.toFixed(3) + 's';
    container.appendChild(span);
  });
}

function bucketWeek() {
  const now = new Date(); now.setHours(0,0,0,0);
  const labels = [], inc = [], exp = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * MS_DAY);
    labels.push(DAYS_SHORT[d.getDay()]);
    const k = dayKey(d);
    let sIn = 0, sOut = 0;
    state.transactions.forEach(tx => {
      const td = new Date(tx.timestamp); td.setHours(0,0,0,0);
      if (dayKey(td) !== k) return;
      if (tx.type === 'in') sIn += tx.amount; else sOut += tx.amount;
    });
    inc.push(sIn); exp.push(sOut);
  }
  return { labels, income: inc, expense: exp };
}
function bucketMonth() {
  const now = new Date(); now.setHours(0,0,0,0);
  const labels = ['M1','M2','M3','M4'];
  const inc = [0,0,0,0], exp = [0,0,0,0];
  state.transactions.forEach(tx => {
    const d = new Date(tx.timestamp); d.setHours(0,0,0,0);
    const diff = Math.floor((now - d) / MS_DAY);
    if (diff < 0 || diff >= 28) return;
    const idx = 3 - Math.floor(diff / 7);
    if (tx.type === 'in') inc[idx] += tx.amount; else exp[idx] += tx.amount;
  });
  return { labels, income: inc, expense: exp };
}
function bucketYear() {
  const now = new Date();
  const labels = [], inc = [], exp = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(MONTHS_SHORT[d.getMonth()]);
    const y = d.getFullYear(), m = d.getMonth();
    let sIn = 0, sOut = 0;
    state.transactions.forEach(tx => {
      const td = new Date(tx.timestamp);
      if (td.getFullYear() !== y || td.getMonth() !== m) return;
      if (tx.type === 'in') sIn += tx.amount; else sOut += tx.amount;
    });
    inc.push(sIn); exp.push(sOut);
  }
  return { labels, income: inc, expense: exp };
}

function renderBarChart(range) {
  currentRange = range;
  const buckets = range === 'week' ? bucketWeek() : range === 'month' ? bucketMonth() : bucketYear();
  const incomeMil = buckets.income.map(v => v / 1000000);
  const expenseMil = buckets.expense.map(v => v / 1000000);
  const maxVal = Math.max(1, Math.max.apply(null, incomeMil.concat(expenseMil)));

  const area = $('barsArea');
  area.innerHTML = '';
  const baseMs = firstRenderDone ? 0 : 3700;
  const stepMs = firstRenderDone ? 50 : 130;

  buckets.labels.forEach((label, i) => {
    const group = document.createElement('div');
    group.className = 'bar-group';
    const pair = document.createElement('div');
    pair.className = 'bar-pair';

    const inBar = document.createElement('div');
    inBar.className = 'bar in';
    inBar.style.height = (incomeMil[i] / maxVal * 100) + '%';
    inBar.style.animationDelay = getAbsoluteDelay(baseMs + i * stepMs).toFixed(3) + 's';
    inBar.innerHTML = '<span class="bar-tip">+' + incomeMil[i].toFixed(2).replace('.', ',') + 'jt</span>';

    const outBar = document.createElement('div');
    outBar.className = 'bar out';
    outBar.style.height = (expenseMil[i] / maxVal * 100) + '%';
    outBar.style.animationDelay = getAbsoluteDelay(baseMs + i * stepMs + 60).toFixed(3) + 's';
    outBar.innerHTML = '<span class="bar-tip">-' + expenseMil[i].toFixed(2).replace('.', ',') + 'jt</span>';

    pair.appendChild(inBar);
    pair.appendChild(outBar);

    const lbl = document.createElement('div');
    lbl.className = 'bar-label';
    lbl.textContent = label;
    if (!firstRenderDone) {
      lbl.style.animation = 'fadeUp .5s ' + getAbsoluteDelay(baseMs + buckets.labels.length * stepMs + 300).toFixed(3) + 's cubic-bezier(.4,0,.2,1) both';
    } else {
      lbl.style.animation = 'none';
    }

    group.appendChild(pair);
    group.appendChild(lbl);
    area.appendChild(group);
  });

  $('chartSub').textContent =
    range === 'week' ? '7 hari terakhir · dalam juta rupiah' :
    range === 'month' ? '4 minggu terakhir · dalam juta rupiah' :
    '12 bulan terakhir · dalam juta rupiah';

  firstRenderDone = true;
}

/* ---------- LEADERBOARD ---------- */
async function loadLeaderboard() {
  const container = $('leaderboard');
  if (!container) return;

  const cached = getLbCache();
  if (cached) renderLeaderboard(cached);

  try {
    const data = await apiCall('getLeaderboard', { userId: currentUser.email });
    renderLeaderboard(data);
    setLbCache(data);
    container.dataset.loaded = '1';
  } catch (err) {
    console.error('Leaderboard error:', err);
    if (!cached) {
      container.innerHTML =
        '<div class="lb-empty">' +
          '<div class="lb-empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>' +
          '<div class="lb-empty-text">Gagal memuat peringkat</div>' +
          '<div class="lb-empty-sub">Coba lagi nanti</div>' +
        '</div>';
    }
  }
}

function createLbRow(user, rank, isMe, isBelowTop) {
  const el = document.createElement('div');
  el.className = 'lb-row';

  if (rank === 1) el.classList.add('lb-top-1');
  else if (rank === 2) el.classList.add('lb-top-2');
  else if (rank === 3) el.classList.add('lb-top-3');
  else if (isMe) {
    el.classList.add(isBelowTop ? 'lb-me-below' : 'lb-me');
  }

  const num = document.createElement('span');
  num.className = 'lb-num';
  num.textContent = rank;
  el.appendChild(num);

  const av = document.createElement('span');
  av.className = 'lb-avatar';

  if (user.photoURL && user.photoURL.trim() !== '') {
    const img = document.createElement('img');
    img.src = user.photoURL;
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => {
      av.innerHTML = '';
      const initial = (user.nickname || user.name || user.email || '?')[0].toUpperCase();
      av.textContent = initial;
      av.style.color = '#2563eb';
      av.style.fontWeight = '700';
      av.style.fontSize = '13px';
    };
    av.appendChild(img);
  } else {
    const initial = (user.nickname || user.name || user.email || '?')[0].toUpperCase();
    av.textContent = initial;
    av.style.color = '#2563eb';
    av.style.fontWeight = '700';
    av.style.fontSize = '13px';
  }

  el.appendChild(av);

  const name = document.createElement('span');
  name.className = 'lb-name';
  name.textContent = user.nickname || user.name || (user.email || '').split('@')[0] || 'User';
  el.appendChild(name);

  return el;
}

function renderLeaderboard(data) {
  const container = $('leaderboard');
  if (!container) return;
  container.innerHTML = '';

  const top = data && data.top ? data.top : [];
  const me = data && data.me;
  const total = (data && data.total) || 0;

  $('leaderboardCount').textContent = total + ' user';

  if (top.length === 0) {
    container.innerHTML =
      '<div class="lb-empty">' +
        '<div class="lb-empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z"/></svg></div>' +
        '<div class="lb-empty-text">Belum ada user lain</div>' +
        '<div class="lb-empty-sub">Ajak temanmu gabung FinLoop</div>' +
      '</div>';
    return;
  }

  const stickyTop = document.createElement('div');
  stickyTop.className = 'lb-sticky-top';

  const rest = [];

  top.forEach((u, i) => {
    const rank = i + 1;
    const row = createLbRow(u, rank, false, false);
    row.style.animation = 'fadeRight .5s ' + (3.20 + i * 0.05).toFixed(2) + 's cubic-bezier(.4,0,.2,1) both';
    if (rank <= 3) stickyTop.appendChild(row);
    else rest.push(row);
  });

  container.appendChild(stickyTop);
  rest.forEach(r => container.appendChild(r));

  if (me && me.rank > 10) {
    const sep = document.createElement('div');
    sep.className = 'lb-separator';
    sep.textContent = '···';
    container.appendChild(sep);

    const meRow = createLbRow(me, me.rank, true, true);
    meRow.style.animation = 'fadeRight .5s ' + (3.20 + top.length * 0.05 + 0.1).toFixed(2) + 's cubic-bezier(.4,0,.2,1) both';
    container.appendChild(meRow);
  }
}

function initLeaderboard() {
  loadLeaderboard();
}

/* ---------- ACTIONS ---------- */
async function addTransaction(type, title, amount) {
  const tempTx = {
    id: 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    type, title: (title || '').trim() || (type === 'in' ? 'Masuk saldo' : 'Tarik saldo'),
    amount, timestamp: Date.now()
  };

  state.transactions.unshift(tempTx);
  prependHistory(tempTx);
  renderBalance(true);
  renderHeatmap();
  renderBarChart(currentRange);

  try {
    const saved = await apiCall('add', {
      userId: currentUser.email,
      type, title: tempTx.title, amount
    });
    const idx = state.transactions.findIndex(t => t.id === tempTx.id);
    if (idx !== -1) state.transactions[idx] = saved;
  } catch (err) {
    const idx = state.transactions.findIndex(t => t.id === tempTx.id);
    if (idx !== -1) state.transactions.splice(idx, 1);
    renderHistoryInitial();
    renderBalance(true);
    renderHeatmap();
    renderBarChart(currentRange);
    alert('Gagal menyimpan: ' + err.message);
  }
}

function attemptTransaction(action) {
  const rawAmount = readAmountInput();
  if (rawAmount <= 0) { focusAmountInput(); return; }
  const note = $('noteInput').value;
  executeTransaction(action, rawAmount, note);
}

function executeTransaction(type, amount, note) {
  if (type === 'out') {
    const balance = compute.balance();
    if (amount > balance) {
      alert('Saldo tidak cukup.\n\nSaldo: Rp ' + fmt(balance) + '\nDiminta: Rp ' + fmt(amount));
      resetForm();
      return;
    }
  }
  addTransaction(type, note, amount);
  resetForm();
}

function readAmountInput() {
  const raw = $('fromInput').value.replace(/\./g, '').replace(/\D/g, '');
  return parseInt(raw, 10) || 0;
}
function resetForm() {
  const input = $('fromInput');
  input.value = '';
  input.classList.remove('has-value');
  input.style.width = '1ch';
  $('noteInput').value = '';
  input.focus();
}
function focusAmountInput() { $('fromInput').focus(); }

function initInput() {
  const input = $('fromInput');
  const wrap = $('inputWrap');
  wrap.addEventListener('click', () => input.focus());
  function autoSize() {
    const len = (input.value || input.placeholder || '0').length;
    input.style.width = Math.max(len, 1) + 'ch';
  }
  function fmtDigits(raw) {
    const digits = raw.replace(/\D/g, '').replace(/^0+/, '');
    if (digits === '') return '';
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  input.addEventListener('input', () => {
    const caretFromEnd = input.value.length - input.selectionStart;
    input.value = fmtDigits(input.value);
    const newPos = Math.max(0, input.value.length - caretFromEnd);
    input.setSelectionRange(newPos, newPos);
    if (input.value === '' || input.value === '0') input.classList.remove('has-value');
    else input.classList.add('has-value');
    autoSize();
  });
  input.addEventListener('focus', autoSize);
  input.addEventListener('blur', autoSize);
  autoSize();
}

function initChartTags() {
  document.querySelectorAll('.chart-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chart-tag').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderBarChart(btn.dataset.range);
    });
  });
}

function initCS() {
  const btn = $('csBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const url = 'https://wa.me/' + CS_NUMBER + '?text=' + encodeURIComponent(CS_MESSAGE);
    window.open(url, '_blank', 'noopener,noreferrer');
  });
}

function initReset() {
  const openBtn = $('resetBtn');
  const overlay = $('resetConfirm');
  if (!openBtn || !overlay) return;
  const cancel = $('resetCancel');
  const confirm = $('resetConfirmBtn');

  openBtn.addEventListener('click', () => overlay.classList.add('show'));
  cancel.addEventListener('click', () => overlay.classList.remove('show'));
  confirm.addEventListener('click', async () => {
    overlay.classList.remove('show');
    const flash = $('resetFlash');
    flash.classList.add('show');
    localStorage.removeItem(LB_CACHE_KEY);
    try { await apiCall('reset', { userId: currentUser.email }); } catch (_) {}
    setTimeout(() => { location.reload(); }, 900);
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('show'); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('show')) overlay.classList.remove('show');
  });
}

function initLogout() {
  const btn = $('btnLogout');
  const overlay = $('logoutConfirm');
  if (!btn || !overlay) return;
  const cancel = $('logoutCancel');
  const confirm = $('logoutConfirmBtn');

  btn.addEventListener('click', () => overlay.classList.add('show'));
  cancel.addEventListener('click', () => overlay.classList.remove('show'));
  confirm.addEventListener('click', async () => {
    clearSession();
    localStorage.removeItem(LB_CACHE_KEY);
    try { await signOut(auth); } catch (_) {}
    location.reload();
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('show'); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('show')) overlay.classList.remove('show');
  });
}

function renderUserInfo(user) {
  const name = user.name || user.email.split('@')[0];
  $('accName').textContent = name;
  $('accEmail').textContent = user.email;

  const avatarEl = $('accAvatar');
  if (user.photoURL) {
    avatarEl.innerHTML = '<img src="' + user.photoURL + '" alt="" referrerpolicy="no-referrer">';
  } else {
    avatarEl.textContent = (name[0] || '?').toUpperCase();
  }

  $('accNum').textContent = user.accountNum || '0000';
}

/* ============================================================
   NICKNAME POPUP
   ============================================================ */
function initNicknamePopup() {
  const overlay = $('nicknameModal');
  const input = $('nicknameInput');
  const error = $('nicknameError');
  const btn = $('nicknameConfirmBtn');
  if (!overlay || !input || !btn) return;

  overlay.classList.add('show');
  setTimeout(() => input.focus(), 300);

  function validate() {
    const val = (input.value || '').trim();
    if (val.length < 2) {
      error.textContent = 'Minimal 2 karakter';
      error.classList.add('show');
      return false;
    }
    if (val.length > 20) {
      error.textContent = 'Maksimal 20 karakter';
      error.classList.add('show');
      return false;
    }
    if (!/^[a-zA-Z0-9 _.\-]+$/.test(val)) {
      error.textContent = 'Hanya huruf, angka, spasi, titik, strip';
      error.classList.add('show');
      return false;
    }
    error.classList.remove('show');
    return true;
  }

  input.addEventListener('input', () => {
    error.classList.remove('show');
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btn.click();
    }
  });

  btn.addEventListener('click', async () => {
    if (!validate()) return;
    const nickname = input.value.trim();
    setBtnLoading(btn, true);
    try {
      await apiCall('setNickname', { userId: currentUser.email, nickname });
      updateSession({ nickname });
      overlay.classList.remove('show');
      loadLeaderboard();
    } catch (err) {
      setBtnLoading(btn, false);
      error.textContent = err.message || 'Gagal menyimpan';
      error.classList.add('show');
    }
  });
}

/* ============================================================
   INIT DASHBOARD
   ============================================================ */
function initDashboard() {
  if (dashInitialized) return;
  dashInitialized = true;

  currentUser = getSession();
  if (!currentUser) return;

  _t0 = performance.now();

  const tpl = document.getElementById('dashboardTemplate');
  const page2 = $('page2');
  page2.appendChild(tpl.content.cloneNode(true));

  renderUserInfo(currentUser);

  initInput();
  initChartTags();
  initCS();
  initReset();
  initLogout();

  $('btnMasuk').addEventListener('click', () => attemptTransaction('in'));
  $('btnTarik').addEventListener('click', () => attemptTransaction('out'));
  $('fromInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); attemptTransaction('in'); }
  });
  $('noteInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); attemptTransaction('in'); }
  });

  if (preloadedData) {
    const trx = preloadedData.transactions;
    const lb = preloadedData.leaderboard;
    const needsNickname = preloadedData.needsNickname;
    preloadedData = null;

    state.transactions = trx;

    renderHeatmap();
    renderBarChart('week');
    renderHistoryInitial();

    const balance = compute.balance();
    const income = compute.income();
    const expense = compute.expense();
    setTimeout(() => countUp($('totalBalance'), balance, ''), 1500);
    setTimeout(() => countUp($('totalIncome'), income, '+'), 2050);
    setTimeout(() => countUp($('totalExpense'), expense, '-'), 2650);

    renderLeaderboard(lb);
    setLbCache(lb);
    const lbContainer = $('leaderboard');
    if (lbContainer) lbContainer.dataset.loaded = '1';

    if (needsNickname) {
      setTimeout(() => initNicknamePopup(), 1200);
    }

  } else {
    renderHeatmap();
    renderBarChart('week');
    renderHistoryInitial();

    setTimeout(() => countUp($('totalBalance'), 0, ''), 1500);
    setTimeout(() => countUp($('totalIncome'), 0, '+'), 2050);
    setTimeout(() => countUp($('totalExpense'), 0, '-'), 2650);

    initLeaderboard();

    const loadStart = performance.now();
    loadState().then((success) => {
      if (!success) return;
      const elapsed = performance.now() - loadStart;
      const waitMore = Math.max(0, 4200 - elapsed - 1500);
      setTimeout(() => {
        renderHistoryInitial();
        renderHeatmap();
        renderBarChart(currentRange);
        renderBalance(true);
      }, waitMore);
    });

    if (currentUser && !currentUser.nickname) {
      setTimeout(() => initNicknamePopup(), 1500);
    }
  }
}

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initSecurity();

  const session = getSession();
  if (session) {
    document.documentElement.classList.add('has-session');
    initDashboard();
  } else {
    document.documentElement.classList.remove('has-session');
    initLogin();
  }
});