/* Stand-only prototype layer, delta B (Opus, D503 / owner 28.10), separate from delta A for a causal comparison: only while a trip is
   active, the map chrome is denser — the mode strip becomes a thin line and the event filter tiles become one-line chips (title + count;
   the small third caption is hidden; tap height stays >= 44 px). Nothing is removed, no element changes behaviour, no writes. */
(function () {
  'use strict';
  if (typeof S === 'undefined') return;
  const css = document.createElement('style');
  css.textContent = `body.pp-compact .map-mode-strip{padding:3px 10px!important;font-size:11px!important}
body.pp-compact .news-banner{padding:4px 6px!important;min-height:44px;display:flex!important;align-items:center;justify-content:center;gap:6px}
body.pp-compact .news-banner .news-banner-title{font-size:12px}
body.pp-compact .news-banner .news-banner-count{font-size:13px;margin:0}
body.pp-compact .news-banner > div:nth-child(3){display:none}`;
  document.head.append(css);
  const sync = () => {
    const on = !!(S.activeTrip && S.activeTrip.active);
    if (document.body.classList.contains('pp-compact') === on) return;
    document.body.classList.toggle('pp-compact', on);
    if (typeof syncMapFabStack === 'function') requestAnimationFrame(syncMapFabStack);   // the 🎯/📍 stack re-places itself as on resize
  };
  sync();                 // applied already when the script loads (a load-ACK of a comparison tool then means «B is on»), then kept in step
  setInterval(sync, 500);
})();
