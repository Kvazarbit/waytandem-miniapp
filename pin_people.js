/* Stand-only prototype layer, delta A (Opus, D503 / owner 28.10): people pins. A photo, or the first letter when there is no photo
   or it fails to load, instead of 👤 / 🚗; a small 🚗 mark at the driver; three quiet corner badges — ✓ «у вашому екіпажі, ще не
   сів», ⏳ «ваша пропозиція чекає відповіді», a red dot «вам доступна дія» (it mirrors the dock button, never replaces it); and a
   person header (photo, full name, state) on the pin's existing popup. Reads S / DOM and the page's own read endpoint
   /api/v3/events/photos only; no domain writes, no new actions, all data attributes / classes / rings of the pins are kept. */
(function (root) {
  'use strict';
  const TERMINAL = ['done', 'completed', 'cancelled', 'canceled', 'missed_pickup'];
  const initial = n => (String(n || '').trim() || '?')[0].toUpperCase();

  // The one place that decides a pin's badge for THIS viewer: 'act' > 'wait' > 'ok' > null (D502 / EXPECT.md).
  function badgeFor(trip, member, viewerId, pendingTargets) {
    const uid = String(member && member.user_id), role = String(member && member.role || '').toLowerCase();
    if (!member || uid === String(viewerId)) return null;
    let act = false, ok = false;
    const inTrip = !!trip && !!trip.active && !TERMINAL.includes(String(trip.status || '').toLowerCase());
    const inCrew = inTrip && (trip.members || []).some(m => String(m.user_id) === uid);
    if (inCrew) {
      const driverView = trip.viewer_role === 'driver';
      if (role === 'driver') {
        const mine = !driverView && (trip.members || []).find(m => String(m.user_id) === String(viewerId));
        act = !!mine && !!mine.driver_finished && !mine.client_finished && !TERMINAL.includes(String(mine.request_status || '').toLowerCase());
      } else if (!TERMINAL.includes(String(member.request_status || '').toLowerCase())) {
        act = driverView && !!member.client_finished && !member.driver_finished;
        ok = String(member.passenger_pickup_status || '').toLowerCase() !== 'picked_up';
      }
    }
    if (act) return 'act';                                                   // priority act > wait > ok (EXPECT.md)
    if (pendingTargets && pendingTargets.has(uid)) return 'wait';
    return ok ? 'ok' : null;
  }
  const STATE_TEXT = { act: 'потрібна ваша дія — вона в доці', wait: 'ваша пропозиція чекає відповіді', ok: 'у вашому екіпажі · ще не сів' };
  if (typeof module !== 'undefined' && module.exports) { module.exports = { badgeFor, initial, STATE_TEXT }; return; }
  if (typeof S === 'undefined' || typeof renderCrewMembersOnMap !== 'function') return;
  // D531: UI words through the page's catalogue at the moment of showing; STATE_TEXT above stays the uk source (Node / module)
  const tr = s => (typeof uiText === 'function' ? uiText(s) : s);

  const css = document.createElement('style');
  css.textContent = `.pp-av{position:absolute;inset:0;border-radius:50%;overflow:hidden;display:grid;place-items:center;color:#fff;font:700 15px/1 system-ui}
.pp-host .pp-av > img.pp-photo,.pp-face .pp-av > img.pp-photo{position:absolute;inset:0;width:100%;height:100%;min-width:0;min-height:0;margin:0;padding:0;border:0;object-fit:cover;display:block}
/* D511: more specific than Leaflet's «.leaflet-container .leaflet-marker-pane img{width:auto}» and out of the grid flow — else the photo keeps its own size and overflows the circle (a grey patch) */
.pp-badge{position:absolute;right:-4px;bottom:-4px;width:38%;height:38%;box-sizing:border-box;border-radius:50%;border:2px solid #fff;display:grid;place-items:center;font:700 8px/1 system-ui;color:#fff;box-shadow:0 1px 3px #0006;pointer-events:none;z-index:3}
.gps-crew-head > .pp-badge,.gps-person-pin > .pp-badge{top:-4px;bottom:auto}   /* the GPS «антенка» sits bottom-right there */
.pp-ok{background:#16a34a}.pp-wait{background:#d97706}.pp-act{background:#dc2626}
.pp-car{position:absolute;left:-4px;bottom:-4px;width:38%;height:38%;box-sizing:border-box;border-radius:50%;background:#fbbf24;border:2px solid #fff;display:grid;place-items:center;font-size:8px;line-height:1;pointer-events:none;z-index:3}
.pp-host{position:relative}
.pp-head{display:flex;gap:8px;align-items:center;margin:0 0 6px}.pp-head .pp-face{position:relative;width:34px;height:34px;flex:none}
.pp-head .pp-state{font-size:12px;color:#94a3b8}`;
  document.head.append(css);

  // photos: the page's own cache first; one passive read of the same endpoint the event sheet uses, per direction
  const asked = new Set();
  function ensurePhotos(dirId) {
    const d = parseInt(dirId, 10) || 0;
    if (!d || asked.has(d) || !S.userId || typeof api !== 'function') return;
    asked.add(d);
    Promise.resolve(api(`/api/v3/events/photos?direction_id=${d}&user_id=${encodeURIComponent(S.userId)}`, { silent: true })).then(resp => {
      const photos = resp && resp.photos && typeof resp.photos === 'object' ? resp.photos : {}, fresh = {};
      Object.entries(photos).forEach(([uid, url]) => { const safe = sanitizeAvatarUrl(url), key = String(parseInt(uid, 10) || ''); if (safe && key) fresh[key] = safe; });
      if (Object.keys(fresh).length) { S.personPhotos = { ...(S.personPhotos || {}), ...fresh }; decorate(); }
    }).catch(() => {});
  }
  // a broken photo becomes the letter (the base page has no such fallback, D504)
  document.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG' && t.dataset && 'ppFallback' in t.dataset && t.parentElement) t.parentElement.textContent = t.dataset.ppFallback; }, true);

  const face = (uid, name) => {
    const url = typeof personPhoto === 'function' ? personPhoto(uid) : '', bg = _avatarGradient(name || initial(name));
    return url ? `<span class="pp-av" style="background:${bg}"><img class="pp-photo" src="${escapeAttr(url)}" alt="" data-pp-fallback="${escapeAttr(initial(name))}"></span>`
      : `<span class="pp-av" style="background:${bg}">${escapeHtml(initial(name))}</span>`;
  };
  const badge = b => (b ? `<span class="pp-badge pp-${b}" aria-hidden="true">${b === 'ok' ? '✓' : b === 'wait' ? '⏳' : ''}</span>` : '');
  const pendingTargets = () => new Set((S.pendingMatches || []).filter(m => m && m.scope === 'outgoing').map(m => String(m.target_id || m.partner_id || '')).filter(Boolean));

  // Paint one pin element (idempotent): keeps the element, its attributes, classes and rings; replaces only the 👤 / 🚗 glyph.
  function paint(el, uid, name, b, isDriver) {
    const photo = typeof personPhoto === 'function' ? personPhoto(uid) : '', key = `${uid}|${b}|${photo}|${isDriver}|${S.lang || 'uk'}`;
    if (!el || el.dataset.ppKey === key) return;
    el.dataset.ppKey = key; el.classList.add('pp-host');
    // only the glyph text and our own nodes are replaced; other layers' children (e.g. the GPS «антенка» .gps-age) stay
    [...el.childNodes].forEach(n => { if (n.nodeType === 3 || (n.classList && [...n.classList].some(c => c.startsWith('pp-')))) n.remove(); });
    const label = `${name}${b ? ' · ' + tr(STATE_TEXT[b]) : ''}`;
    el.insertAdjacentHTML('afterbegin', face(uid, name) + (isDriver ? '<span class="pp-car" aria-hidden="true">🚗</span>' : '') + badge(b)
      + `<span class="pp-sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">${escapeHtml(label)}</span>`);
    // aria-label / an existing title stay owned by the layer that drew the pin (the GPS tail says «— очікує завершення» there)
    if (!el.hasAttribute('title') || el.dataset.ppTitle) { el.setAttribute('title', label); el.dataset.ppTitle = '1'; }
  }

  function decorate() {
    const t = S.activeTrip, me = S.userId, pend = pendingTargets();
    if (t && t.active) ensurePhotos(t.direction_id);
    const members = (t && Array.isArray(t.members)) ? t.members : [];
    const byId = id => members.find(m => String(m.user_id) === String(id));
    const driver = t ? byId(t.driver_id) || { user_id: t.driver_id, name: t.driver_name || tr('Водій'), role: 'driver' } : null;
    // native crew member pins and the native car pin
    for (const marker of S._crewMemberMarkers || []) {
      const root = marker.getElement && marker.getElement(); if (!root) continue;
      const pin = root.querySelector('[data-crew-member]');
      if (pin) { const m = byId(pin.getAttribute('data-crew-member')); if (m) paint(pin, m.user_id, m.name, badgeFor(t, m, me, pend), String(m.role).toLowerCase() === 'driver'); continue; }
      const car = root.querySelector('.pickup-point-driver');
      if (car && driver) paint(car, driver.user_id, driver.name, badgeFor(t, driver, me, pend), true);
    }
    // the GPS layer (stand): head, tail people, GPS person pins
    document.querySelectorAll('.gps-crew-head[data-snake-driver]').forEach(el => driver && paint(el, driver.user_id, driver.name, badgeFor(t, driver, me, pend), true));
    document.querySelectorAll('.gps-crew-person[data-snake-member]').forEach(el => { const m = byId(el.getAttribute('data-snake-member')); if (m) paint(el, m.user_id, m.name, badgeFor(t, m, me, pend), false); });
    document.querySelectorAll('.gps-person-pin[data-live-person]').forEach(el => { const m = byId(el.getAttribute('data-live-person')); if (m) paint(el, m.user_id, m.name, badgeFor(t, m, me, pend), false); });
    // search lens: waiting passengers, ⏳ when my proposal waits. R1 (D507): the person is the marker's own source-owned id
    // (renderMapPassengersOnMap sets marker._wtPassengerId) — never a coordinate (two people can wait at one stop); no id → not painted
    for (const marker of S.mapMarkers || []) {
      const root = marker.getElement && marker.getElement(), pin = root && root.querySelector('[data-map-passenger-pin]'); if (!pin) continue;
      const id = parseInt(marker._wtPassengerId, 10) || 0; if (!id) continue;
      const p = (S.mapPassengers || []).find(x => String(x.user_id) === String(id));
      paint(pin, id, marker._wtPassengerName || (p && p.name) || '', pend.has(String(id)) ? 'wait' : null, false);
    }
  }

  // popup header: photo + full name + state, inserted into the opened popup's DOM (the popup's own content / buttons stay)
  function headerFor(uid) {
    const t = S.activeTrip, m = t && (t.members || []).find(x => String(x.user_id) === String(uid));
    const mk = (S.mapMarkers || []).find(x => String(parseInt(x._wtPassengerId, 10) || '') === String(uid));
    const p = m || (S.mapPassengers || []).find(x => String(x.user_id) === String(uid)) || (mk && { name: mk._wtPassengerName || '' }); if (!p) return null;
    const b = m ? badgeFor(t, m, S.userId, pendingTargets()) : (pendingTargets().has(String(uid)) ? 'wait' : null);
    const role = String(p.role || '').toLowerCase() === 'driver' ? tr('водій') : tr('попутник');
    return `<div class="pp-head" data-pp-head="${escapeAttr(String(uid))}"><span class="pp-face">${face(uid, p.name)}</span><span><b>${escapeHtml(p.name || '')}</b><br><span class="pp-state">${escapeHtml(role + (b ? ' · ' + tr(STATE_TEXT[b]) : ''))}</span></span></div>`;
  }
  function onPopup(e) {
    const src = e.popup && e.popup._source, el = src && src.getElement && src.getElement(), box = e.popup.getElement && e.popup.getElement();
    if (!el || !box) return;
    // the same source-owned id as the popup's own invite button (signalPassenger(id, …)); crew / GPS pins carry theirs as attributes
    const own = parseInt(src._wtPassengerId, 10) || 0, pin = el.querySelector('[data-crew-member],[data-snake-member],[data-live-person]');
    const uid = own ? String(own) : pin && (pin.getAttribute('data-crew-member') || pin.getAttribute('data-snake-member') || pin.getAttribute('data-live-person'));
    const content = box.querySelector('.leaflet-popup-content'); if (!uid || !content || content.querySelector('[data-pp-head]')) return;
    const html = headerFor(uid); if (html) content.insertAdjacentHTML('afterbegin', html);
  }

  const wrap = name => { const orig = root[name]; if (typeof orig !== 'function') return; root[name] = function () { const r = orig.apply(this, arguments); try { decorate(); } catch (_) {} return r; }; };
  wrap('renderCrewMembersOnMap'); wrap('renderMapPassengersOnMap');
  setInterval(() => { try { decorate(); } catch (_) {} if (S.map && !S.map._ppPopup) { S.map.on('popupopen', onPopup); S.map._ppPopup = true; } }, 1000);   // the GPS layer re-renders every second
})(typeof window !== 'undefined' ? window : {});
