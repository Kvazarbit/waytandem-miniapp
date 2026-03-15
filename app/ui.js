import { api, getApiBase } from './api.js?v=22';

let currentView = 'vwelcome';
let joinedCrew = null;
let toastTimer;

// ── Стан реєстрації / профілю
export const userProfile = {
  userId: null,
  name: '',
  city: 'lviv',
  role: 'companion', // 'companion' (client) | 'traveler' (driver)
  car: '',
  seats: 4,
  subscriptions: [],
  isOrganizer: false
};

// ── Стан поїздки
export const tripState = {
  status: 'none', // 'none' | 'pending' | 'active' | 'completed'
  crewId: null,
  role: 'passenger',
  members: [],
  pickup: '',
  pickup_lat: null,
  pickup_lng: null,
  driverDone: false,
  passengerDone: false
};

export function showView(viewId, dir = 'forward', force = false) {
  const views = document.querySelectorAll('.view');
  let target = viewId;
  
  // Мапінг числових ID на рядкові для сумісності
  if (viewId === 'root') target = 'vroot';
  if (viewId === 'reg') target = 'vreg';
  if (viewId === 'home') target = 'vhome';
  if (viewId === 0) target = 'v0';
  if (viewId === '05') target = 'v05';
  if (viewId === 1) target = 'v1';
  if (viewId === 2) target = 'v2';
  if (viewId === 3) target = 'v3';
  if (viewId === 'handshake') target = 'vhandshake';
  if (viewId === 'trip') target = 'vtrip';
  if (viewId === 'trip-active') target = 'vtrip-active';
  if (viewId === 'cancel') target = 'vcancel';
  if (viewId === 'rating') target = 'vrating';
  if (viewId === 'welcome') target = 'vwelcome';
  if (viewId === 'profile' || viewId === 5 || viewId === '5') target = 'v5';
  if (viewId === 'map') target = 'vmap';
  if (viewId === 'home') target = 'vhome';

  const targetView = document.getElementById(target);
  if (!targetView) {
    console.error('Target view not found:', target, 'viewId:', viewId);
    return;
  }

  if (currentView === target && !force) return;
  console.log('Navigating to:', target, 'from:', currentView);

  views.forEach(v => {
    v.classList.remove('active', 'slide-out-left', 'slide-out-right', 'slide-in-right', 'slide-in-left');
  });

  const oldViewEl = document.getElementById(currentView);
  if (oldViewEl && !force) {
    oldViewEl.classList.add(dir === 'forward' ? 'slide-out-left' : 'slide-out-right');
  }

  targetView.classList.add('active');
  if (!force) {
    targetView.classList.add(dir === 'forward' ? 'slide-in-right' : 'slide-in-left');
  }
  
  currentView = target;
  
  // Управління видимістю шапки та меню
  const hdr = document.getElementById('appHdr');
  const nav = document.getElementById('appNav') || document.querySelector('.nav');
  const isWelcome = (target === 'vwelcome');
  
  if (hdr) hdr.style.display = isWelcome ? 'none' : 'flex';
  if (nav) nav.style.display = isWelcome ? 'none' : 'flex';

  // Оновлюємо активну кнопку в меню
  if (!isWelcome) {
    document.querySelectorAll('.nv').forEach(n => n.classList.remove('active'));
    if (target === 'vhome') {
      document.getElementById('nav-home')?.classList.add('active');
    } else if (target === 'vroot' || target === 'v0' || target === 'v05' || target === 'v1' || target === 'v2') {
      document.getElementById('nav-root')?.classList.add('active');
    } else if (target === 'vtrip' || target === 'vtrip-active' || target === 'vhandshake') {
      document.getElementById('nav-trip')?.classList.add('active');
    } else if (target === 'vmap') {
      document.getElementById('nav-map')?.classList.add('active');
    }
  }

  // Додаткова логіка для специфічних екранів
  if (target === 'v5') _renderProfile();
  if (target === 'vmap') _initMainMap();
  _updateHeaderUI();
}

export function goBack(fallback = 'root') {
  if (currentView === 'v0') showView('root', 'back');
  else if (currentView === 'v05') showView(0, 'back');
  else if (currentView === 'v1') showView('05', 'back');
  else if (currentView === 'v2') showView(1, 'back');
  else if (currentView === 'vhandshake') showView(2, 'back');
  else if (currentView === 'vtrip-active') showView(2, 'back');
  else if (currentView === 'vopen-crew') showView(1, 'back');
  else showView(fallback, 'back');
}

function _updateHeaderUI() {
  const pill = document.getElementById('cityPill');
  const av = document.getElementById('avBtn');
  if (pill) {
    const isTraveler = userProfile.role === 'traveler';
    pill.innerHTML = isTraveler ? '🚗 Мандрівник' : '🎒 Попутник';
  }
  if (av) {
    av.textContent = userProfile.name ? userProfile.name.slice(0, 1).toUpperCase() : '?';
  }
}

export function selectRole(role) {
  userProfile.role = role;
  const roleCards = document.querySelectorAll('.role-card');
  if (roleCards.length > 0) {
    roleCards.forEach(c => c.classList.remove('active'));
    const targetCard = document.getElementById('role-' + role);
    if (targetCard) targetCard.classList.add('active');
  }
  const travelerFields = document.getElementById('traveler-fields');
  if (travelerFields) {
    travelerFields.style.display = role === 'traveler' ? 'block' : 'none';
  }
  _updateHeaderUI();
  showView('reg');
}

export function toggleRegRole() {
  const isTraveler = userProfile.role === 'traveler';
  selectRole(isTraveler ? 'companion' : 'traveler');
}

export async function submitRegistration() {
  const nameInput = document.getElementById('regName');
  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) {
    showToast('⚠️ Вкажіть ваше ім\'я');
    return;
  }
  userProfile.name = name;
  userProfile.userId = userProfile.userId || Math.floor(Math.random() * 900000) + 100000;
  if (userProfile.role === 'traveler') {
    const carInput = document.getElementById('regCar');
    if (carInput) userProfile.car = carInput.value.trim();
  }
  localStorage.setItem('wt_profile', JSON.stringify(userProfile));
  showToast('⏳ Зберігаємо профіль...');
  try {
    const res = await api('/api/v3/user/register', {
      method: 'POST',
      body: JSON.stringify({ user_id: userProfile.userId, name: name, role: userProfile.role === 'traveler' ? 'driver' : 'client' })
    });
    if (res && res.status === 'ok' || res.status === 'updated') {
      if (userProfile.role === 'traveler' && userProfile.car) {
        await api('/api/v3/driver/register', { method: 'POST', body: JSON.stringify({ user_id: userProfile.userId, car: userProfile.car, seats: userProfile.seats }) });
      }
      showToast('✅ Профіль створено!');
      _updateHeaderUI();
      window.location.reload();
    }
  } catch (e) { showToast('❌ Помилка реєстрації'); }
}

export function restoreProfile() {
  const saved = localStorage.getItem('wt_profile');
  if (saved) {
    const data = JSON.parse(saved);
    Object.assign(userProfile, data);
    _applyOrganizerUI();
    _updateHeaderUI();
    return true;
  }
  return false;
}

export function hydrateProfileFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const uid = urlParams.get('user_id');
  const name = urlParams.get('name');
  if (uid) {
    userProfile.userId = parseInt(uid);
    userProfile.name = name || userProfile.name || 'Користувач';
    localStorage.setItem('wt_profile', JSON.stringify(userProfile));
    return true;
  }
  return false;
}

function _renderProfile() {
  updateText('profileName', userProfile.name || 'Гість');
  updateText('profileRole', userProfile.role === 'traveler' ? 'Мандрівник' : 'Попутник');
  updateText('profileSeats', userProfile.seats);
  const drvInfo = document.getElementById('profileDriverInfo');
  if (drvInfo) drvInfo.style.display = userProfile.role === 'traveler' ? 'block' : 'none';
  if (userProfile.car) updateText('profileCar', userProfile.car);
}

function updateText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

export function toggleCrew(idx) {
  const el = document.getElementById('crew' + idx);
  if (el) el.classList.toggle('active');
}

export function joinCrew(crewId) {
  showToast('✉️ Запит надіслано водію...');
  showPendingHandshake({ driver_name: 'Олексій', pickup: 'Городоцька, 12' });
}

export function showPendingHandshake(data) {
  const driverEl = document.getElementById('hs-driver');
  const pickupEl = document.getElementById('hs-pickup');
  if (driverEl && data) driverEl.textContent = data.driver_name;
  if (pickupEl && data) pickupEl.textContent = data.pickup;
  showView('handshake');
}

export async function refreshTripTimeline() {
  if (!tripState.crew_id) return;
  try {
    const messages = await api(`/api/v3/trip/messages?crew_id=${tripState.crew_id}`);
    if (messages) {
      _renderTripTimeline(messages);
    }
  } catch (e) { console.error('Failed to fetch timeline:', e); }
}

function _renderTripTimeline(list) {
  const el = document.getElementById('trip-feed-list');
  if (!el) return;
  if (!list || list.length === 0) {
    el.innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px">Поки що немає подій</div>';
    return;
  }
  el.innerHTML = list.map(m => {
    const isSystem = m.kind === 'system';
    const isMe = m.user_id === userProfile.userId;
    const timeStr = new Date(m.created_at * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    if (isSystem) return `<div style="text-align:center;margin:12px 0;font-size:11px;color:var(--muted)">⚙️ ${m.text} • ${timeStr}</div>`;
    return `
      <div class="feed-item" style="border:none;padding:8px 0;display:flex;flex-direction:column;align-items:${isMe ? 'flex-end' : 'flex-start'}">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px">${m.user_name || 'Анонім'} • ${timeStr}</div>
        <div style="background:${isMe ? 'var(--card3)' : 'var(--dim)'};padding:10px 14px;border-radius:14px;max-width:85%;font-size:13px;color:var(--white);line-height:1.4">
          ${m.text}
        </div>
      </div>
    `;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

export async function sendFeedMsg() {
  const input = document.getElementById('composeInput');
  if (!input || !input.value.trim() || !tripState.crew_id) return;
  const text = input.value.trim();
  input.value = '';
  input.disabled = true;
  try {
    const res = await api('/api/v3/trip/message', { method: 'POST', body: JSON.stringify({ crew_id: tripState.crew_id, user_id: userProfile.userId, text: text, kind: 'chat' }) });
    if (res && res.status === 'ok') refreshTripTimeline();
  } catch (e) { showToast('❌ Помилка відправки'); } finally {
    input.disabled = false;
    input.focus();
  }
}

let tripMap = null;
let tripMarker = null;

export function toggleTripMap() {
  const container = document.getElementById('trip-map-container');
  if (!container) return;
  if (container.style.display === 'none') {
    container.style.display = 'block';
    if (tripState.pickup_lat && tripState.pickup_lng) _initLeafletMap(tripState.pickup_lat, tripState.pickup_lng);
  } else container.style.display = 'none';
}

function _initLeafletMap(lat, lng) {
  setTimeout(() => {
    if (!tripMap) {
      tripMap = L.map('trip-map', { zoomControl: false, attributionControl: false }).setView([lat, lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(tripMap);
    } else tripMap.setView([lat, lng], 15);
    if (tripMarker) tripMarker.remove();
    tripMarker = L.marker([lat, lng]).addTo(tripMap);
    tripMap.invalidateSize();
  }, 100);
}

export async function showActiveTrip(data) {
  Object.assign(tripState, data || {});
  tripState.status = 'active';
  const pickupEl = document.getElementById('trip-pickup-text');
  const mapBtn = document.getElementById('btn-toggle-map');
  if (pickupEl) pickupEl.textContent = tripState.pickup || 'Чекаємо координати...';
  if (mapBtn) {
    if (tripState.pickup_lat && tripState.pickup_lng) mapBtn.style.display = 'block';
    else {
      mapBtn.style.display = 'none';
      const container = document.getElementById('trip-map-container');
      if (container) container.style.display = 'none';
    }
  }
  if (!tripState.members || tripState.members.length === 0) {
    if (tripState.driver_id && tripState.direction_id) {
      try {
        const crew = await api(`/api/v3/trip/crew?driver_id=${tripState.driver_id}&direction_id=${tripState.direction_id}`);
        if (crew) {
          const members = [{ user_id: tripState.driver_id, name: tripState.organizer_name || tripState.driver_name || 'Водій', role: 'driver' }];
          crew.forEach(m => { if (m.user_id !== tripState.driver_id) members.push({ user_id: m.user_id, name: m.name, role: 'passenger' }); });
          tripState.members = members;
        }
      } catch (e) { console.error('Failed to fetch crew:', e); }
    }
  }
  _renderTripManifest();
  refreshTripTimeline();
  showView('trip-active');
  if (tripState.viewer_role === 'driver') refreshIncomingRequests();
  else {
    const inc = document.getElementById('trip-incoming-requests');
    if (inc) inc.style.display = 'none';
  }
}

export async function refreshIncomingRequests() {
  if (!userProfile.userId) return;
  try {
    const data = await api('/api/v3/match/pending?scope=incoming&user_id=' + userProfile.userId);
    if (data) _renderIncomingRequests(data);
  } catch (e) { console.error(e); }
}

function _renderIncomingRequests(list) {
  const container = document.getElementById('trip-incoming-requests');
  const listEl = document.getElementById('incoming-list');
  const badge = document.getElementById('incoming-badge');
  if (!container || !listEl) return;
  if (!list || list.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  if (badge) badge.textContent = list.length;
  listEl.innerHTML = list.map(req => {
    const init = (req.partner_name || '?').slice(0, 1).toUpperCase();
    return `
      <div style="display:flex;gap:12px;align-items:center;background:var(--card3);padding:12px;border-radius:14px">
        <div style="width:36px;height:36px;border-radius:12px;background:var(--dim);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff">${init}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--white)">${req.partner_name}</div>
          <div style="font-size:11px;color:var(--muted)">Хоче приєднатися</div>
        </div>
        <div style="display:flex;gap:6px">
          <div style="width:32px;height:32px;border-radius:10px;background:rgba(255,77,77,.1);color:#FF6B6B;display:flex;align-items:center;justify-content:center;cursor:pointer" 
               onclick="window.ui.respondToRequest(${req.partner_id}, ${req.direction_id}, false)">✕</div>
          <div style="width:32px;height:32px;border-radius:10px;background:rgba(201,255,71,.15);color:var(--lime);display:flex;align-items:center;justify-content:center;cursor:pointer" 
               onclick="window.ui.respondToRequest(${req.partner_id}, ${req.direction_id}, true)">✓</div>
        </div>
      </div>
    `;
  }).join('');
}

export async function respondToRequest(partnerId, directionId, accept) {
  if (!userProfile.userId) return;
  showToast(accept ? '⏳ Додаємо до екіпажу...' : '⏳ Відхиляємо запит...');
  try {
    const res = await api('/api/v3/match/respond', { method: 'POST', body: JSON.stringify({ user_id: userProfile.userId, target_id: partnerId, direction_id: directionId, accept: accept }) });
    if (res && res.status === 'ok') {
      showToast(accept ? '✅ Учасника додано!' : '✕ Запит відхилено');
      if (accept) {
        const data = await api('/api/v3/trip/active?user_id=' + userProfile.userId);
        if (data && data.active) showActiveTrip(data);
      } else refreshIncomingRequests();
    } else showToast('❌ Помилка: ' + (res?.reason || 'невідомо'));
  } catch (e) { showToast('❌ Помилка зв\'язку'); console.error(e); }
}

function _renderTripManifest() {
  const el = document.getElementById('trip-manifest-inner');
  if (!el) return;
  const members = (tripState.members || []).sort((a, b) => { if (a.role === 'driver') return -1; if (b.role === 'driver') return 1; return 0; });
  const slots = members.map(m => {
    const init = (m.name || '?').slice(0, 1).toUpperCase();
    const isDriver = m.role === 'driver';
    const cls = isDriver ? 'mi-driver' : 'mi-pax';
    const tgLink = m.user_id ? `tg://user?id=${m.user_id}` : null;
    const clickHandler = tgLink ? `onclick="if(window.Telegram && window.Telegram.WebApp) window.Telegram.WebApp.openTelegramLink('${tgLink}'); else window.open('${tgLink}', '_blank'); event.stopPropagation();"` : '';
    return `<div class="manifest-item ${cls}" ${clickHandler}><div class="mi-av">${init}</div><div class="mi-name">${m.name || '?'}</div><div class="mi-call-ico">📞</div></div>`;
  }).join('');
  el.innerHTML = slots || '<div style="color:var(--muted); font-size:12px; text-align:center; width:100%; padding:20px">Учасників ще немає</div>';
  updateText('trip-direction', tripState.direction_title || 'Поїздка');
  updateText('trip-crew-id', '#' + (tripState.crew_display_id || '—'));
}

export function confirmTripDone(isDriver) {
  if (isDriver) tripState.driverDone = true; else tripState.passengerDone = true;
  if (tripState.driverDone && tripState.passengerDone) { tripState.status = 'completed'; showView('rating'); return; }
  const waitMsg = document.getElementById('trip-wait-msg');
  if (waitMsg) { waitMsg.textContent = isDriver ? '⏳ Чекаємо підтвердження попутника...' : '⏳ Чекаємо підтвердження водія...'; waitMsg.style.display = 'block'; }
  const doneBtn = document.getElementById('trip-done-btn');
  if (doneBtn) doneBtn.style.display = 'none';
  showToast('⏳ Чекаємо підтвердження іншої сторони...');
  api('/api/v3/trip/done', { method: 'POST', body: JSON.stringify({ request_id: tripState.id, user_id: userProfile.userId }) });
}

export function submitRating(val) {
  tripState.status = 'none';
  document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('rating-' + val);
  if (btn) btn.classList.add('active');
  api('/api/v3/rating', { method: 'POST', body: JSON.stringify({ request_id: tripState.id, from_user_id: userProfile.userId, to_user_id: tripState.partner_id, score: val }) });
  showToast('❤️ Дякуємо!');
  setTimeout(() => window.location.reload(), 1200);
}

export function requestCancel() { showView('cancel'); }
export function confirmCancel() {
  api('/api/v3/trip/cancel', { method: 'POST', body: JSON.stringify({ request_id: tripState.id, user_id: userProfile.userId }) });
  tripState.status = 'none';
  showToast('✖️ Запит на скасування надіслано');
  showView('root', 'back');
}

export function switchFeedTab(tab) {
  const isFeed = tab === 'feed';
  const feedList = document.getElementById('feedList');
  const chatBody = document.getElementById('chat-body');
  if (feedList) feedList.style.display = isFeed ? '' : 'none';
  if (chatBody) chatBody.style.display = isFeed ? 'none' : '';
  const tabFeed = document.getElementById('tab-feed');
  const tabChat = document.getElementById('tab-chat');
  if (tabFeed) { tabFeed.style.color = isFeed ? 'var(--lime)' : 'var(--muted)'; tabFeed.style.borderBottom = isFeed ? '2px solid var(--lime)' : '2px solid transparent'; }
  if (tabChat) { tabChat.style.color = isFeed ? 'var(--muted)' : 'var(--sky)'; tabChat.style.borderBottom = isFeed ? '2px solid transparent' : '2px solid var(--sky)'; }
  const inp = document.getElementById('composeInput');
  if (inp) inp.placeholder = isFeed ? 'Написати від екіпажу...' : 'Написати всім учасникам...';
}

export function updateProfileSeats(delta) {
  let s = (userProfile.seats || 4) + delta;
  if (s < 1) s = 1; if (s > 4) s = 4;
  userProfile.seats = s;
  const sv = document.getElementById('settingsSeatsValue'); if (sv) sv.textContent = s;
  const ps = document.getElementById('profileSeats'); if (ps) ps.textContent = s;
  localStorage.setItem('wt_profile', JSON.stringify(userProfile));
  if (userProfile.role === 'traveler' && userProfile.userId) api('/api/v3/driver/seats', { method: 'POST', body: JSON.stringify({ user_id: userProfile.userId, seats: s }) });
}

export function toggleOrganizerFlag() {
  userProfile.isOrganizer = !userProfile.isOrganizer;
  _applyOrganizerUI();
  localStorage.setItem('wt_profile', JSON.stringify(userProfile));
  showToast(userProfile.isOrganizer ? '🎯 Режим організатора увімкнено' : 'Режим організатора вимкнено');
}

function _applyOrganizerUI() {
  const on = !!userProfile.isOrganizer;
  const checkStyle = on ? 'width:22px;height:22px;border-radius:6px;background:var(--gold);border:2px solid var(--gold);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s' : 'width:22px;height:22px;border-radius:6px;border:2px solid rgba(245,158,11,.4);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s';
  const checkInner = on ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#07090E" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '';
  const wCheck = document.getElementById('ob-org-check'); if (wCheck) { wCheck.style.cssText = checkStyle; wCheck.innerHTML = checkInner; }
  const wCard = document.getElementById('ob-organizer-card'); if (wCard) { wCard.style.border = on ? '1px solid rgba(245,158,11,.5)' : '1px solid rgba(245,158,11,.2)'; wCard.style.background = on ? 'rgba(245,158,11,.06)' : ''; }
  const sCheck = document.getElementById('settingsOrgCheck'); if (sCheck) { sCheck.style.cssText = checkStyle; sCheck.innerHTML = checkInner; }
  const sCard = document.getElementById('settingsOrgCard'); if (sCard) sCard.style.background = on ? 'rgba(245,158,11,.06)' : 'var(--card)';
  const btnDir = document.getElementById('btn-create-direction');
  const btnTrip = document.getElementById('btn-create-trip');
  const btnProp = document.getElementById('btn-propose-direction');
  const btnHome = document.getElementById('btn-home-organizer');
  
  if (btnDir) btnDir.style.display = on ? '' : 'none';
  if (btnTrip) btnTrip.style.display = on ? '' : 'none';
  if (btnProp) btnProp.style.display = on ? '' : 'none';
  if (btnHome) btnHome.style.display = on ? '' : 'none';
}

let selectionMap = null;
let selectionMarker = null;
export const selectionState = { lat: null, lng: null, directionId: null };

export function initSelectionMap() {
  let currentPos = [49.8397, 24.0297];
  setTimeout(() => {
    if (!selectionMap) {
      selectionMap = L.map('selection-map', { zoomControl: false, attributionControl: false }).setView(currentPos, 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(selectionMap);
      selectionMap.on('click', async (e) => {
        const { lat, lng } = e.latlng; selectionState.lat = lat; selectionState.lng = lng;
        if (selectionMarker) selectionMarker.remove(); selectionMarker = L.marker([lat, lng]).addTo(selectionMap);
        const label = document.getElementById('pickup-coords-label'); if (label) label.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        const pInput = document.getElementById('open-crew-pickup');
        if (pInput) { pInput.value = '⏳ Визначаємо адресу...'; try { const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, { headers: { 'Accept-Language': 'uk,ru,en' } }); const geo = await r.json(); if (geo && geo.display_name) { const addr = geo.address; const street = addr.road || addr.pedestrian || addr.suburb || addr.city || ''; const house = addr.house_number || ''; pInput.value = house ? `${street}, ${house}` : street; } else pInput.value = ''; } catch { pInput.value = ''; } }
      });
      if (navigator.geolocation) { navigator.geolocation.getCurrentPosition((pos) => { const lat = pos.coords.latitude, lng = pos.coords.longitude; selectionMap.setView([lat, lng], 15); selectionState.lat = lat; selectionState.lng = lng; if (selectionMarker) selectionMarker.remove(); selectionMarker = L.marker([lat, lng]).addTo(selectionMap); const label = document.getElementById('pickup-coords-label'); if (label) label.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`; }); }
    } else { if (selectionMarker) selectionMarker.remove(); selectionMarker = null; selectionState.lat = null; selectionState.lng = null; const label = document.getElementById('pickup-coords-label'); if (label) label.textContent = 'координати не обрано'; selectionMap.setView(currentPos, 13); }
    selectionMap.invalidateSize();
  }, 100);
}

export async function submitOpenCrew() {
  const pInput = document.getElementById('open-crew-pickup');
  const sInput = document.getElementById('open-crew-seats');
  const pickup = pInput?.value.trim(); const seats = parseInt(sInput?.value || '4'); const dirId = selectionState.directionId;
  if (!pickup) { showToast('⚠️ Вкажіть місце зустрічі'); return; }
  showToast('⏳ Відкриваємо набір...');
  try {
    const res = await api('/api/v3/crews/open', { method: 'POST', body: JSON.stringify({ user_id: userProfile.userId, direction_id: dirId, pickup: pickup, seats: seats, pickup_lat: selectionState.lat, pickup_lng: selectionState.lng }) });
    if (res && res.status === 'ok') { showToast('🚀 Набір відкрито!'); if (pInput) pInput.value = ''; window.drillToCrews(dirId); }
    else showToast('❌ Помилка: ' + (res?.reason || 'невідомо'));
  } catch { showToast('❌ Помилка зв\'язку'); }
}

export function openCrewForm() {
  if (!userProfile.userId) return;
  const dirId = window.currentDirectionId;
  if (!dirId) { showToast('⚠️ Оберіть напрямок'); return; }
  selectionState.directionId = dirId; showView('vopen-crew'); initSelectionMap();
}

let mainMap = null;
let mainMarkers = [];

export async function refreshMainMap() {
  if (!getApiBase()) return;
  try {
    const crews = await api('/api/v3/map/crews');
    if (crews) _renderMainMapMarkers(crews);
  } catch (e) { console.error('Failed to fetch map crews:', e); }
}

function _initMainMap() {
  const defaultPos = [49.8397, 24.0297];
  setTimeout(() => {
    if (!mainMap) {
      mainMap = L.map('main-map', { zoomControl: false, attributionControl: false }).setView(defaultPos, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mainMap);
    }
    mainMap.invalidateSize();
    refreshMainMap();
  }, 100);
}

function _renderMainMapMarkers(list) {
  if (!mainMap) return;
  mainMarkers.forEach(m => m.remove());
  mainMarkers = [];
  list.forEach(c => {
    if (!c.lat || !c.lng) return;
    const icon = L.divIcon({
      html: `<div style="background:var(--card); border:2px solid var(--lime); border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.3); font-size:18px">🚗</div>`,
      className: 'custom-map-icon', iconSize: [36, 36], iconAnchor: [18, 36]
    });
    const m = L.marker([c.lat, c.lng], { icon }).addTo(mainMap);
    m.bindPopup(`<div style="padding:4px; font-family:'Manrope',sans-serif"><div style="font-weight:800; font-size:13px; color:#fff; margin-bottom:4px">${c.direction_title}</div><div style="font-size:11px; color:#aaa; margin-bottom:8px">Водій: ${c.organizer_name}</div><div style="background:var(--lime); color:#000; font-size:10px; font-weight:700; padding:6px; border-radius:6px; text-align:center; cursor:pointer" onclick="window.ui.showMapCrewDetails(${c.direction_id}, ${c.organizer_id})">Переглянути екіпаж</div></div>`, { backgroundColor: 'var(--bg)', color: '#fff' });
    mainMarkers.push(m);
  });
}

export function showMapCrewDetails(dirId, orgId) {
  if (window.drillToOrg) window.drillToOrg(dirId, orgId);
}

export function openShare() { const el = document.getElementById('shareModal'); if (el) el.style.display = 'flex'; }
export function closeShare() { const el = document.getElementById('shareModal'); if (el) el.style.display = 'none'; }
export async function copyLink() {
  const link = `https://t.me/WayTandemBot/app?startapp=dir_${window.currentDirectionId || ''}`;
  try { await navigator.clipboard.writeText(link); showToast('✅ Посилання скопійовано!'); } catch { showToast('❌ Помилка копіювання'); }
}

export function drillToSubcat(id) { if (window.fractal && window.fractal.drillToSubcat) window.fractal.drillToSubcat(id); }
export function drillToOrg(id) { if (window.fractal && window.fractal.drillToOrg) window.fractal.drillToOrg(id); }
export function drillToCrews(id) { if (window.fractal && window.fractal.drillToCrews) window.fractal.drillToCrews(id); }
export function toggleOrg(idx, event) { if (event) event.stopPropagation(); }

export function showToast(msg) {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
