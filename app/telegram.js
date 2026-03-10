export const tg = window.Telegram?.WebApp || null;

export function initTelegramUI() {
  if (!tg) return;
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#F7F9FC');

  const tgUser = tg.initDataUnsafe?.user;
  if (!tgUser) return;

  const firstName = tgUser.first_name || '';
  const lastName = tgUser.last_name || '';
  const fullName = (firstName + ' ' + lastName).trim();
  const initials = (firstName[0] || '') + (lastName[0] || '');

  if (!fullName) return;
  const homeGreeting = document.getElementById('homeGreeting');
  const profileName = document.getElementById('profileName');
  const avBtn = document.getElementById('avBtn');
  const profileAvatar = document.getElementById('profileAvatar');

  if (homeGreeting) homeGreeting.textContent = `Привіт, ${firstName}! 👋`;
  if (profileName) profileName.textContent = fullName;
  if (avBtn) avBtn.textContent = initials.toUpperCase() || 'Я';
  if (profileAvatar) profileAvatar.textContent = initials.toUpperCase() || 'Я';
}

export function getInitData() {
  return tg?.initData || '';
}
