/* ============================================================
   FinLoop — Config
   Semua konstanta & konfigurasi ada di sini
   ============================================================ */

/* ---------- FIREBASE ---------- */
export const firebaseConfig = {
  apiKey: "AIzaSyARRqNfAggNfYfCYB5fNLHsKLSYl2nxbcE",
  authDomain: "finloop-d8210.firebaseapp.com",
  projectId: "finloop-d8210",
  storageBucket: "finloop-d8210.firebasestorage.app",
  messagingSenderId: "523971270662",
  appId: "1:523971270662:web:94e62f7d290b8337becb87"
};

/* ---------- BACKEND API ---------- */
export const API_URL = 'https://script.google.com/macros/s/AKfycbw9CxRv7oT6FoBHqTGOwMw0xEFTQACpzTIC4pcuAjm3HseYN3f9hdh7b16osURIeRW5/exec';

/* ---------- CUSTOMER SERVICE ---------- */
export const CS_NUMBER  = '628567858301';
export const CS_MESSAGE = 'Halo kak, saya user dari finloop ingin ...';

/* ---------- SESSION ---------- */
export const SESSION_KEY = 'finloop_session';
export const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;   // 30 hari

/* ---------- LEADERBOARD CACHE ---------- */
export const LB_CACHE_KEY = 'finloop_lb_cache';
export const LB_CACHE_TTL = 5 * 60 * 1000;             // 5 menit

/* ---------- API RETRY ---------- */
export const REQ_TIMEOUT_MS = 45000;
export const MAX_RETRY      = 3;
export const RETRY_DELAY_MS = 1500;

/* ---------- UI ---------- */
export const MAX_TRX_DISPLAY = 5;

/* ---------- WAKTU ---------- */
export const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
export const DAYS_SHORT   = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
export const MS_DAY       = 86400000;