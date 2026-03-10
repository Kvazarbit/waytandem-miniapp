import { initTelegramUI } from './telegram.js';
import { saveApiUrl, restoreApiUrl } from './api.js';
import {
  selectRole,
  toggleRegRole,
  showView,
  drillToSubcat,
  drillToOrg,
  drillToCrews,
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
  window.drillToSubcat = drillToSubcat;
  window.drillToOrg = drillToOrg;
  window.drillToCrews = drillToCrews;
  window.goBack = goBack;
  window.toggleOrg = toggleOrg;
  window.toggleCrew = toggleCrew;
  window.joinCrew = joinCrew;
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
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement?.id === 'composeInput') sendFeedMsg();
});

setTimeout(() => showToast('👆 Натисни на Карпати й гори'), 800);
