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

window.addEventListener('DOMContentLoaded', () => {
  initTelegramUI();
  restoreApiUrl();
  // Якщо API вже збережений — одразу відкриваємо Дошку (root)
  const savedApi = localStorage.getItem('wt_api');
  if (savedApi) {
    showView('root');
    initFractal();
  } else {
    showView('home');
    initFractal();
  }
});

window.addEventListener('wt-api-changed', () => {
  initFractal();
  // Коли API щойно підключився — автоматично переходимо на Дошку
  if (typeof showView === 'function') showView('root');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement?.id === 'composeInput') sendFeedMsg();
});
