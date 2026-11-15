import { ensureState } from '../shared/storage.ts';

/** 首次安装时写入示例简历，避免用户打开就是空白 */
chrome.runtime.onInstalled.addListener(() => {
  void ensureState();
});

async function togglePanelOnActiveTab(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'RA_TOGGLE_PANEL' });
  } catch {
    // 页面不允许注入（chrome://、应用商店等），静默忽略
  }
}

chrome.commands?.onCommand.addListener((command) => {
  if (command === 'toggle-panel') void togglePanelOnActiveTab();
});

chrome.runtime.onMessage.addListener((msg: { type?: string }, _sender, sendResponse) => {
  if (msg?.type === 'RA_TOGGLE_ACTIVE_TAB') {
    void togglePanelOnActiveTab().then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
