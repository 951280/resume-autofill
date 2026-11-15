import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://jobs.example.com/apply',
  pretendToBeVisual: true,
});
const { window } = dom;

globalThis.window = window;
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.HTMLInputElement = window.HTMLInputElement;
globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement;
globalThis.HTMLSelectElement = window.HTMLSelectElement;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.Event = window.Event;
globalThis.InputEvent = window.InputEvent;

const { fillElement, highlight, clearHighlights } = await import('../src/content/filler.ts');

function mount(html) {
  document.body.innerHTML = html;
  return document.body;
}

const ctx = (extra = {}) => ({
  index: 0,
  tag: 'input',
  type: 'text',
  name: '',
  id: '',
  autocomplete: '',
  placeholder: '',
  ariaLabel: '',
  title: '',
  labelText: '',
  nearbyText: '',
  section: 'other',
  sectionText: '',
  options: [],
  visible: true,
  disabled: false,
  required: false,
  currentValue: '',
  ...extra,
});

test('文本框：写入值并派发 input / change 事件', () => {
  mount('<input id="name" type="text">');
  const el = document.getElementById('name');
  const events = [];
  el.addEventListener('input', () => events.push('input'));
  el.addEventListener('change', () => events.push('change'));

  assert.equal(fillElement(el, ctx(), '张明'), true);
  assert.equal(el.value, '张明');
  assert.deepEqual(events, ['input', 'change']);
});

test('number/date 控件也能写入', () => {
  mount('<input id="d" type="date">');
  const el = document.getElementById('d');
  assert.equal(fillElement(el, ctx({ type: 'date' }), '2027-06-01'), true);
  assert.equal(el.value, '2027-06-01');
});

test('下拉框：按文本模糊匹配选项', () => {
  mount(`
    <select id="deg">
      <option value="">请选择</option>
      <option value="1">本科</option>
      <option value="2">硕士研究生</option>
    </select>`);
  const el = document.getElementById('deg');

  assert.equal(fillElement(el, ctx({ tag: 'select' }), '硕士'), true);
  assert.equal(el.selectedOptions[0].textContent, '硕士研究生');
});

test('下拉框：没有任何相近选项时返回失败，不乱选', () => {
  mount(`
    <select id="city">
      <option value="">请选择</option>
      <option value="1">北京</option>
      <option value="2">上海</option>
    </select>`);
  const el = document.getElementById('city');
  assert.equal(fillElement(el, ctx({ tag: 'select' }), '杭州'), false);
  assert.equal(el.value, '');
});

test('radio 组：按选项文本选中', () => {
  mount(`
    <div>
      <label><input type="radio" name="sex" value="1">男</label>
      <label><input type="radio" name="sex" value="2">女</label>
    </div>`);
  const group = Array.from(document.querySelectorAll('input[name="sex"]'));

  assert.equal(fillElement(group[0], ctx({ tag: 'radio-group', groupElements: group }), '女'), true);
  assert.equal(group[1].checked, true);
  assert.equal(group[0].checked, false);
});

test('textarea 写入长文本', () => {
  mount('<textarea id="desc"></textarea>');
  const el = document.getElementById('desc');
  const text = '第一行\n第二行';
  assert.equal(fillElement(el, ctx({ tag: 'textarea' }), text), true);
  assert.equal(el.value, text);
});

test('空值不写入', () => {
  mount('<input id="x" type="text">');
  const el = document.getElementById('x');
  assert.equal(fillElement(el, ctx(), ''), false);
  assert.equal(el.value, '');
});

test('高亮可批量清除', () => {
  mount('<input id="a"><input id="b">');
  const a = document.getElementById('a');
  const b = document.getElementById('b');

  highlight(a, 'high');
  highlight(b, 'low');
  assert.equal(a.getAttribute('data-ra-highlight'), 'high');
  assert.equal(b.getAttribute('data-ra-highlight'), 'low');

  const cleared = clearHighlights(document);
  assert.equal(cleared, 2);
  assert.equal(a.hasAttribute('data-ra-highlight'), false);
});
