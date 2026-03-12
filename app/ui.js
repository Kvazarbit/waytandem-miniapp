import { api, getApiBase } from './api.js';

let currentView = 'welcome';
let joinedCrew = null;
let toastTimer;

// ── Стан реєстрації / профілю
export const userProfile = {
  userId: null,
  name: '',
  city: 'lviv',
  role: 'traveler',   // 'traveler' | 'companion'
  car: '',
  seats: 4,
  registered: false,
  isOrganizer: false,
};

// ── Стан поточної поїздки
export const tripState = {
  crewId: null,
  organizerName: '',
  directionTitle: '',
  driverName: '',
  car: '',
  pickup: '',
  departureDate: '',
  members: [],
  status: 'none',
  driverDone: false,
  passengerDone: false,
};

export function selectRole(role) {
  userProfile.role = role;
  toggleRegRole(role);
  showView('reg');
}

export function submitRegistration() {
  const name = document.getElementById('regName')?.value?.trim();
  if (!name) { showToast('Введи своє ім\'я'); return; }
  userProfile.name = name;
  userProfile.city = document.getElementById('regCity')?.value || 'lviv';
  userProfile.car = document.getElementById('regCar')?.value?.trim() || '';
  userProfile.seats = Number(document.getElementById('regSeats')?.value || 4);
  userProfile.registered = true;

  const savedUid = localStorage.getItem('wt_user_id');
  if (savedUid) userProfile.userId = Number(savedUid);

  const av = document.getElementById('avBtn');
  const profileName = document.getElementById('profileName');
  const profileAvatar = document.getElementById('profileAvatar');
  const greeting = document.getElementById('homeGreeting');
  const initials = name.slice(0, 1).toUpperCase();
  if (av) av.textContent = initials;
  if (profileName) profileName.textContent = name;
  if (profileAvatar) profileAvatar.textContent = initials;
  if (greeting) greeting.textContent = 'Привіт, ' + name + '! 👋';

  const ps = document.getElementById('profileSeats');
  if (ps) ps.textContent = userProfile.seats;

  localStorage.setItem('wt_profile', JSON.stringify(userProfile));

  if (userProfile.role === 'traveler' && userProfile.userId) {
    api('/api/v3/driver/seats', {
      method: 'POST',
      body: JSON.stringify({ user_id: userProfile.userId, seats: userProfile.seats })
    });
  }

  showToast('✅ Реєстрацію збережено!');
  showView('root');
}

export function restoreProfile() {
  try {
    const saved = localStorage.getItem('wt_profile');
    if (!saved) return false;
    const p = JSON.parse(saved);
    Object.assign(userProfile, p);
    _applyProfileToUI();
    if (p.isOrganizer) {
      requestAnimationFrame(() => _applyOrganizerUI());
    }
    return p.registered === true;
  } catch { return false; }
}

export function hydrateProfileFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('user_id');
  const name = urlParams.get('name');
  const role = urlParams.get('role');
  const city = urlParams.get('city');
  const car = urlParams.get('car');
  const seats = urlParams.get('seats');

  if (name) userProfile.name = name;
  else if (userId && !userProfile.name) userProfile.name = 'Користувач #' + userId;

  if (role && (role === 'traveler' || role === 'companion')) {
    userProfile.role = role;
  }
  if (city) userProfile.city = city;
  if (car) userProfile.car = car;
  if (seats) userProfile.seats = Number(seats);

  if (userId || name || role || city || car || seats) {
    if (userId) userProfile.userId = Number(userId);
    userProfile.registered = true;
    _applyProfileToUI();
    localStorage.setItem('wt_profile', JSON.stringify(userProfile));
    return true;
  }
  return false;
}

function _applyProfileToUI() {
  const { name, role } = userProfile;
  const av = document.getElementById('avBtn');
  const profileName = document.getElementById('profileName');
  const profileAvatar = document.getElementById('profileAvatar');
  const greeting = document.getElementById('homeGreeting');
  const cityPill = document.getElementById('cityPill');

  const initials = (name || '').slice(0, 1).toUpperCase();
  if (av && name) av.textContent = initials;
  if (profileName && name) profileName.textContent = name;
  if (profileAvatar && name) profileAvatar.textContent = initials;
  if (greeting && name) greeting.textContent = 'Привіт, ' + name + '! 👋';

  if (cityPill) {
    const roleMap = { traveler: '🚗 Мандрівник', companion: '🤝 Попутник' };
    cityPill.textContent = roleMap[role] || '👤 Роль';
  }

  const ps = document.getElementById('profileSeats');
  if (ps) ps.textContent = userProfile.seats || 4;

  const sv = document.getElementById('settingsSeatsValue');
  if (sv) sv.textContent = userProfile.seats || 4;

  const sc = document.getElementById('profileSeatsControl');
  if (sc) sc.style.display = (role === 'traveler') ? 'block' : 'none';
}

export function toggleRegRole(role) {
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('on'));
  const btn = document.getElementById('rb-' + role);
  if (btn) btn.classList.add('on');
  const carField = document.getElementById('carField');
  const seatsField = document.getElementById('seatsField');
  if (!carField || !seatsField) return;
  if (role === 'companion') {
    carField.style.display = 'none';
    seatsField.style.display = 'none';
  } else {
    carField.style.display = 'block';
    seatsField.style.display = 'block';
  }
}

export function showView(n, dir = 'forward', force = false) {
  const curEl = document.getElementById('v' + currentView);
  const nextEl = document.getElementById('v' + n);
  if (!nextEl || (currentView === n && !force)) return;

  const hdr = document.getElementById('appHdr');
  const nav = document.getElementById('appNav');

  if (n === 'welcome' || n === 'reg' || n === 'rating' || n === 'cancel' || n === 'handshake') {
    if (hdr) hdr.style.display = 'none';
    if (nav) nav.style.display = 'none';
  } else {
    if (hdr) hdr.style.display = 'flex';
    if (nav) { nav.style.removeProperty('display'); nav.style.display = 'flex'; }
  }

  if (curEl && curEl !== nextEl) {
    curEl.classList.remove('active');
    if (dir === 'forward') {
      curEl.classList.add('out');
      setTimeout(() => curEl.classList.remove('out'), 350);
    } else {
      curEl.style.transition = 'transform .3s cubic-bezier(.4,0,.2,1), opacity .25s';
      curEl.style.transform = 'translateX(100%)';
      curEl.style.opacity = '0';
      setTimeout(() => {
        curEl.style.transform = '';
        curEl.style.opacity = '';
        curEl.style.transition = '';
      }, 350);
    }
  }

  if (dir === 'back') {
    nextEl.style.transition = 'none';
    nextEl.style.transform = 'translateX(-28%)';
    nextEl.style.opacity = '0';
    nextEl.getBoundingClientRect();
    nextEl.style.transition = '';
    nextEl.style.transform = '';
    nextEl.style.opacity = '';
  }
  nextEl.classList.add('active');

  if (nav) {
    const nvs = nav.querySelectorAll('.nv');
    nvs.forEach(el => { el.classList.remove('on'); el.style.color = ''; });
    const setNav = (idx, color) => { if (nvs[idx]) { nvs[idx].classList.add('on'); nvs[idx].style.color = color; } };
    if (n === 'home') setNav(0, 'var(--lime)');
    else if (n === 'root' || n === 0 || n === '05' || n === 1 || n === 2 || n === 3) setNav(1, 'var(--lime)');
    else if (n === 'trip' || n === 'trip-active' || n === 'handshake') setNav(2, 'var(--lime)');
    else if (n === 'map') setNav(3, 'var(--sky)');
  }

  currentView = n;
}

export function drillToSubcat() { showView('05'); }
export function drillToOrg() { showView(1); }
export function drillToCrews() { showView(2); }

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
  const card = document.getElementById('crew' + n);
  if (!card) return;
  const btn = card.querySelector('.join-lime');
  if (btn) {
    btn.innerHTML = '✓ Запит надіслано — чекаємо водія';
    btn.style.cssText = 'background:rgba(201,255,71,.1);color:var(--lime);box-shadow:none;border:1px solid rgba(201,255,71,.2);width:100%;padding:11px;border-radius:10px;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:10px';
  }
  const freeSeat = card.querySelector('.seat.free');
  if (freeSeat) {
    freeSeat.style.background = 'rgba(201,255,71,.35)';
    freeSeat.style.borderColor = 'var(--lime)';
    freeSeat.classList.remove('free-pulse');
  }
  showPendingHandshake(n);
  api('/api/v3/handshake', { method: 'POST', body: JSON.stringify({ crew_id: n }) });
}

export function showPendingHandshake(crewN) {
  const el = document.getElementById('vhandshake');
  if (!el) return;
  const driverEl = document.getElementById('hs-driver');
  const pickupEl = document.getElementById('hs-pickup');
  const card = document.getElementById('crew' + crewN);
  if (driverEl && card) driverEl.textContent = card.querySelector('.crew-driver')?.textContent || '#' + crewN;
  if (pickupEl && card) pickupEl.textContent = card.querySelector('.crew-car')?.textContent || '';
  showView('handshake');
}

export function showActiveTrip(data) {
  Object.assign(tripState, data || {});
  tripState.status = 'active';
  _renderTripManifest();
  showView('trip-active');
}

function _renderTripManifest() {
  const el = document.getElementById('trip-manifest-inner');
  if (!el) return;
  const slots = (tripState.members || []).map(m => {
    const init = (m.name || '?').slice(0, 1).toUpperCase();
    const cls = m.role === 'driver' ? 'ms-driver' : 'ms-pax';
    const role = m.role === 'driver' ? 'Водій' : 'Учасник';
    return '<div class="manifest-slot">' +
      '<div class="ms-bubble ' + cls + '">' + init + '</div>' +
      '<div class="ms-name">' + (m.name || '?') + '</div>' +
      '<div class="ms-status">' + role + '</div>' +
      '</div>';
  }).join('');
  el.innerHTML = slots;
  const dir = document.getElementById('trip-direction');
  if (dir) dir.textContent = tripState.directionTitle || 'Поїздка';
  const crew = document.getElementById('trip-crew-id');
  if (crew) crew.textContent = '#' + (tripState.crewId || '—');
}

export function confirmTripDone(isDriver) {
  if (isDriver) tripState.driverDone = true;
  else tripState.passengerDone = true;

  if (tripState.driverDone && tripState.passengerDone) {
    tripState.status = 'completed';
    showView('rating');
    return;
  }

  const waitMsg = document.getElementById('trip-wait-msg');
  if (waitMsg) {
    waitMsg.textContent = isDriver
      ? '⏳ Чекаємо підтвердження попутника...'
      : '⏳ Чекаємо підтвердження водія...';
    waitMsg.style.display = 'block';
  }
  const doneBtn = document.getElementById('trip-done-btn');
  if (doneBtn) doneBtn.style.display = 'none';
  showToast('⏳ Чекаємо підтвердження іншої сторони...');
  api('/api/v3/trip/done', { method: 'POST', body: JSON.stringify({ crew_id: tripState.crewId, role: userProfile.role }) });
}

export function submitRating(val) {
  tripState.status = 'none';
  document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('rating-' + val);
  if (btn) btn.classList.add('active');
  api('/api/v3/rating', { method: 'POST', body: JSON.stringify({ crew_id: tripState.crewId, rating: val }) });
  showToast('❤️ Дякуємо!');
  setTimeout(() => showView('root'), 1200);
}

export function requestCancel() {
  showView('cancel');
}

export function confirmCancel() {
  api('/api/v3/cancel', { method: 'POST', body: JSON.stringify({ crew_id: tripState.crewId }) });
  tripState.status = 'none';
  tripState.crewId = null;
  showToast('✖️ Запит на скасування надіслано водію');
  showView(2, 'back');
}

// ── Share (залишаємо як no-op щоб не ламати імпорти в main.js)
export function openShare() {}
export function closeShare() {}
export function copyLink() {}

export function switchFeedTab(tab) {
  const isFeed = tab === 'feed';
  document.getElementById('feedList').style.display = isFeed ? '' : 'none';
  document.getElementById('chat-body').style.display = isFeed ? 'none' : '';
  const tabFeed = document.getElementById('tab-feed');
  const tabChat = document.getElementById('tab-chat');
  tabFeed.style.color = isFeed ? 'var(--lime)' : 'var(--muted)';
  tabFeed.style.borderBottom = isFeed ? '2px solid var(--lime)' : '2px solid transparent';
  tabChat.style.color = isFeed ? 'var(--muted)' : 'var(--sky)';
  tabChat.style.borderBottom = isFeed ? '2px solid transparent' : '2px solid var(--sky)';
  const inp = document.getElementById('composeInput');
  if (inp) inp.placeholder = isFeed ? 'Написати від екіпажу #1...' : 'Написати всім учасникам...';
}

export function sendFeedMsg() {
  const inp = document.getElementById('composeInput');
  const msg = inp?.value.trim();
  if (!msg) return;
  const isChat = document.getElementById('chat-body').style.display !== 'none';
  const list = document.getElementById(isChat ? 'chat-body' : 'feedList');
  const item = document.createElement('div');
  item.className = 'feed-item';
  if (isChat) {
    item.innerHTML = '<div class="fi-av" style="background:linear-gradient(135deg,var(--lime),var(--sky))">Я</div><div class="fi-body"><div class="fi-header"><span style="font-size:11px;font-weight:800;color:var(--white)">Ви</span><span class="fi-time">щойно</span></div><div class="fi-msg">' + msg + '</div></div>';
  } else {
    item.innerHTML = '<div class="fi-av" style="background:linear-gradient(135deg,var(--lime),var(--sky))">Я</div><div class="fi-body"><div class="fi-header"><span class="fi-crew">#1</span><span class="fi-driver">Ви</span><span class="fi-time">щойно</span></div><div class="fi-msg">' + msg + '</div><div class="fi-meta"><span class="fi-tag ok">● Мій екіпаж</span></div></div>';
  }
  list.prepend(item);
  inp.value = '';
  showToast('✓ Повідомлення надіслано');
}

export function updateProfileSeats(delta) {
  let s = (userProfile.seats || 4) + delta;
  if (s < 1) s = 1;
  if (s > 4) s = 4;
  userProfile.seats = s;
  const sv = document.getElementById('settingsSeatsValue');
  if (sv) sv.textContent = s;
  const ps = document.getElementById('profileSeats');
  if (ps) ps.textContent = s;
  localStorage.setItem('wt_profile', JSON.stringify(userProfile));
  if (userProfile.role === 'traveler' && userProfile.userId) {
    api('/api/v3/driver/seats', {
      method: 'POST',
      body: JSON.stringify({ user_id: userProfile.userId, seats: s })
    });
  }
}

// ── Флаг ОРГАНІЗАТОРА
// Додаткова роль — показує кнопки створення. Не замінює основну роль.
export function toggleOrganizerFlag() {
  userProfile.isOrganizer = !userProfile.isOrganizer;
  _applyOrganizerUI();
  localStorage.setItem('wt_profile', JSON.stringify(userProfile));
  showToast(userProfile.isOrganizer ? '🎯 Режим організатора увімкнено' : 'Режим організатора вимкнено');
}

function _applyOrganizerUI() {
  const on = !!userProfile.isOrganizer;
  const checkStyle = on
    ? 'width:22px;height:22px;border-radius:6px;background:var(--gold);border:2px solid var(--gold);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s'
    : 'width:22px;height:22px;border-radius:6px;border:2px solid rgba(245,158,11,.4);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s';
  const checkInner = on
    ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#07090E" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
    : '';

  const wCheck = document.getElementById('ob-org-check');
  if (wCheck) { wCheck.style.cssText = checkStyle; wCheck.innerHTML = checkInner; }

  const wCard = document.getElementById('ob-organizer-card');
  if (wCard) {
    wCard.style.border = on ? '1px solid rgba(245,158,11,.5)' : '1px solid rgba(245,158,11,.2)';
    wCard.style.background = on ? 'rgba(245,158,11,.06)' : '';
  }

  const sCheck = document.getElementById('settingsOrgCheck');
  if (sCheck) { sCheck.style.cssText = checkStyle; sCheck.innerHTML = checkInner; }

  const sCard = document.getElementById('settingsOrgCard');
  if (sCard) sCard.style.background = on ? 'rgba(245,158,11,.06)' : 'var(--card)';

  const btnDir = document.getElementById('btn-create-direction');
  const btnTrip = document.getElementById('btn-create-trip');
  if (btnDir) btnDir.style.display = on ? '' : 'none';
  if (btnTrip) btnTrip.style.display = on ? '' : 'none';
}

export function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

