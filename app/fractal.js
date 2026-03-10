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
    .replace(/\"/g, '&quot;')
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

  const url = new URL(window.location.href);
  const qp = url.searchParams.get('user_id');
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
  return `\n      <div class=\"int-card\" style=\"--glow:${palette.glow}\" onclick=\"openRoot(${item.id})\">\n        <div class=\"ic-top\" style=\"position:relative; z-index:2\">\n          <div class=\"ic-emoji\" style=\"background:${palette.bg};color:#07090E\">${palette.emoji}</div>\n          <div class=\"ic-body\">\n            <div class=\"ic-name\">${esc(item.title)}</div>\n            <div class=\"ic-desc\">${esc(item.has_kids ? 'Обери піднапрямок' : 'Перейти далі')}</div>\n          </div>\n          <div class=\"ic-arrow\">\n            <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"${palette.stroke}\" stroke-width=\"2.5\"><polyline points=\"9 18 15 12 9 6\"/></svg>\n          </div>\n        </div>\n      </div>\n  `;
}

function childCardHtml(item, idx) {
  const palette = pickPalette(item.title, idx);
  const handler = item.has_kids ? `drillToSubcat(${item.id})` : `drillToOrg(${item.id})`;
  return `\n      <div class=\"int-card\" style=\"--glow:${palette.glow}\" onclick=\"${handler}\">\n        <div class=\"ic-top\" style=\"position:relative; z-index:2\">\n          <div class=\"ic-emoji\">${esc(palette.emoji)}</div>\n          <div class=\"ic-body\">\n            <div class=\"ic-name\">${esc(item.title)}</div>\n            <div class=\"ic-desc\">${esc(item.has_kids ? 'Детальніше →' : 'Організатори та екіпажі')}</div>\n          </div>\n          <div class=\"ic-arrow\">\n            <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"${palette.stroke}\" stroke-width=\"2.5\"><polyline points=\"9 18 15 12 9 6\"/></svg>\n          </div>\n        </div>\n      </div>\n  `;
}

function locationCardHtml(item, idx) {
  const palette = pickPalette(item.title, idx);
  const meta = `${item.drivers || 0} організаторів · ${item.passengers || 0} людей зацікавлені`;
  return `\n      <div class=\"org-card\" onclick=\"drillToOrg(${item.id})\">\n        <div class=\"org-head\">\n          <div class=\"org-av\" style=\"background:${palette.glow};color:${palette.stroke};font-size:18px\">📍</div>\n          <div class=\"org-body\">\n            <div class=\"org-name\">${esc(item.title)}</div>\n            <div class=\"org-date\">${esc(meta)}</div>\n          </div>\n          <div class=\"org-head-chevron\" style=\"background:transparent\">\n            <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"var(--muted)\" stroke-width=\"2.5\"><polyline points=\"9 18 15 12 9 6\"/></svg>\n          </div>\n        </div>\n      </div>\n  `;
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
  return `\n      <div class=\"org-card\" id=\"org${idx + 1}\">\n        <div class=\"org-head\" onclick=\"toggleOrg(${idx + 1}, event)\">\n          <div class=\"org-av\" style=\"background:${palette.bg};color:#07090E\">${esc(initial)}</div>\n          <div class=\"org-body\">\n            <div class=\"org-name\">${esc(item.name || '?')} — ${esc(item.group_name || state.directionTitle || '')}</div>\n            <div class=\"org-date\">${dateText}</div>\n          </div>\n          <div class=\"org-badge\" style=\"background:rgba(201,255,71,.1);color:var(--lime)\">${esc(seatsText)}</div>\n          <div class=\"org-head-chevron\">\n            <svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"var(--sky)\" stroke-width=\"2.5\"><polyline points=\"6 9 12 15 18 9\"/></svg>\n          </div>\n        </div>\n        <div class=\"org-info\">\n          <div class=\"oi-chip\">${chips[0]}</div>\n          <div class=\"oi-chip\">${chips[1]}</div>\n          <div class=\"oi-chip\">${chips[2]}</div>\n        </div>\n        <div class=\"org-actions\">\n          <div class=\"oa-btn oa-ghost\" onclick=\"event.stopPropagation(); showToast('💬 Чат відкрито...')\">✉️ Написати</div>\n          <div class=\"oa-btn oa-sky\" onclick=\"event.stopPropagation(); drillToCrews(${item.user_id})\">🚗 Екіпажі →</div>\n        </div>\n      </div>\n  `;
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
  return `\n      <div class=\"cd-member\">\n        <div class=\"cd-av\" style=\"background:linear-gradient(135deg,var(--sky),var(--lime))\">${esc(initial)}</div>\n        <div class=\"cd-role\">${role}</div>\n      </div>\n  `;
}

function crewCardHtml(item, idx) {
  const crewId = item.crew_id;
  const isFree = (item.seats_free || 0) > 0;
  const seats = (item.seat_list || []).map(seatHtml).join('');
  const members = (item.members || []).map(memberHtml).join('');

  const freeSlots = Math.max(0, (item.seats_total || 4) - 1 - (item.seats_used || 0));
  const emptySlots = Array.from({ length: freeSlots }, () => `\n      <div class=\"cd-member\">\n        <div class=\"cd-empty\">\n          <svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"var(--dim)\" stroke-width=\"2\"><line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/><line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/></svg>\n        </div>\n        <div class=\"cd-role\" style=\"color:var(--lime)\">вільно</div>\n      </div>\n  `).join('');

  const joinText = isFree ? `Приєднатись до екіпажу #${esc(crewId)}` : '📩 Постукатись';
  const joinClass = isFree ? 'join-btn join-lime' : 'join-btn join-ask';

  return `\n      <div class=\"crew-card\" id=\"crew${idx + 1}\" onclick=\"toggleCrew(${idx + 1})\">\n        <div class=\"crew-head\">\n          <div class=\"crew-num${isFree ? ' has-space' : ''}\">#${esc(crewId)}</div>\n          <div class=\"crew-body\">\n            <div class=\"crew-driver\">${esc(item.driver_name || '?')}</div>\n            <div class=\"crew-car\">${esc(item.car || '')}</div>\n          </div>\n          <div class=\"crew-seats\">${seats}</div>\n        </div>\n        <div class=\"crew-detail\">\n          <div class=\"cd-inner\">\n            <div class=\"cd-row\">\n              <span class=\"cd-lbl\">Старт</span>\n              <span class=\"cd-val\">${esc(item.pickup || '—')}</span>\n            </div>\n            <div class=\"cd-members\">${members}${emptySlots}</div>\n            <div class=\"${joinClass}\" onclick=\"event.stopPropagation(); joinCrewLive('${esc(crewId)}')\">${joinText}</div>\n          </div>\n        </div>\n      </div>\n  `;
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
  showView(0);
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
  showView('05');
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
  updateText('crumb1-parent', state.parentTitle || 'Напрямок');
  updateText('crumb1-current', state.directionTitle || 'Організатори');
  updateText('orgTitle', `📍 ${state.directionTitle || ''}`.trim());

  const orgCount = data.organizers.length;
  const people = (data.direction?.drivers || 0) + (data.direction?.passengers || 0);
  updateText('orgMeta', `${orgCount} організаторів · ${people} людей зацікавлені`);

  renderOrganizers(data.organizers);
  showView(1);
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
  showView(2);
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

  await api('/api/v3/handshake', {
    method: 'POST',
    body: JSON.stringify({
      user_id: state.userId,
      organizer_id: state.organizerId,
      direction_id: state.directionId,
      crew_id: Number(crewId),
    }),
  });

  showToast('🎉 Запит надіслано! Чекай підтвердження водія');
}
