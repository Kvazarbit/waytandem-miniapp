import { initTelegramUI } from './telegram.js';
import { getApiBase, saveApiUrl, restoreApiUrl } from './api.js';
import {
  initFractal,
  openRoot,
  drillToSubcat as drillToSubcatLive,
  drillToOrg as drillToOrgLive,
  drillToCrews as drillToCrewsLive,
  joinCrewLive,
} from './fractal.js';
import {
  selectRole,
  toggleRegRole,
  showView,
  drillToSubcat as drillToSubcatStatic,
  drillToOrg as drillToOrgStatic,
  drillToCrews as drillToCrewsStatic,
  goBack,
  toggleOrg,
  toggleCrew,
  joinCrew,
  openShare,
  closeShare,
  copyLink,
  switchFeedTab,
  sendFeedMsg,
  showToast,
} from './ui.js';

function bindGlobals() {
  window.selectRole = selectRole;
  window.toggleRegRole = toggleRegRole;
  window.showView = showView;

  window.openRoot = openRoot;

  window.drillToSubcat = id => {
    if (getApiBase() && id !== undefined && id !== null) return drillToSubcatLive(id);
    return drillToSubcatStatic();
  };
  window.drillToOrg = id => {
    if (getApiBase() && id !== undefined && id !== null) return drillToOrgLive(id);
    return drillToOrgStatic();
  };
  window.drillToCrews = id => {
    if (getApiBase() && id !== undefined && id !== null) return drillToCrewsLive(id);
    return drillToCrewsStatic();
  };

  window.goBack = goBack;
  window.toggleOrg = toggleOrg;
  window.toggleCrew = toggleCrew;

  // Demo join uses old UI-only behavior; live join is used by API-rendered cards.
  window.joinCrew = joinCrew;
  window.joinCrewLive = joinCrewLive;

  window.openShare = openShare;
  window.closeShare = closeShare;
  window.copyLink = copyLink;
  window.switchFeedTab = switchFeedTab;
  window.sendFeedMsg = sendFeedMsg;
  window.showToast = showToast;
  window.saveApiUrl = saveApiUrl;
}

bindGlobals();

window.addEventListener('DOMContentLoaded', async () => {
  initTelegramUI();

  // ── Крок 1: Зчитуємо ?api= з URL (пріоритет — з кнопки бота)
  const urlParams = new URLSearchParams(window.location.search);
  const apiFromUrl = urlParams.get('api');
  if (apiFromUrl) {
    const cleanApi = apiFromUrl.trim().replace(/\/$/, '');
    saveApiUrl(cleanApi);          // зберігає в localStorage + встановлює apiBase
  } else {
    restoreApiUrl();               // відновлює з localStorage якщо є
  }

  // ── Крок 2: Завантажуємо дані з API
  await initFractal();

  // ── Крок 3: Показуємо потрібний view
  if (getApiBase()) {
    showView('root');              // Є API → одразу Дошка з реальними даними
  } else {
    showView('home');              // Немає API → Demo Home
  }
});

// Якщо API змінюється через налаштування в профілі — оновлюємо
window.addEventListener('wt-api-changed', async () => {
  await initFractal();
  if (getApiBase()) showView('root');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement?.id === 'composeInput') sendFeedMsg();
});

