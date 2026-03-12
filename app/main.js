import { initTelegramUI } from './telegram.js?v=3';
import { getApiBase, saveApiUrl, restoreApiUrl } from './api.js?v=3';
import {
  initFractal,
  openRoot,
  drillToSubcat as drillToSubcatLive,
  drillToOrg as drillToOrgLive,
  drillToCrews as drillToCrewsLive,
  joinCrewLive,
  toggleSubscription,
} from './fractal.js?v=3';
import {
  selectRole,
  toggleRegRole,
  submitRegistration,
  restoreProfile,
  userProfile,
  tripState,
  showView,
  drillToSubcat as drillToSubcatStatic,
  drillToOrg as drillToOrgStatic,
  drillToCrews as drillToCrewsStatic,
  goBack,
  toggleOrg,
  toggleCrew,
  joinCrew,
  showPendingHandshake,
  showActiveTrip,
  confirmTripDone,
  submitRating,
  requestCancel,
  confirmCancel,
  openShare,
  closeShare,
  copyLink,
  switchFeedTab,
  sendFeedMsg,
  showToast,
  hydrateProfileFromUrl,
  updateProfileSeats,
  toggleOrganizerFlag,
} from './ui.js?v=3';

function bindGlobals() {
  window.selectRole = selectRole;
  window.toggleRegRole = toggleRegRole;
  window.submitRegistration = submitRegistration;
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
  window.toggleSubscription = toggleSubscription;

  window.joinCrew = joinCrew;
  window.joinCrewLive = joinCrewLive;
  window.showPendingHandshake = showPendingHandshake;
  window.showActiveTrip = showActiveTrip;
  window.confirmTripDone = confirmTripDone;
  window.submitRating = submitRating;
  window.requestCancel = requestCancel;
  window.confirmCancel = confirmCancel;

  window.openShare = openShare;
  window.closeShare = closeShare;
  window.copyLink = copyLink;
  window.switchFeedTab = switchFeedTab;
  window.sendFeedMsg = sendFeedMsg;
  window.showToast = showToast;
  window.saveApiUrl = saveApiUrl;
  window.updateProfileSeats = updateProfileSeats;
  window.toggleOrganizerFlag = toggleOrganizerFlag;
  // Робимо tripState доступним для nav-кнопки
  window.tripState = tripState;
  window.userProfile = userProfile;

  // ── Експорт для відповідності GEMINI.md (§7.21 та I-90) ──
  // Забезпечує контракт для тестів, симуляцій та зовнішніх інтеграцій
  window.ui = {
    showView,
    showToast,
    toggleOrg,
    toggleCrew,
    goBack,
    confirmTripDone,
    submitRating,
    requestCancel,
    confirmCancel,
    selectRole,
    submitRegistration,
    restoreProfile
  };

  window.fractal = {
    openRoot,
    drillToSubcat: window.drillToSubcat,
    drillToOrg: window.drillToOrg,
    drillToCrews: window.drillToCrews,
    joinCrew: joinCrewLive,
    initFractal
  };
}

window.addEventListener('DOMContentLoaded', async () => {
  bindGlobals(); // Глобали доступні одразу після DOMContentLoaded
  initTelegramUI();

  // ── Крок 1: Зчитуємо ?api= з URL — викликаємо silent=true щоб не стріляти wt-api-changed двічі
  const urlParams = new URLSearchParams(window.location.search);
  const apiFromUrl = urlParams.get('api');
  if (apiFromUrl) {
    const cleanApi = apiFromUrl.trim().replace(/\/$/, '');
    saveApiUrl(cleanApi, true);  // silent — не стріляємо евент
  } else {
    restoreApiUrl(true);          // silent
  }

  // ── Крок 2: Профіль користувача
  let isRegistered = restoreProfile();
  const urlParamsRegistered = hydrateProfileFromUrl();
  if (urlParamsRegistered) isRegistered = true;

  // ── Крок 3: Завантажуємо дані з API
  await initFractal();

  // ── Крок 4: Показуємо потрібний view
  if (!isRegistered) {
    showView('welcome');           // Новий користувач → реєстрація
  } else if (getApiBase()) {
    showView('root');              // Є API + зареєстрований → Дошка
  } else {
    showView('home');              // Демо-режим
  }
});

// Тільки коли юзер вручну змінює API в налаштуваннях (saveApiUrl без silent)
window.addEventListener('wt-api-changed', async () => {
  await initFractal();
  if (getApiBase()) showView('root', 'forward', true);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement?.id === 'composeInput') sendFeedMsg();
});

