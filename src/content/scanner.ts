import type { ControlContext, ControlElement, SectionKey } from '../shared/types.ts';
import { guessSection } from '../shared/dictionary.ts';

/**
 * 页面扫描：把「可能是一个可填字段」的控件连同它的上下文文本捞出来。
 * 这里只做采集，不做判断（判断在 matcher 里），方便单独测试。
 */

const SKIP_INPUT_TYPES = new Set([
  'hidden', 'submit', 'button', 'reset', 'image', 'file', 'password',
  'search', 'color', 'range', 'checkbox',
]);

const HEADING_SELECTOR =
  'legend,h1,h2,h3,h4,h5,h6,.ant-card-head-title,.el-card__header,[class*="title"],[class*="Title"],[class*="header"]';

/** jsdom 没有布局，用这个标记跳过尺寸相关的可见性判断 */
const HAS_LAYOUT =
  typeof document !== 'undefined' &&
  typeof document.documentElement.getBoundingClientRect === 'function' &&
  document.documentElement.getBoundingClientRect().height > 0;

function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const style = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
  if (style) {
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;
  }
  if (HAS_LAYOUT) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
  }
  return true;
}

function clean(text: string | null | undefined, max = 60): string {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/[*＊]\s*$/, '')
    .trim()
    .slice(0, max);
}

/** 显式关联的标签：<label for>、包裹 label、aria-labelledby */
function labelOf(el: HTMLElement): string {
  const parts: string[] = [];
  const native = el as HTMLInputElement;
  if (native.labels) {
    for (const label of Array.from(native.labels)) {
      const t = clean(label.textContent, 40);
      if (t) parts.push(t);
    }
  }
  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    for (const id of labelledby.split(/\s+/)) {
      const node = el.ownerDocument.getElementById(id);
      const t = clean(node?.textContent, 40);
      if (t) parts.push(t);
    }
  }
  return parts.join(' ').trim();
}

function prevSiblingText(el: Element, maxHops = 2): string {
  let node: Element | null = el;
  for (let hop = 0; hop < maxHops && node; hop++) {
    let sib = node.previousElementSibling;
    let guard = 0;
    while (sib && guard++ < 4) {
      const t = clean(sib.textContent, 40);
      // 太长的兄弟节点一般是内容区，不是标签
      if (t && t.length <= 30) return t;
      sib = sib.previousElementSibling;
    }
    node = node.parentElement;
  }
  return '';
}

/** 相邻文本：优先组件库的 form-item 标签，其次表格左侧单元格，最后相邻兄弟 */
function nearbyTextOf(el: HTMLElement): string {
  const pick = (sel: string): string => {
    const node = el.closest(sel);
    if (!node) return '';
    const label = node.querySelector(
      '.ant-form-item-label,.el-form-item__label,.ant-form-item__label,label,.arco-form-label-item',
    );
    return clean(label?.textContent, 40);
  };

  const fromItem =
    pick('.ant-form-item') ||
    pick('.el-form-item') ||
    pick('.arco-form-item') ||
    pick('.form-item, .form-group, .field, .form-row');
  if (fromItem) return fromItem;

  // 表格布局：上一列的 th / td 就是字段名
  const cell = el.closest('td,th');
  if (cell) {
    let sib = cell.previousElementSibling;
    let guard = 0;
    while (sib && guard++ < 3) {
      const t = clean(sib.textContent, 40);
      if (t && t.length <= 30) return t;
      sib = sib.previousElementSibling;
    }
  }

  // 定义列表
  const dl = el.closest('dd');
  if (dl?.previousElementSibling) {
    const t = clean(dl.previousElementSibling.textContent, 40);
    if (t) return t;
  }

  // data 属性里偶尔有中文标签
  const dataLabel = el.getAttribute('data-label') || el.getAttribute('data-title');
  if (dataLabel) return clean(dataLabel, 40);

  return prevSiblingText(el);
}

function detectSection(el: HTMLElement): { section: SectionKey; text: string } {
  const containers = [
    el.closest('fieldset'),
    el.closest('.ant-card'),
    el.closest('.el-card'),
    el.closest('[class*="section"]'),
    el.closest('section'),
  ];
  for (const container of containers) {
    if (!container) continue;
    const heading = container.querySelector(HEADING_SELECTOR);
    const text = clean(heading?.textContent, 30);
    const section = guessSection(text);
    if (section) return { section, text };
  }

  let node: Element | null = el;
  for (let depth = 0; depth < 8 && node; depth++) {
    // 容器自己的第一个子元素是标题（如 <div class="card"><h2>工作经历</h2>…）
    const first = node.firstElementChild;
    if (first && first !== el && !first.contains(el) && first.matches?.(HEADING_SELECTOR)) {
      const text = clean(first.textContent, 30);
      const section = guessSection(text);
      if (section) return { section, text };
    }

    let sib = node.previousElementSibling;
    let guard = 0;
    while (sib && guard++ < 6) {
      if (sib.matches?.(HEADING_SELECTOR)) {
        const text = clean(sib.textContent, 30);
        const section = guessSection(text);
        if (section) return { section, text };
      }
      sib = sib.previousElementSibling;
    }
    node = node.parentElement;
  }
  return { section: 'other', text: '' };
}

function currentValueOf(el: ControlElement): string {
  const anyEl = el as HTMLInputElement;
  if (typeof anyEl.value === 'string') return anyEl.value;
  return clean(el.textContent, 200);
}

/** radio 组的「字段名」= 容器文本减去各选项文本 */
function radioGroupLabel(first: HTMLInputElement, options: string[]): string {
  const container =
    first.closest('fieldset,.ant-form-item,.el-form-item,.arco-form-item,.form-item,.form-group,tr,td') ||
    first.parentElement?.parentElement;
  if (!container) return '';
  let text = container.textContent ?? '';
  for (const opt of options) text = text.split(opt).join(' ');
  return clean(text, 30);
}

function optionLabelOf(radio: HTMLInputElement): string {
  const native = radio.labels;
  if (native && native.length) return clean(native[0].textContent, 20);
  const parent = radio.closest('label');
  if (parent) return clean(parent.textContent, 20);
  const next = radio.nextSibling;
  if (next && next.nodeType === 3) return clean(next.textContent, 20);
  return clean(radio.value, 20);
}

export interface ScanResult {
  contexts: ControlContext[];
  /** 与 contexts 一一对应的真实元素（radio 组取第一个） */
  elements: ControlElement[];
}

export function scanPage(root: ParentNode = document): ScanResult {
  const contexts: ControlContext[] = [];
  const elements: ControlElement[] = [];

  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>(
      'input,textarea,select,[contenteditable=""],[contenteditable="true"]',
    ),
  );

  const radioGroups = new Map<string, HTMLInputElement[]>();

  for (const el of nodes) {
    if (el instanceof HTMLInputElement) {
      const type = (el.type || 'text').toLowerCase();
      if (SKIP_INPUT_TYPES.has(type)) continue;
      if (type === 'radio') {
        if (!el.name) continue;
        const list = radioGroups.get(el.name) ?? [];
        list.push(el);
        radioGroups.set(el.name, list);
        continue;
      }
    }
    if ((el as HTMLInputElement).disabled) continue;
    if ((el as HTMLInputElement).readOnly) continue;
    if (!isVisible(el)) continue;

    const section = detectSection(el);
    const tag = el.tagName.toLowerCase();
    const ctx: ControlContext = {
      index: contexts.length,
      tag,
      type: el.getAttribute('type') || (tag === 'textarea' ? 'textarea' : tag),
      name: el.getAttribute('name') || '',
      id: el.id || '',
      autocomplete: el.getAttribute('autocomplete') || '',
      placeholder: clean(el.getAttribute('placeholder'), 40),
      ariaLabel: clean(el.getAttribute('aria-label'), 40),
      title: clean(el.getAttribute('title'), 40),
      labelText: labelOf(el),
      nearbyText: nearbyTextOf(el),
      section: section.section,
      sectionText: section.text,
      options:
        el instanceof HTMLSelectElement
          ? Array.from(el.options)
              .map((o) => clean(o.text, 30))
              .filter(Boolean)
          : [],
      visible: true,
      disabled: false,
      required: el.hasAttribute('required') || /[*＊]/.test(el.getAttribute('aria-label') || ''),
      currentValue: currentValueOf(el),
      groupElements: undefined,
    };
    contexts.push(ctx);
    elements.push(el);
  }

  // radio 组：合并成一个上下文
  for (const [name, group] of radioGroups) {
    const visibleGroup = group.filter((r) => isVisible(r) && !r.disabled);
    if (!visibleGroup.length) continue;
    const first = visibleGroup[0];
    const options = visibleGroup.map(optionLabelOf).filter(Boolean);
    const section = detectSection(first);
    const checked = visibleGroup.find((r) => r.checked);
    const ctx: ControlContext = {
      index: contexts.length,
      tag: 'radio-group',
      type: 'radio',
      name,
      id: first.id || '',
      autocomplete: '',
      placeholder: '',
      ariaLabel: clean(first.getAttribute('aria-label'), 40),
      title: '',
      labelText: radioGroupLabel(first, options),
      nearbyText: nearbyTextOf(first),
      section: section.section,
      sectionText: section.text,
      options,
      visible: true,
      disabled: false,
      required: first.hasAttribute('required'),
      currentValue: checked ? optionLabelOf(checked) : '',
      groupElements: visibleGroup,
    };
    contexts.push(ctx);
    elements.push(first);
  }

  return { contexts, elements };
}

/** 轻量预检：页面上有没有值得弹面板的表单 */
export function countLikelyFields(root: ParentNode = document): number {
  const nodes = root.querySelectorAll<HTMLElement>(
    'input,textarea,select,[contenteditable="true"]',
  );
  let count = 0;
  for (const el of Array.from(nodes)) {
    if (el instanceof HTMLInputElement) {
      const type = (el.type || 'text').toLowerCase();
      if (SKIP_INPUT_TYPES.has(type)) continue;
    }
    if ((el as HTMLInputElement).disabled) continue;
    if (!isVisible(el)) continue;
    count++;
    if (count >= 3) return count;
  }
  return count;
}
