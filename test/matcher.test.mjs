import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

/** jsdom 没有布局，scanner 里会自动跳过尺寸可见性判断 */

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

const { scanPage } = await import('../src/content/scanner.ts');
const { matchAll } = await import('../src/shared/matcher.ts');
const { resolveValue } = await import('../src/shared/values.ts');
const { createDefaultProfile } = await import('../src/shared/defaultProfile.ts');

const resume = createDefaultProfile().data;

/** 扫描 + 匹配，返回 name → {key, score} */
function analyze(html, customs = []) {
  document.body.innerHTML = html;
  const { contexts } = scanPage(document);
  const matches = matchAll(contexts, customs);
  const out = new Map();
  contexts.forEach((ctx, i) => {
    const m = matches[i];
    if (!m) return;
    const name = ctx.name || ctx.id || `#${i}`;
    out.set(name, {
      key: m.fieldKey ?? `custom:${m.customLabel}`,
      label: m.label,
      score: m.score,
      section: m.section,
    });
  });
  return { contexts, matches, map: out };
}

/* ------------------------------------------------------------------ 表格布局 */

test('表格布局：th 作为字段名', () => {
  const { map } = analyze(`
    <table>
      <tr><th>姓名</th><td><input name="realName"></td></tr>
      <tr><th>手机号码</th><td><input name="mobile"></td></tr>
      <tr><th>电子邮箱</th><td><input name="email"></td></tr>
      <tr><th>最高学历</th><td>
        <select name="degree"><option>请选择</option><option>本科</option><option>硕士研究生</option></select>
      </td></tr>
    </table>
  `);

  assert.equal(map.get('realName').key, 'name');
  assert.equal(map.get('mobile').key, 'phone');
  assert.equal(map.get('email').key, 'email');
  assert.equal(map.get('degree').key, 'degree');
  assert.ok(map.get('mobile').score >= 0.85, '手机号应当高置信');
});

/* ---------------------------------------------------------------- 组件库布局 */

test('Ant Design 布局：form-item-label + 卡片标题推断区块', () => {
  const { map } = analyze(`
    <div class="ant-card">
      <div class="ant-card-head"><div class="ant-card-head-title">教育经历</div></div>
      <div class="ant-form-item">
        <div class="ant-form-item-label"><label>学校名称</label></div>
        <input id="eduSchool" />
      </div>
      <div class="ant-form-item">
        <div class="ant-form-item-label"><label>所学专业</label></div>
        <input id="eduMajor" />
      </div>
    </div>
  `);

  assert.equal(map.get('eduSchool').key, 'school');
  assert.equal(map.get('eduMajor').key, 'major');
  assert.equal(map.get('eduSchool').section, 'education');
});

/* ------------------------------------------------------------ 区块消歧：职位 */

test('「职位」在求职意向与工作经历里分别命中不同字段', () => {
  const { map } = analyze(`
    <section>
      <h3>求职意向</h3>
      <div><label>期望职位</label><input id="want" /></div>
    </section>
    <section>
      <h3>工作经历</h3>
      <div><label>职位</label><input id="worked" /></div>
    </section>
  `);

  assert.equal(map.get('want').key, 'position');
  assert.equal(map.get('worked').key, 'workPosition');
});

/* ------------------------------------------------------------------ 负向词 */

test('「姓名拼音」不能被当成姓名', () => {
  const { map } = analyze(`
    <div><label>姓名拼音</label><input id="pinyin" /></div>
  `);
  assert.equal(map.get('pinyin').key, 'nameEn');
});

test('「邮箱验证码」不能被当成邮箱', () => {
  const { map } = analyze(`
    <div><label>邮箱验证码</label><input id="code" /></div>
    <div><label>邮箱</label><input id="mail" /></div>
  `);
  assert.equal(map.get('code') ?? null, null);
  assert.equal(map.get('mail').key, 'email');
});

/* --------------------------------------------------------------- radio 组 */

test('radio 组按选项文本识别性别', () => {
  const { contexts, map } = analyze(`
    <div class="form-item">
      <label>性别</label>
      <label><input type="radio" name="gender" value="1">男</label>
      <label><input type="radio" name="gender" value="2">女</label>
    </div>
  `);

  assert.equal(map.get('gender').key, 'gender');
  const group = contexts.find((c) => c.name === 'gender');
  assert.equal(group.tag, 'radio-group');
  assert.deepEqual(group.options, ['男', '女']);
});

/* ------------------------------------------------------------- 自定义字段 */

test('自定义字段按标签名命中', () => {
  const customs = [
    { label: '紧急联系人', value: '王五' },
    { label: '是否服从调剂', value: '是' },
  ];
  const { map } = analyze(
    `
    <div><label>紧急联系人</label><input id="ec" /></div>
    <div><label>是否服从调剂</label>
      <label><input type="radio" name="adjust" value="1">是</label>
      <label><input type="radio" name="adjust" value="2">否</label>
    </div>
  `,
    customs,
  );

  assert.equal(map.get('ec').key, 'custom:紧急联系人');
  assert.equal(map.get('adjust').key, 'custom:是否服从调剂');
});

/* ------------------------------------------------------------ 隐藏/无关键 */

test('隐藏域与提交按钮不参与扫描', () => {
  const { contexts } = analyze(`
    <form>
      <input type="hidden" name="token" value="abc">
      <input type="submit" value="提交">
      <input type="text" name="nickname" placeholder="昵称">
    </form>
  `);
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].name, 'nickname');
});

/* --------------------------------------------------------------- 取值格式 */

test('日期按控件类型格式化，空结束时间输出「至今」', () => {
  const base = { ...resume };
  const dateCtx = { tag: 'input', type: 'date', placeholder: '', labelText: '', options: [] };
  assert.equal(resolveValue('educationEnd', base, dateCtx), '2027-06-01');

  const textCtx = { tag: 'input', type: 'text', placeholder: '', labelText: '', options: [] };
  assert.equal(resolveValue('educationEnd', base, textCtx), '2027.06');

  const workCtx = { tag: 'input', type: 'text', placeholder: '', labelText: '', options: [], section: 'work' };
  assert.equal(resolveValue('workEnd', base, workCtx), '2023.01');
});

test('描述字段按区块取对应经历', () => {
  const ctx = (section) => ({ tag: 'textarea', type: 'textarea', placeholder: '', labelText: '', options: [], section });
  assert.match(resolveValue('description', resume, ctx('work')), /OA/);
  assert.match(resolveValue('description', resume, ctx('project')), /uni-app/);
});
