import { getInitData } from './telegram.js?v=22';

let apiBase = localStorage.getItem('wt_api') || '';

export function getApiBase() {
  return apiBase;
}

// silent=true — не стріляємо wt-api-changed (використовується під час init)
export function saveApiUrl(val, silent = false) {
  apiBase = (val || '').trim().replace(/\/$/, '');
  localStorage.setItem('wt_api', apiBase);
  const status = document.getElementById('apiStatus');
  if (status) {
    status.textContent = apiBase ? "⏳ Перевірка з'єднання..." : 'Не підключено — демо-режим';
    status.style.color = '';
  }
  if (apiBase) checkApiHealth();
  if (!silent && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wt-api-changed'));
  }
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

// silent=true під час init — не стріляємо зайвий wt-api-changed
export function restoreApiUrl(silent = false) {
  const urlParams = new URLSearchParams(window.location.search);
  const apiFromUrl = urlParams.get('api');
  if (apiFromUrl) {
    const clean = apiFromUrl.trim().replace(/\/$/, '');
    apiBase = clean;
    localStorage.setItem('wt_api', clean);
    const input = document.getElementById('apiUrlInput');
    if (input) input.value = clean;
    checkApiHealth();
    if (!silent && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wt-api-changed'));
    }
    return;
  }

  const saved = localStorage.getItem('wt_api');
  if (!saved) return;
  const input = document.getElementById('apiUrlInput');
  if (input) input.value = saved;
  apiBase = saved;
  checkApiHealth();
  if (!silent && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wt-api-changed'));
  }
}
