import { api, getApiBase } from './api.js';
import { showView, showToast } from './ui.js';
import { tg } from './telegram.js';

const PALETTES = [
  {
    glow: 'rgba(201,255,71,.08)',
    bg: 'linear-gradient(135deg,var(--lime),#A8E030)',
    stroke: 'var(--lime)',
    emoji: '🏕️',
  },
  {
    glow: 'rgba(77,207,255,.07)',
    bg: 'linear-gradient(135deg,var(--sky),#60A5FA)',
    stroke: 'var(--sky)',
    emoji: '🤝',
  },
  {
    glow: 'rgba(255,184,48,.07)',
    bg: 'linear-gradient(135deg,var(--gold),#F97316)',
    stroke: 'var(--gold)',
    emoji: '🚗',
  },
  {
    glow: 'rgba(255,107,138,.06)',
    bg: 'linear-gradient(135deg,var(--rose),#a78bfa)',
    stroke: 'var(--rose)',
    emoji: '✨',
  },
];

const state = {
  lang: document.documentElement.lang || 'uk',
  userId: null,
  rootId: null,
  rootTitle: '',
  parentId: null,
  parentTitle: '',
  directionId: null,
  directionTitle: '',
  organizerId: null,
  organizerName: '',
  dirIndex: new Map(),
};

let subFooterHtml = null;
let orgFooterHtml = null;

function _captureFooterHtml(container, keepClass) {
  try {
    return Array.from(container.children)
      .filter(el => !el.classList.contains(keepClass))
      .map(el => el.outerHTML)
      .join('');
  } catch {
    return '';
  }
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pickPalette(title, idx) {
  const lower = (title || '').toLowerCase();
  if (lower.includes('відпоч') || lower.includes('карпат') || lower.includes('гори')) return PALETTES[0];
  if (lower.includes('служ') || lower.includes('волон') || lower.includes('сервіс')) return PALETTES[1];
  if (lower.includes('робот') || lower.includes('доїзд') || lower.includes('praca')) return PALETTES[2];
  return PALETTES[idx % PALETTES.length];
}

function updateText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setCrumbActive(containerId, value) {
  const container = document.getElementById(containerId);
  const active = container?.querySelector('.crumb-seg.active');
  if (active) active.textContent = value;
}

function buildQuery(params) {
  const qp = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && String(val).trim() !== '') qp.set(key, String(val));
  });
  const str = qp.toString();
  return str ? `?${str}` : '';
}

function resolveUserId() {
  const tgId = tg?.initDataUnsafe?.user?.id;
  if (tgId) return tgId;

  const urlParams = new URLSearchParams(window.location.search);
  const qp = urlParams.get('user_id');
  if (qp && /^\d+$/.test(qp)) {
    localStorage.setItem('wt_user_id', qp);
    return Number(qp);
  }

  const saved = localStorage.getItem('wt_user_id');
  if (saved && /^\d+$/.test(saved)) return Number(saved);
  return null;
}

function indexDirections(list) {
  if (!Array.isArray(list)) return;
  list.forEach(item => {
    if (item && item.id) state.dirIndex.set(item.id, item);
  });
}

function getDirectionTitle(id) {
  return state.dirIndex.get(id)?.title || '';
}

async function loadRoot() {
  const data = await api(`/api/v3/fractal${buildQuery({ lang: state.lang, user_id: state.userId })}`);
  if (!data || !Array.isArray(data.interests)) return null;
  indexDirections(data.interests);
  return data.interests;
}

async function loadChildren(parentId) {
  const data = await api(`/api/v3/board${buildQuery({ parent_id: parentId, lang: state.lang, user_id: state.userId })}`);
  if (!data || !Array.isArray(data)) return null;
  indexDirections(data);
  return data;
}

async function loadOrganizers(directionId) {
  const data = await api(`/api/v3/fractal/organizers${buildQuery({ direction_id: directionId, lang: state.lang, user_id: state.userId })}`);
  if (!data || !Array.isArray(data.organizers)) return null;
  return data;
}

async function loadCrews(organizerId, directionId) {
  const data = await api(`/api/v3/fractal/crews${buildQuery({ organizer_id: organizerId, direction_id: directionId, user_id: state.userId })}`);
  if (!data || !Array.isArray(data.crews)) return null;
  return data;
}

function rootCardHtml(item, idx) {
  const palette = pickPalette(item.title, idx);
  return `
      <div class="int-card" style="--glow:${palette.glow}">
        <div class="ic-top" style="position:relative; z-index:2" onclick="openRoot(${item.id})">
          <div class="ic-emoji" style="background:${palette.bg};color:#07090E">${palette.emoji}</div>
          <div class="ic-body">
            <div class="ic-name">${esc(item.title)}</div>
            <div class="ic-desc">${esc(item.has_kids ? 'Обери піднапрямок' : 'Перейти далі')}</div>
          </div>
          <div class="ic-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${palette.stroke}" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      </div>
  `;
}

function childCardHtml(item, idx) {
  const palette = pickPalette(item.title, idx);
  const handler = item.has_kids ? `drillToSubcat(${item.id})` : `drillToOrg(${item.id})`;
  return `
      <div class="int-card" style="--glow:${palette.glow}">
        <div class="ic-top" style="position:relative; z-index:2" onclick="${handler}">
          <div class="ic-emoji">${esc(palette.emoji)}</div>
          <div class="ic-body">
            <div class="ic-name">${esc(item.title)}</div>
            <div class="ic-desc">${esc(item.has_kids ? 'Детальніше →' : 'Організатори та екіпажі')}</div>
          </div>
          <div class="ic-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${palette.stroke}" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      </div>
  `;
}

function locationCardHtml(item, idx) {
  const palette = pickPalette(item.title, idx);
  const meta = `${item.drivers || 0} орг. · ${item.passengers || 0} підписані · ${item.seats_total || 0} місць`;
  return `
      <div class="org-card">
        <div class="org-head" onclick="drillToOrg(${item.id})">
          <div class="org-av" style="background:${palette.glow};color:${palette.stroke};font-size:18px">📍</div>
          <div class="org-body">
            <div class="org-name">${esc(item.title)}</div>
            <div class="org-date">${esc(meta)}</div>
          </div>
          <div class="org-head-chevron" style="background:transparent">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      </div>
  `;
}

function organizerCardHtml(item, idx) {
  const palette = pickPalette(item.name, idx);
  const dateText = item.departure ? `🗓 ${esc(item.departure)}` : '🗓 Організатор';
  const seatsText = `${item.seats_free || 0} місць`;
  const chips = [
    `👥 ${item.members || 0} учасників`,
    `🚗 ${item.crews_count || 0} екіпажів`,
    `⭐ ${item.rating?.toFixed?.(1) || item.rating || 0}`,
  ];
  const initial = (item.name || '?').trim().slice(0, 1) || '?';
  return `
      <div class="org-card" id="org${idx + 1}">
        <div class="org-head" onclick="toggleOrg(${idx + 1}, event)">
          <div class="org-av" style="background:${palette.bg};color:#07090E">${esc(initial)}</div>
          <div class="org-body">
            <div class="org-name">${esc(item.name || '?')} — ${esc(item.group_name || state.directionTitle || '')}</div>
            <div class="org-date">${dateText}</div>
          </div>
          <div class="org-badge" style="background:rgba(201,255,71,.1);color:var(--lime)">${esc(seatsText)}</div>
          <div class="org-head-chevron">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--sky)" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="org-info">
          <div class="oi-chip">${chips[0]}</div>
          <div class="oi-chip">${chips[1]}</div>
          <div class="oi-chip">${chips[2]}</div>
        </div>
        <div class="org-actions">
          <div class="oa-btn oa-ghost" onclick="event.stopPropagation(); showToast('💬 Чат відкрито...')">✉️ Написати</div>
          <div class="oa-btn oa-sky" onclick="event.stopPropagation(); drillToCrews(${item.user_id})">🚗 Екіпажі →</div>
        </div>
      </div>
  `;
}

function seatHtml(seat) {
  if (seat?.type === 'driver') return '<div class="seat driver" title="Водій"></div>';
  if (seat?.type === 'taken') return '<div class="seat taken"></div>';
  return '<div class="seat free free-pulse"></div>';
}

function memberHtml(member) {
  const name = (member?.name || '?').trim();
  const initial = name.slice(0, 1) || '?';
  const role = member?.role === 'driver' ? 'водій' : 'попутник';
  return `
      <div class="cd-member">
        <div class="cd-av" style="background:linear-gradient(135deg,var(--sky),var(--lime))">${esc(initial)}</div>
        <div class="cd-role">${role}</div>
      </div>
  `;
}

function crewCardHtml(item, idx) {
  const crewId = item.crew_id;
  const isFree = (item.seats_free || 0) > 0;
  const seats = (item.seat_list || []).map(seatHtml).join('');
  const members = (item.members || []).map(memberHtml).join('');

  const freeSlots = Math.max(0, (item.seats_total || 4) - 1 - (item.seats_used || 0));
  const emptySlots = Array.from({ length: freeSlots }, () => `
      <div class="cd-member">
        <div class="cd-empty">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
        <div class="cd-role" style="color:var(--lime)">вільно</div>
      </div>
  `).join('');

  // BAN-4: кнопки фільтруються за роллю — Мандрівник НЕ бачить "Зайняти місце"
  const role = window.userProfile?.role || 'companion';
  let actionBtns = '';
  if (role === 'companion') {
    if (isFree) {
      actionBtns = `<div class="join-btn join-lime" onclick="event.stopPropagation(); joinCrewLive('${esc(crewId)}')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Зайняти місце в екіпажі #${esc(crewId)}
      </div>`;
    } else {
      actionBtns = `<div class="join-btn join-ask" onclick="event.stopPropagation(); joinCrewLive('${esc(crewId)}')">📩 Постукатись — якщо хтось відмовиться</div>`;
    }
  } else {
    // Мандрівник (traveler) — кнопки join недоступні (BAN-4)
    actionBtns = `<div class="join-btn" style="background:rgba(77,207,255,.08);color:var(--sky);border:1px solid rgba(77,207,255,.2)" onclick="event.stopPropagation(); showView(3)">💬 Стрічка екіпажу →</div>`;
  }

  return `
      <div class="crew-card" id="crew${idx + 1}">
        <div class="crew-head" onclick="toggleCrew(${idx + 1})">
          <div class="crew-num${isFree ? ' has-space' : ''}">#${esc(crewId)}</div>
          <div class="crew-body">
            <div class="crew-driver">${esc(item.driver_name || '?')}</div>
            <div class="crew-car">${esc(item.car || '')}</div>
          </div>
          <div class="crew-seats">${seats}</div>
        </div>
        <div class="crew-detail">
          <div class="cd-inner">
            <div class="cd-row">
              <span class="cd-lbl">Старт</span>
              <span class="cd-val">${esc(item.pickup || '—')}</span>
            </div>
            <div class="cd-members">${members}${emptySlots}</div>
            ${actionBtns}
          </div>
        </div>
      </div>
  `;
}

function renderRoot(items) {
  const list = document.getElementById('rootList');
  if (!list) return;
  list.innerHTML = items.map(rootCardHtml).join('');
}

function renderV0(items) {
  const list = document.getElementById('v0List');
  if (!list) return;
  list.innerHTML = items.map(childCardHtml).join('');
}

function renderSub(items) {
  const list = document.getElementById('subList');
  if (!list) return;
  if (subFooterHtml === null) subFooterHtml = _captureFooterHtml(list, 'org-card');
  list.innerHTML = items.map(locationCardHtml).join('') + (subFooterHtml || '');
}

function renderOrganizers(items) {
  const list = document.getElementById('orgList');
  if (!list) return;
  if (orgFooterHtml === null) orgFooterHtml = _captureFooterHtml(list, 'org-card');
  list.innerHTML = items.map(organizerCardHtml).join('') + (orgFooterHtml || '');
}

function renderCrews(items) {
  const list = document.getElementById('crewList');
  if (!list) return;
  list.innerHTML = items.map(crewCardHtml).join('');
}

export async function initFractal() {
  state.userId = resolveUserId();
  
  // Витягуємо мову з URL або Telegram
  const urlParams = new URLSearchParams(window.location.search);
  const langFromUrl = urlParams.get('lang');
  if (langFromUrl) {
    state.lang = langFromUrl;
  } else if (tg?.initDataUnsafe?.user?.language_code) {
    state.lang = tg.initDataUnsafe.user.language_code;
  }

  if (!getApiBase()) return;

  const root = await loadRoot();
  if (!root) return;
  renderRoot(root);
}

export async function openRoot(directionId) {
  if (!getApiBase()) return;

  const dir = state.dirIndex.get(directionId);
  state.rootId = directionId;
  state.rootTitle = dir?.title || getDirectionTitle(directionId);
  setCrumbActive('crumb0', state.rootTitle || 'Дошка');

  const children = await loadChildren(directionId);
  if (!children) return;

  renderV0(children);
  showView(0, 'forward', true);
}

export async function drillToSubcat(directionId) {
  if (!getApiBase()) return;

  const dir = state.dirIndex.get(directionId);
  state.parentId = directionId;
  state.parentTitle = dir?.title || getDirectionTitle(directionId);

  updateText('crumb05-parent', state.rootTitle || 'Головна');
  updateText('crumb05-current', state.parentTitle || 'Напрямок');
  updateText('subTitle', state.parentTitle ? `📍 ${state.parentTitle}` : 'Локації');

  const children = await loadChildren(directionId);
  if (!children) return;

  if (!children.length) {
    await drillToOrg(directionId);
    return;
  }

  renderSub(children);
  showView('05', 'forward', true);
  window.currentFractalView = '05';
}

export async function drillToOrg(directionId) {
  if (!getApiBase()) return;

  const data = await loadOrganizers(directionId);
  if (!data) return;

  state.directionId = directionId;
  state.directionTitle = data.direction?.title || getDirectionTitle(directionId);
  state.parentId = data.direction?.parent_id || state.parentId;
  state.parentTitle = getDirectionTitle(state.parentId) || state.parentTitle;

  updateText('crumb1-root', state.rootTitle || 'Головна');

  const crumbParent = document.getElementById('crumb1-parent');
  if (crumbParent) {
    if (state.rootTitle === state.parentTitle) {
      crumbParent.style.display = 'none';
      crumbParent.previousElementSibling.style.display = 'none';
    } else {
      crumbParent.style.display = '';
      crumbParent.previousElementSibling.style.display = '';
      updateText('crumb1-parent', state.parentTitle || 'Напрямок');
    }
  }

  updateText('crumb1-current', state.directionTitle || 'Організатори');
  updateText('orgTitle', `📍 ${state.directionTitle || ''}`.trim());

  const orgCount = data.organizers.length;
  const people = (data.direction?.drivers || 0) + (data.direction?.passengers || 0);
  updateText('orgMeta', `${orgCount} організаторів · ${people} людей зацікавлені`);

  // Update subscription button state
  state.isSubscribed = data.user_status?.subscribed || false;
  _updateSubscriptionUI(state.isSubscribed);

  renderOrganizers(data.organizers);
  showView(1, 'forward', true);
  window.currentFractalView = 1;
}

function _updateSubscriptionUI(isSub) {
  const btn = document.getElementById('btn-subscribe-dir');
  const check = document.getElementById('subscribe-dir-check');
  const title = document.getElementById('subscribe-dir-title');
  const desc = document.getElementById('subscribe-dir-desc');

  if (!btn) return;

  if (isSub) {
    btn.style.background = 'rgba(0, 180, 216, 0.12)';
    btn.style.border = '1px solid var(--sky)';
    if (check) check.style.display = 'flex';
    if (title) {
      title.textContent = 'Ви підписані на цей напрямок';
      title.style.color = 'var(--white)'; // У світлій темі це темний колір (#0F172A)
    }
    if (desc) desc.textContent = 'Ви отримуєте сповіщення про нові екіпажі';
  } else {
    btn.style.background = 'rgba(0, 180, 216, 0.05)';
    btn.style.border = '1px dashed rgba(0, 180, 216, 0.4)';
    if (check) check.style.display = 'none';
    if (title) {
      title.textContent = '🔔 Підписатися на напрямок';
      title.style.color = 'var(--sky)';
    }
    if (desc) desc.textContent = 'Отримуй сповіщення від бота про появу нових екіпажів';
  }
}

export async function toggleSubscription() {
  if (!getApiBase() || !state.directionId || !state.userId) {
    showToast('Неможливо змінити підписку (помилка авторизації)');
    return;
  }

  // Optimistic UI update
  state.isSubscribed = !state.isSubscribed;
  _updateSubscriptionUI(state.isSubscribed);
  showToast(state.isSubscribed ? '🔔 Підписку оформлено!' : '🔕 Підписку скасовано');

  try {
    const endpoint = state.isSubscribed ? '/api/v3/board/subscribe' : '/api/v3/board/unsubscribe';
    const role = window.userProfile?.role || 'companion';
    await api(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        direction_id: state.directionId,
        user_id: state.userId,
        role: role === 'companion' ? 'client' : 'driver'
      })
    });
  } catch (err) {
    // Revert on error
    state.isSubscribed = !state.isSubscribed;
    _updateSubscriptionUI(state.isSubscribed);
    showToast('Помилка сервера. Спробуйте ще раз.');
  }
}

export async function drillToCrews(organizerId) {
  if (!getApiBase()) return;

  if (!state.directionId) {
    showToast('Спочатку вибери напрямок');
    return;
  }

  const data = await loadCrews(organizerId, state.directionId);
  if (!data) return;

  state.organizerId = organizerId;
  state.organizerName = data.organizer?.name || '';

  updateText('crumb2-parent', state.parentTitle || 'Напрямок');
  updateText('crumb2-direction', state.directionTitle || 'Організатор');
  updateText('crumb2-organizer', state.organizerName || 'Екіпажі');
  updateText('crewTitle', `Екіпажі виїзду ${state.organizerName ? `— ${state.organizerName}` : ''}`.trim());

  if (data.summary) {
    updateText('crewCount', `${data.summary.crews_count || 0} екіпажів`);
    updateText('seatCount', `${data.summary.total_free || 0} вільних місць`);
    updateText('memberCount', `${data.summary.total_members || 0} людей`);
  }

  renderCrews(data.crews);
  showView(2, 'forward', true);
}

export async function joinCrewLive(crewIdRaw) {
  if (!getApiBase()) return;

  if (!state.userId) {
    showToast('Потрібен user_id для приєднання');
    return;
  }
  if (!state.organizerId || !state.directionId) {
    showToast('Контекст екіпажу не визначений');
    return;
  }

  const crewId = String(crewIdRaw || '').trim();
  if (!/^\d+$/.test(crewId)) {
    showToast('Екіпаж ще формується');
    return;
  }

  const res = await api('/api/v3/handshake', {
    method: 'POST',
    body: JSON.stringify({
      user_id: state.userId,
      organizer_id: state.organizerId,
      direction_id: state.directionId,
      crew_id: Number(crewId),
    }),
  });

  if (!res) {
    showToast('Потрібно відкрити Mini App у Telegram');
    return;
  }

  // Зберігаємо контекст для переходу на handshake-екран
  window._pendingCrewId = crewId;
  window._pendingDir = state.directionTitle;

  // Наповнюємо handshake view даними з відповіді API
  const driverEl = document.getElementById('hs-driver');
  const pickupEl = document.getElementById('hs-pickup');
  const dirEl = document.getElementById('hs-direction');
  if (driverEl) driverEl.textContent = res.driver_name || `Екіпаж #${crewId}`;
  if (pickupEl) pickupEl.textContent = res.pickup || '—';
  if (dirEl) dirEl.textContent = state.directionTitle || '';

  showView('handshake');
}
