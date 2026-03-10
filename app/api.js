import { getInitData } from './telegram.js';

let apiBase = localStorage.getItem('wt_api') || '';

export function getApiBase() {
  return apiBase;
}

export function saveApiUrl(val) {
  apiBase = (val || '').trim().replace(/\/$/, '');
  localStorage.setItem('wt_api', apiBase);
  const status = document.getElementById('apiStatus');
  if (status) {
    status.textContent = apiBase ? "⏳ Перевірка з'єднання..." : 'Не підключено — демо-режим';
    status.style.color = '';
  }
  if (apiBase) checkApiHealth();
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('wt-api-changed'));
}

export async function checkApiHealth() {
  if (!apiBase) return;
  try {
    const r = await fetch(apiBase + '/api/health', { method: 'GET' });
    const ok = r.ok;
    const status = document.getElementById('apiStatus');
    if (status) {
      status.textContent = ok ? '✅ Сервер доступний' : '❌ Сервер не відповідає';
      status.style.color = ok ? 'var(--lime)' : '#FF6B6B';
    }
  } catch {
    const status = document.getElementById('apiStatus');
    if (status) {
      status.textContent = '❌ Не вдалось підключитись';
      status.style.color = '#FF6B6B';
    }
  }
}

export async function api(path, opts = {}) {
  if (!apiBase) return null;
  const headers = { 'Content-Type': 'application/json' };
  const initData = getInitData();
  if (initData) headers['Authorization'] = 'tma ' + initData;
  try {
    const r = await fetch(apiBase + path, { ...opts, headers: { ...headers, ...opts.headers } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export function restoreApiUrl() {
  const saved = localStorage.getItem('wt_api');
  if (!saved) return;
  const input = document.getElementById('apiUrlInput');
  if (input) input.value = saved;
  apiBase = saved;
  checkApiHealth();
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('wt-api-changed'));
}
