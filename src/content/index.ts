import type { ControlContext, ControlElement, StoredState } from '../shared/types.ts';
import { activeProfile, isHostDisabled, loadState, saveState } from '../shared/storage.ts';
import { matchAll } from '../shared/matcher.ts';
import { FIELD_LABEL } from '../shared/dictionary.ts';
import { resolveCustomValue, resolveValue } from '../shared/values.ts';
import { suggestMapping } from '../shared/llm.ts';
import { countLikelyFields, scanPage } from './scanner.ts';
import { clearHighlights, fillElement, highlight, scrollToElement } from './filler.ts';
import { Panel } from './overlay.ts';
import type { PlanItemVM } from './overlay.ts';

let state: StoredState | null = null;
let panel: Panel | null = null;
let scan: { contexts: ControlContext[]; elements: ControlElement[] } | null = null;
let items: PlanItemVM[] = [];
/** 规则没认出来的控件，留给 AI 兜底 */
let unmatched: ControlContext[] = [];

const HIGH = 0.7;

async function getState(): Promise<StoredState> {
  if (!state) state = await loadState();
  syncProfiles(state);
  return state;
}

function syncProfiles(s: StoredState): void {
  panel?.setProfiles(
    s.profiles.map((p) => ({ id: p.id, title: p.title })),
    s.activeProfileId,
  );
}

function buildItems(): void {
  if (!scan || !state) return;
  const resume = activeProfile(state).data;
  const matches = matchAll(scan.contexts, resume.custom);
  const settings = state.settings;

  items = [];
  unmatched = [];
  let noValue = 0;
  let occupied = 0;
  let lowConfidence = 0;

  scan.contexts.forEach((ctx, i) => {
    const m = matches[i];
    if (!m) {
      unmatched.push(ctx);
      return;
    }
    if (m.score < settings.minScore) {
      lowConfidence++;
      return;
    }
    const value = m.customLabel
      ? resolveCustomValue(m.customLabel, resume)
      : resolveValue(m.fieldKey!, resume, ctx);

    if (!value) {
      noValue++;
      return;
    }
    if (settings.fillEmptyOnly && ctx.currentValue.trim()) {
      occupied++;
      return;
    }
    items.push({
      index: m.index,
      label: m.label,
      value,
      score: m.score,
      section: m.section,
      checked: m.score >= HIGH,
      reason: m.reason,
      kind: m.customLabel ? 'custom' : 'rule',
    });
  });

  // 值太长、单行控件塞不下的，截断展示但填充仍用完整值
  panel?.setItems(items);

  const parts = [`共识别 ${matches.filter(Boolean).length} 个字段`, `可填 ${items.length} 项`];
  if (noValue) parts.push(`${noValue} 项简历里没有对应数据`);
  if (occupied) parts.push(`${occupied} 项已有内容`);
  if (lowConfidence) parts.push(`${lowConfidence} 项置信度过低已忽略`);
  panel?.setStatus(parts.join('，'), items.length ? 'ok' : 'warn');
}

async function runScan(): Promise<void> {
  const p = getPanel();
  p.setBusy(true);
  p.setStatus('正在扫描…');
  try {
    // 先确保简历已载入，同时把简历下拉框同步好
    await getState();
    scan = scanPage(document);
    buildItems();
    if (!scan.contexts.length) {
      p.setStatus('本页没有找到可填写的表单控件', 'warn');
    }
  } finally {
    p.setBusy(false);
  }
}

function getPanel(): Panel {
  if (panel) return panel;
  panel = new Panel({
    onScan: () => void runScan(),
    onFill: (indices) => fillSelected(indices),
    onClear: () => {
      const n = clearHighlights(document);
      panel?.setStatus(n ? `已清除 ${n} 处高亮` : '没有需要清除的高亮');
    },
    onProfileChange: (id) => void switchProfile(id),
    onAI: () => void runAI(),
    onLocate: (index) => {
      const el = scan?.elements[index] as HTMLElement | undefined;
      if (el) scrollToElement(el);
    },
    onClose: () => {
      /* 关掉面板后保留会话，不重复弹 */
    },
  });
  return panel;
}

function fillSelected(indices: number[]): void {
  if (!scan) return;
  let ok = 0;
  let failed = 0;
  for (const index of indices) {
    const item = items.find((i) => i.index === index);
    const el = scan.elements[index];
    const ctx = scan.contexts[index];
    if (!item || !el || !ctx) continue;
    if (fillElement(el, ctx, item.value)) {
      highlight(el as HTMLElement, item.score >= HIGH ? 'high' : 'low');
      ok++;
    } else {
      failed++;
    }
  }
  const tail = failed ? `，${failed} 项无法自动写入（可能是下拉选项不匹配）` : '';
  panel?.setStatus(ok ? `已填充 ${ok} 项，请逐项核对后再提交${tail}` : `没有写入任何字段${tail}`, ok ? 'ok' : 'warn');
}

async function switchProfile(id: string): Promise<void> {
  const s = await getState();
  s.activeProfileId = id;
  await saveState(s);
  state = s;
  await runScan();
}

async function runAI(): Promise<void> {
  const s = await getState();
  const p = getPanel();
  if (!s.settings.llm.enabled) {
    p.setStatus('AI 补识别未开启，请到设置页配置接口后再用', 'warn');
    return;
  }
  if (!unmatched.length) {
    p.setStatus('没有需要 AI 识别的字段', 'info');
    return;
  }
  p.setBusy(true);
  p.setStatus(`正在用 AI 识别 ${unmatched.length} 个未匹配字段…`);
  try {
    const resume = activeProfile(s).data;
    const mapping = await suggestMapping(unmatched, resume, s.settings);
    let added = 0;
    for (const [index, key] of mapping) {
      const ctx = scan?.contexts[index];
      if (!ctx) continue;
      const value = resolveValue(key, resume, ctx);
      if (!value) continue;
      if (s.settings.fillEmptyOnly && ctx.currentValue.trim()) continue;
      if (items.some((i) => i.index === index)) continue;
      items.push({
        index,
        label: FIELD_LABEL[key] ?? key,
        value,
        score: 0.65,
        section: ctx.section,
        checked: false,
        reason: 'AI 识别（建议人工确认）',
        kind: 'custom',
      });
      added++;
    }
    items.sort((a, b) => a.index - b.index);
    panel?.setItems(items);
    panel?.setStatus(added ? `AI 补充识别 ${added} 项，默认未勾选，请确认后填充` : 'AI 没能识别出更多字段', added ? 'ok' : 'warn');
  } catch (err) {
    panel?.setStatus(`AI 识别失败：${(err as Error).message}`, 'err');
  } finally {
    panel?.setBusy(false);
  }
}

function boot(): void {
  if (!document.body) return;
  const start = () => {
    void (async () => {
      const s = await getState();
      const host = location.hostname;
      if (isHostDisabled(host, s.settings)) return;
      const p = getPanel();
      if (s.settings.showPanelOnLoad) {
        p.open();
        await runScan();
      } else if (countLikelyFields(document) >= 3) {
        p.showLauncher(true);
      }
    })();
  };

  if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 2000 });
  else setTimeout(start, 800);
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg: { type?: string }) => {
    if (msg?.type === 'RA_TOGGLE_PANEL') {
      const p = getPanel();
      p.mount();
      if (p.isOpen()) {
        p.close();
      } else {
        p.open();
        void runScan();
      }
      return false;
    }
    if (msg?.type === 'RA_PING') {
      return false;
    }
    return false;
  });

  chrome.storage?.onChanged?.addListener(() => {
    state = null;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
