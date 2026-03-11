import { api } from './api.js';

let currentView = 'welcome';
let joinedCrew = null;
let toastTimer;

// ── View-groups: які view-и показують nav/header ─────────────────────────
// Проблема була тут: view 0, 1, 2, 3, '05' — числа і рядки перемішані.
// showView порівнює currentView === n, але '0' !== 0.
// Виправлено: всі id view-ів тепер нормалізуються до рядка.

const NAV_VIEWS   = new Set(['home','root','0','05','1','2','3','trip','map','5']);
const CLEAN_VIEWS = new Set(['welcome','reg']);

function _normalize(n) {
  // Приводимо будь-який вхід до рядка: 0→'0', 1→'1', 'home'→'home'
  return String(n);
}

export function selectRole(role) {
  toggleRegRole(role);
  showView('reg');
}

export function toggleRegRole(role) {
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('on'));
  const btn = document.getElementById('rb-' + role);
  if (btn) btn.classList.add('on');
  const carField = document.getElementById('carField');
  if (!carField) return;
  carField.style.display = (role === 'companion' || role === 'organizer') ? 'none' : 'block';
}

export function showView(n, dir = 'forward') {
  const id = _normalize(n);
  const curId = _normalize(currentView);

  const curEl  = document.getElementById('v' + curId);
  const nextEl = document.getElementById('v' + id);
  if (!nextEl || curId === id) return;

  const hdr = document.getElementById('appHdr');
  const nav = document.getElementById('appNav');

  // ── Показуємо/ховаємо header і nav залежно від view ──────────────────
  if (CLEAN_VIEWS.has(id)) {
    if (hdr) hdr.style.display = 'none';
    if (nav) nav.style.display = 'none';
  } else {
    if (hdr) hdr.style.display = 'flex';
    // ВИПРАВЛЕННЯ БАГА: nav завжди flex для всіх робочих view-ів.
    // Раніше nav ховався при переході на дошку (view 0,1,2) бо
    // умова перевіряла typeof числа і не збігалась з рядком 'home'.
    if (nav) nav.style.display = 'flex';
  }

  // ── Анімація виходу поточного view ───────────────────────────────────
  if (curEl) {
    curEl.classList.remove('active');
    if (dir === 'forward') {
      curEl.classList.add('out');
      setTimeout(() => curEl.classList.remove('out'), 350);
    } else {
      curEl.style.transition = 'transform .3s cubic-bezier(.4,0,.2,1), opacity .25s';
      curEl.style.transform  = 'translateX(100%)';
      curEl.style.opacity    = '0';
      setTimeout(() => {
        curEl.style.transform  = '';
        curEl.style.opacity    = '';
        curEl.style.transition = '';
      }, 350);
    }
  }

  // ── Анімація входу нового view ────────────────────────────────────────
  if (dir === 'back') {
    nextEl.style.transition = 'none';
    nextEl.style.transform  = 'translateX(-28%)';
    nextEl.style.opacity    = '0';
    nextEl.getBoundingClientRect(); // force reflow
    nextEl.style.transition = '';
    nextEl.style.transform  = '';
    nextEl.style.opacity    = '';
  }
  nextEl.classList.add('active');

  // ── Підсвічування активного пункту nav ───────────────────────────────
  if (nav) {
    const nvs = nav.querySelectorAll('.nv');
    nvs.forEach(el => {
      el.classList.remove('on');
      el.style.color = '';
    });
    const setNav = (idx, color) => {
      if (nvs[idx]) { nvs[idx].classList.add('on'); nvs[idx].style.color = color; }
    };
    if      (id === 'home')                              setNav(0, 'var(--lime)');
    else if (['root','0','05','1','2','3'].includes(id)) setNav(1, 'var(--lime)');
    else if (id === 'trip')                              setNav(2, 'var(--lime)');
    else if (id === 'map')                               setNav(3, 'var(--sky)');
    else if (id === '5')                                 setNav(3, 'var(--sky)');
  }

  currentView = id;
}

// ── Static drill-fallbacks (коли немає API) ───────────────────────────────
export function drillToSubcat() { showView('05'); }
export function drillToOrg()    { showView('1'); }
export function drillToCrews()  { showView('2'); }

export function goBack(target) {
  showView(target, 'back');
  document.querySelectorAll('.crew-card').forEach(el => el.classList.remove('open'));
}

export function toggleOrg(n) {
  const card = document.getElementById('org' + n);
  if (!card) return;
  const wasOpen = card.classList.contains('open');
  document.querySelectorAll('.org-card').forEach(el => el.classList.remove('open'));
  if (!wasOpen) card.classList.add('open');
}

export function toggleCrew(n) {
  const card = document.getElementById('crew' + n);
  if (!card) return;
  const wasOpen = card.classList.contains('open');
  document.querySelectorAll('.crew-card').forEach(el => el.classList.remove('open'));
  if (!wasOpen) card.classList.add('open');
}

export function joinCrew(n) {
  if (joinedCrew === n) { showToast('Ти вже в екіпажі #' + n + ' ✓'); return; }
  joinedCrew = n;
  showToast('🎉 Запит надіслано! Чекай підтвердження водія');
  const card = document.getElementById('crew' + n);
  if (!card) return;
  const btn = card.querySelector('.join-lime');
  if (btn) {
    btn.innerHTML = '✓ Запит надіслано — чекаємо водія';
    btn.style.cssText = 'background:rgba(201,255,71,.1);color:var(--lime);box-shadow:none;border:1px solid rgba(201,255,71,.2);width:100%;padding:11px;border-radius:10px;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:10px';
  }
  const freeSeat = card.querySelector('.seat.free');
  if (freeSeat) {
    freeSeat.style.background  = 'rgba(201,255,71,.35)';
    freeSeat.style.borderColor = 'var(--lime)';
    freeSeat.classList.remove('free-pulse');
  }
  api('/api/v3/handshake', { method: 'POST', body: JSON.stringify({ crew_id: n }) });
}

const SHARE_DATA = {
  coord: {
    title: '🔗 Запросити організаторів',
    url:   'waytandem.app/i/carpaty',
    desc:  'Координаторський рівень — людина одразу побачить напрямок та зможе створити виїзд.',
  },
  org: {
    title: '🚗 Запросити мандрівників і попутників',
    url:   'waytandem.app/i/bukovel-july14',
    desc:  'Рівень організатора — людина побачить виїзд, всі екіпажі та вільні місця.',
  },
};

export function openShare(type) {
  const d = SHARE_DATA[type] || SHARE_DATA.coord;
  document.getElementById('ssTitle').textContent = d.title;
  document.getElementById('ssUrl').textContent   = d.url;
  document.getElementById('ssDesc').textContent  = d.desc;
  document.getElementById('shareSheet').classList.add('open');
  document.getElementById('sheetOverlay').classList.add('open');
}

export function closeShare() {
  document.getElementById('shareSheet').classList.remove('open');
  document.getElementById('sheetOverlay').classList.remove('open');
}

export function copyLink() {
  const url = document.getElementById('ssUrl').textContent;
  navigator.clipboard?.writeText('https://' + url).catch(() => {});
  showToast('✓ Посилання скопійовано!');
  closeShare();
}

export function switchFeedTab(tab) {
  const isFeed = tab === 'feed';
  document.getElementById('feedList').style.display  = isFeed ? '' : 'none';
  document.getElementById('chat-body').style.display = isFeed ? 'none' : '';
  const tabFeed = document.getElementById('tab-feed');
  const tabChat = document.getElementById('tab-chat');
  tabFeed.style.color        = isFeed ? 'var(--lime)' : 'var(--muted)';
  tabFeed.style.borderBottom = isFeed ? '2px solid var(--lime)' : '2px solid transparent';
  tabChat.style.color        = isFeed ? 'var(--muted)' : 'var(--sky)';
  tabChat.style.borderBottom = isFeed ? '2px solid transparent' : '2px solid var(--sky)';
  const inp = document.getElementById('composeInput');
  if (inp) inp.placeholder = isFeed ? 'Написати від екіпажу #1...' : 'Написати всім учасникам...';
}

export function sendFeedMsg() {
  const inp = document.getElementById('composeInput');
  const msg = inp?.value.trim();
  if (!msg) return;
  const isChat = document.getElementById('chat-body').style.display !== 'none';
  const list   = document.getElementById(isChat ? 'chat-body' : 'feedList');
  const item   = document.createElement('div');
  item.className = 'feed-item';
  if (isChat) {
    item.innerHTML = `<div class=\"fi-av\" style=\"background:linear-gradient(135deg,var(--lime),var(--sky))\">Я</div><div class=\"fi-body\"><div class=\"fi-header\"><span style=\"font-size:11px;font-weight:800;color:var(--white)\">Ви</span><span class=\"fi-time\">щойно</span></div><div class=\"fi-msg\">${msg}</div></div>`;
  } else {
    item.innerHTML = `<div class=\"fi-av\" style=\"background:linear-gradient(135deg,var(--lime),var(--sky))\">Я</div><div class=\"fi-body\"><div class=\"fi-header\"><span class=\"fi-crew\">#1</span><span class=\"fi-driver\">Ви</span><span class=\"fi-time\">щойно</span></div><div class=\"fi-msg\">${msg}</div><div class=\"fi-meta\"><span class=\"fi-tag ok\">● Мій екіпаж</span></div></div>`;
  }
  list.prepend(item);
  inp.value = '';
  showToast('✓ Повідомлення надіслано');
}

export function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
