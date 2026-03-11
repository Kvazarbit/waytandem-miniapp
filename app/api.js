import { getInitData } from './telegram.js';

// ── Авто-підтягування SERVER_URL через /api/server-url ──────────────────
// Якщо сервер запущений на відомому порту (8020), але Cloudflare-тунель
// змінився — читаємо актуальний URL з env через спеціальний ендпоінт.
// Fallback: збережений URL або порожньо (demo-режим).

const KNOWN_PORTS = [8020, 8000, 8080];   // порти де може бути сервер
const SERVER_URL_KEY = 'wt_api';

let apiBase = '';

function _saved() {
  return (localStorage.getItem(SERVER_URL_KEY) || '').trim().replace(/\/$/, '');
}

function _setStatus(text, color = '') {
  const el = document.getElementById('apiStatus');
  if (!el) return;
  el.textContent = text;
  el.style.color = color;
}

export function getApiBase() { return apiBase; }

export function saveApiUrl(val) {
  apiBase = (val || '').trim().replace(/\/$/, '');
  localStorage.setItem(SERVER_URL_KEY, apiBase);
  _setStatus(apiBase ? "⏳ Перевірка з'єднання..." : 'Не підключено — демо-режим');
  if (apiBase) checkApiHealth();
  window.dispatchEvent(new CustomEvent('wt-api-changed'));
}

export async function checkApiHealth() {
  if (!apiBase) return;
  try {
    const r = await fetch(apiBase + '/api/health', { method: 'GET' });
    if (r.ok) {
      _setStatus('✅ Сервер доступний', 'var(--lime)');
    } else {
      _setStatus('❌ Сервер не відповідає', '#FF6B6B');
    }
  } catch {
    _setStatus('❌ Не вдалось підключитись', '#FF6B6B');
  }
}

// ── Спроба автоматично знайти сервер ─────────────────────────────────────
// 1. Спочатку перевіряємо /api/server-url на кожному з відомих портів
//    (сервер сам знає свій поточний Cloudflare URL і повертає його)
// 2. Якщо не вдалось — залишаємо збережений URL

async function _tryAutoDiscover() {
  // Якщо вже є збережений URL — перевіряємо чи він досі живий
  const saved = _saved();
  if (saved) {
    try {
      const r = await fetch(saved + '/api/health', { signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        apiBase = saved;
        _setStatus('✅ Сервер доступний', 'var(--lime)');
        _syncInput();
        return true;
      }
    } catch { /* saved URL мертвий, шукаємо новий */ }
  }

  // Перебираємо локальні порти — для dev-режиму без тунелю
  for (const port of KNOWN_PORTS) {
    const candidate = `http://localhost:${port}`;
    try {
      const r = await fetch(candidate + '/api/health', { signal: AbortSignal.timeout(1500) });
      if (r.ok) {
        apiBase = candidate;
        localStorage.setItem(SERVER_URL_KEY, apiBase);
        _setStatus('✅ Локальний сервер знайдено', 'var(--lime)');
        _syncInput();
        window.dispatchEvent(new CustomEvent('wt-api-changed'));
        return true;
      }
    } catch { /* порт не відповідає */ }
  }

  _setStatus('Не підключено — демо-режим');
  return false;
}

function _syncInput() {
  const input = document.getElementById('apiUrlInput');
  if (input) input.value = apiBase;
}

function _getApiFromQuery() {
  try {
    const val = (new URL(window.location.href)).searchParams.get('api') || '';
    if (val && /^https?:\/\//i.test(val)) return val.replace(/\/$/, '');
  } catch { /* ignore */ }
  return '';
}

export async function restoreApiUrl() 
  // Пріоритет: ?api=... > збережений > авто-discovery
  const fromQuery = _getApiFromQuery();
  if (fromQuery) {
    apiBase = fromQuery;
    localStorage.setItem(SERVER_URL_KEY, apiBase);
    _syncInput();
    await checkApiHealth();
    window.dispatchEvent(new CustomEvent('wt-api-changed'));
    return;
  }

  await _tryAutoDiscover();
}

// ── Основний fetch-wrapper ────────────────────────────────────────────────
export async function api(path, opts = {}) {
  if (!apiBase) return null;
  const headers = { 'Content-Type': 'application/json' };
  const initData = getInitData();
  if (initData) headers['Authorization'] = 'tma ' + initData;
  try {
    const r = await fetch(apiBase + path, {
      ...opts,
      headers: { ...headers, ...opts.headers },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
