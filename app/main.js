import { initTelegramUI } from './telegram.js?v=24';
import { api, getApiBase, saveApiUrl, restoreApiUrl } from './api.js?v=24';
import {
  initFractal,
  openRoot,
  drillToSubcat as drillToSubcatLive,
  drillToOrg as drillToOrgLive,
  drillToCrews as drillToCrewsLive,
  joinCrewLive,
  toggleSubscription,
} from './fractal.js?v=24';
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
  respondToRequest,
  refreshIncomingRequests,
  openCrewForm,
  submitOpenCrew,
  selectionState,
  toggleTripMap,
  refreshMainMap,
  showMapCrewDetails,
} from './ui.js?v=24';

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
  window.drillToOrg = (id, orgId) => {
    if (getApiBase() && id !== undefined && id !== null) {
      const res = drillToOrgLive(id);
      if (orgId) {
        setTimeout(() => {
          if (window.fractal && window.fractal.drillToCrews) {
            window.fractal.drillToCrews(orgId);
          }
        }, 600);
      }
      return res;
    }
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
    restoreProfile,
    showActiveTrip,
    respondToRequest,
    refreshIncomingRequests,
    toggleTripMap,
    openCrewForm,
    submitOpenCrew,
    refreshMainMap,
    showMapCrewDetails,
    selectionState
  };

  window.fractal = {
    openRoot,
    drillToSubcat: window.drillToSubcat,
    drillToOrg: window.drillToOrg,
    drillToCrews: window.drillToCrews,
    joinCrew: joinCrewLive,
    initFractal,
    hydrateTrip,
    toggleSubscription
  };
}

async function hydrateTrip() {
  if (!userProfile.userId || !getApiBase()) return;
  try {
    const data = await api(`/api/v3/trip/active?user_id=${userProfile.userId}`);
    if (data && data.active) {
      console.log('💎 Hydrating active trip:', data.crew_display_id);
      showActiveTrip(data);
      return true;
    } else {
      // If we were in a trip and it's no longer active, tripState.active will be true
      if (window.tripState && window.tripState.active) {
        console.log('🏁 Trip ended, resetting state...');
        window.tripState.active = false;
        // Optional: showRoot() or toast
      }
    }
  } catch (e) {
    console.error('Failed to hydrate trip:', e);
  }
  return false;
}

/**
 * 🔄 v24.5: Background polling to keep trip state in sync.
 * Runs every 15 seconds while the app is active.
 */
function startPolling() {
  console.log('🔄 Starting background polling (15s)...');
  setInterval(async () => {
    // Only poll if registered and not in a 'blocking' state like registration
    if (userProfile.userId && getApiBase()) {
      await hydrateTrip();
      
      // 📍 v24.5: Also refresh global map markers
      if (typeof window.ui !== 'undefined' && window.ui.refreshMainMap) {
        window.ui.refreshMainMap();
      }
    }
  }, 15000);
}

window.addEventListener('DOMContentLoaded', async () => {
  bindGlobals(); // Глобали доступні одразу після DOMContentLoaded
  initTelegramUI();

  // ... (rest of DOMContentLoaded)

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

  // ── Крок 3: Завантажуємо дані з API
  await initFractal();

  // ── Крок 4: Показуємо потрібний view
  if (!isRegistered) {
    showView('welcome');           // Новий користувач → реєстрація
  } else if (getApiBase()) {
    // Спробуємо відновити активну поїздку
    const hasTrip = await hydrateTrip();
    if (!hasTrip) {
      openRoot();                  // Немає поїздки → Завантажуємо Дошку
    }
  } else {
    showView('home');              // Демо-режим
  }

  // 🔄 v24.5: Start background polling for real-time trip updates
  startPolling();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement?.id === 'composeInput') sendFeedMsg();
});
