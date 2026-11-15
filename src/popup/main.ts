import { isHostDisabled, loadState, saveState } from '../shared/storage.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function main(): Promise<void> {
  const state = await loadState();

  const select = $<HTMLSelectElement>('profile');
  select.innerHTML = state.profiles
    .map((p) => `<option value="${p.id}"${p.id === state.activeProfileId ? ' selected' : ''}>${p.title}</option>`)
    .join('');
  select.addEventListener('change', async () => {
    state.activeProfileId = select.value;
    await saveState(state);
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? '';
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  })();

  const siteEl = $<HTMLDivElement>('site');
  const openBtn = $<HTMLButtonElement>('open');
  const msgEl = $<HTMLDivElement>('msg');

  if (!host) {
    siteEl.textContent = '当前页面不支持（如 chrome:// 页面）';
    openBtn.disabled = true;
  } else {
    siteEl.textContent = `当前页面：${host}`;
    if (isHostDisabled(host, state.settings)) {
      siteEl.textContent += '（已设为不启用）';
    }
  }

  openBtn.addEventListener('click', async () => {
    if (!tab?.id) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'RA_TOGGLE_PANEL' });
      window.close();
    } catch {
      msgEl.style.display = 'block';
      msgEl.textContent = '无法注入到该页面，请刷新后重试或换一个页面。';
    }
  });

  $('edit').addEventListener('click', () => void chrome.runtime.openOptionsPage());
  $('settings').addEventListener('click', () => void chrome.runtime.openOptionsPage());
}

void main();
