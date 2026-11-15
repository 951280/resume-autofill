import type { ControlContext, ControlElement } from '../shared/types.ts';

/**
 * 填充器：把值写进控件，并保证框架（React / Vue / Ant Design）能感知到变化。
 * 关键点是走原型上的原生 setter，再手动派发 input + change。
 */

const HIGHLIGHT_ATTR = 'data-ra-highlight';
const HIGH_COLOR = '#22c55e';
const LOW_COLOR = '#f59e0b';

const norm = (s: string) => (s || '').replace(/[\s\u3000]/g, '').toLowerCase();

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (desc?.set) desc.set.call(el, value);
  else el.value = value;

  el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: false }));
}

function labelOfRadio(radio: HTMLInputElement): string {
  const labels = radio.labels;
  if (labels && labels.length) return labels[0].textContent || '';
  const parent = radio.closest('label');
  if (parent) return parent.textContent || '';
  const next = radio.nextSibling;
  if (next && next.nodeType === 3) return next.textContent || '';
  return radio.value;
}

/** 下拉框选项模糊匹配：「本科」→「大学本科」，「硕士」→「硕士研究生」都能对上 */
function pickOption(el: HTMLSelectElement, value: string): HTMLOptionElement | null {
  const target = norm(value);
  if (!target) return null;
  const options = Array.from(el.options).filter((o) => !o.disabled);
  if (!options.length) return null;

  const byText = options.find((o) => norm(o.text) === target);
  if (byText) return byText;
  const byValue = options.find((o) => norm(o.value) === target);
  if (byValue) return byValue;

  const candidates = options.filter((o) => {
    const t = norm(o.text);
    if (!t) return false;
    const shorter = Math.min(t.length, target.length);
    return shorter >= 2 && (t.includes(target) || target.includes(t));
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => Math.abs(norm(a.text).length - target.length) - Math.abs(norm(b.text).length - target.length));
  return candidates[0];
}

function pickRadio(group: HTMLInputElement[], value: string): HTMLInputElement | null {
  const target = norm(value);
  if (!target) return null;
  const exact = group.find((r) => norm(labelOfRadio(r)) === target);
  if (exact) return exact;
  return (
    group.find((r) => {
      const t = norm(labelOfRadio(r));
      return t.length >= 1 && (t.includes(target) || target.includes(t));
    }) ?? null
  );
}

function setContentEditable(el: HTMLElement, value: string): boolean {
  el.focus();
  el.textContent = value;
  el.dispatchEvent(
    new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: value }),
  );
  el.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }),
  );
  return true;
}

/** 写入单个控件，返回是否成功 */
export function fillElement(el: ControlElement, ctx: ControlContext, value: string): boolean {
  if (!value) return false;

  // radio / checkbox 组
  if (ctx.groupElements && ctx.groupElements.length) {
    if (ctx.tag === 'radio-group') {
      const target = pickRadio(ctx.groupElements, value);
      if (!target) return false;
      if (!target.checked) target.click();
      return true;
    }
    return false;
  }

  if (el instanceof HTMLSelectElement) {
    const option = pickOption(el, value);
    if (!option) return false;
    el.value = option.value;
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  if (el instanceof HTMLTextAreaElement) {
    setNativeValue(el, value);
    return true;
  }

  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox' || el.type === 'radio') return false;
    setNativeValue(el, value);
    return true;
  }

  if (el.isContentEditable) return setContentEditable(el, value);
  return false;
}

/** 填充后打高亮环，用户一输入就自动消失 */
export function highlight(el: HTMLElement, level: 'high' | 'low'): void {
  el.style.setProperty('outline', `2px solid ${level === 'high' ? HIGH_COLOR : LOW_COLOR}`, 'important');
  el.style.setProperty('outline-offset', '1px', 'important');
  el.setAttribute(HIGHLIGHT_ATTR, level);

  const clear = () => {
    el.style.removeProperty('outline');
    el.style.removeProperty('outline-offset');
    el.removeAttribute(HIGHLIGHT_ATTR);
  };
  el.addEventListener('input', clear, { once: true });
  el.addEventListener('change', clear, { once: true });
}

export function clearHighlights(root: Document = document): number {
  const nodes = root.querySelectorAll<HTMLElement>(`[${HIGHLIGHT_ATTR}]`);
  nodes.forEach((el) => {
    el.style.removeProperty('outline');
    el.style.removeProperty('outline-offset');
    el.removeAttribute(HIGHLIGHT_ATTR);
  });
  return nodes.length;
}

export function scrollToElement(el: HTMLElement): void {
  try {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch {
    /* 忽略 */
  }
}
