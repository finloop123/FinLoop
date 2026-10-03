/* ============================================================
   FinLoop — Config (Public)
   Frontend di GitHub Pages, Backend di Vercel
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

/* ---------- API (Vercel) ----------
   Ganti finloop.vercel.app dengan URL Vercel asli kamu.
------------------------------------ */
export const API_URL    = 'https://fin-loop-backand.vercel.app/api/v1/finloop';
export const ASSET_URL  = 'https://fin-loop-backand.vercel.app/private-assets';

/* ---------- CLIENT KEY ---------- */
export const CLIENT_KEY = 'finloop_local_dev_key_2026';

/* ---------- CUSTOMER SERVICE ---------- */
export const CS_NUMBER  = '628567858301';
export const CS_MESSAGE = 'Halo kak, saya user dari finloop ingin ...';

/* ---------- SESSION ---------- */
export const SESSION_KEY = 'finloop_session';
export const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;

/* ---------- LEADERBOARD CACHE ---------- */
export const LB_CACHE_KEY = 'finloop_lb_cache';
export const LB_CACHE_TTL = 5 * 60 * 1000;

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
