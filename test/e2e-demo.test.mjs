import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'demo', 'apply.html'), 'utf8');

const dom = new JSDOM(html, { url: 'http://127.0.0.1:8000/apply.html', pretendToBeVisual: true });
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
const { resolveValue, resolveCustomValue } = await import('../src/shared/values.ts');
const { fillElement } = await import('../src/content/filler.ts');
const { createDefaultProfile } = await import('../src/shared/defaultProfile.ts');

const resume = createDefaultProfile().data;

test('演示表单：扫描 + 匹配 + 填充全流程', () => {
  const { contexts, elements } = scanPage(document);
  const matches = matchAll(contexts, resume.custom);

  const filled = {};
  let filledCount = 0;

  contexts.forEach((ctx, i) => {
    const m = matches[i];
    if (!m) return;
    const value = m.customLabel
      ? resolveCustomValue(m.customLabel, resume)
      : resolveValue(m.fieldKey, resume, ctx);
    if (!value) return;
    const ok = fillElement(elements[i], ctx, value);
    if (!ok) return;
    filledCount++;
    filled[ctx.name || ctx.id] = value;
  });

  // 覆盖率：演示页有 38 个可填控件，全部都应该命中
  assert.ok(filledCount >= 37, `实际填充 ${filledCount} 项，少于预期`);

  // 关键字段逐个核对
  assert.equal(filled.realName, '张明');
  assert.equal(filled.mobile, '13800138000');
  assert.equal(filled.email, 'zhangming@example.com');
  assert.equal(filled.birthday, '2000-03-03');
  assert.equal(filled.nation, '汉');
  assert.equal(filled.politicalStatus, '中共党员');
  assert.equal(filled.emergencyContact, '王五');
  assert.equal(filled.emergencyPhone, '13900139000');
  assert.equal(filled.school, '示例大学');
  assert.equal(filled.jobTitle, '前端开发工程师');
  assert.equal(filled.gpa, '8.249/10');
  assert.equal(filled.expectPosition, '前端开发工程师');
  assert.equal(filled.onboardDate, '随时可实习');

  // radio 真的被选中
  const male = document.querySelector('input[name="gender"][value="1"]');
  assert.equal(male.checked, true);
  const adjust = document.querySelector('input[name="adjust"][value="1"]');
  assert.equal(adjust.checked, true);

  // 下拉框选到了「硕士研究生」而不是「本科」
  const degree = document.querySelector('select[name="degree"]');
  assert.equal(degree.selectedOptions[0].textContent, '硕士研究生');
  const political = document.querySelector('select[name="politicalStatus"]');
  assert.equal(political.selectedOptions[0].textContent, '中共党员');

  // 长文本进了 textarea
  const workDesc = document.querySelector('textarea[name="workDesc"]');
  assert.match(workDesc.value, /OA/);
  assert.match(workDesc.value, /Ant Design Vue/);

  // 工作经历与项目经历的描述没有串台
  const projectDesc = document.querySelector('textarea[name="projectDesc"]');
  assert.match(projectDesc.value, /uni-app/);
  assert.doesNotMatch(projectDesc.value, /OA/);

  // 打印覆盖率，方便人工看一眼
  console.log(`\n  演示页控件 ${contexts.length} 个，成功填充 ${filledCount} 项`);
  console.log(`  识别到的字段：${[...new Set(contexts.map((c, i) => matches[i]?.label).filter(Boolean))].join('、')}\n`);
});
