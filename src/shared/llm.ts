import type { ControlContext, FieldKey, ResumeData, Settings } from './types.ts';
import { FIELD_KEYS } from './types.ts';
import { FIELD_LABEL } from './dictionary.ts';

/**
 * LLM 兜底：仅用规则匹配不上的控件去问模型。
 * 走 OpenAI 兼容的 /chat/completions，Key 只存在本机的 chrome.storage 里。
 * 默认关闭，只有用户在设置里显式打开并且点「AI 补识别」时才会发起请求。
 */

const SYSTEM_PROMPT = `你是一个网页表单字段识别助手。用户会给你一批招聘网站表单控件的信息，以及一份简历可用的字段列表。
请判断每个控件对应哪个字段。只输出 JSON，格式：{"mappings":[{"index":0,"field":"phone"}]}
- field 必须是给定字段列表中的一个；无法判断时用空字符串 ""。
- 不要输出解释，不要输出 markdown 代码块。`;

function resumeSummary(resume: ResumeData): string {
  const edu = resume.educations[0];
  const work = resume.works[0];
  return JSON.stringify(
    {
      姓名: resume.basic.name,
      求职意向: resume.intention.position,
      最高学历: edu?.degree,
      最近公司: work?.company,
      最近职位: work?.position,
      技能: resume.skills.slice(0, 3),
    },
    null,
    0,
  );
}

interface LlmMapping {
  index: number;
  field: string;
}

export async function suggestMapping(
  contexts: ControlContext[],
  resume: ResumeData,
  settings: Settings,
): Promise<Map<number, FieldKey>> {
  const { baseUrl, apiKey, model } = settings.llm;
  if (!baseUrl || !apiKey) throw new Error('尚未配置 LLM 接口地址或 API Key');
  if (!contexts.length) return new Map();

  const payload = contexts.map((c) => ({
    index: c.index,
    tag: c.tag,
    type: c.type,
    name: c.name,
    id: c.id,
    placeholder: c.placeholder,
    ariaLabel: c.ariaLabel,
    label: c.labelText,
    nearby: c.nearbyText,
    section: c.sectionText,
    options: c.options.slice(0, 20),
  }));

  const userPrompt = [
    `简历摘要：${resumeSummary(resume)}`,
    `可用字段列表（key: 含义）：\n${FIELD_KEYS.map((k) => `${k}: ${FIELD_LABEL[k] ?? k}`).join('\n')}`,
    `待识别控件：\n${JSON.stringify(payload)}`,
  ].join('\n\n');

  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM 请求失败 ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = json.choices?.[0]?.message?.content ?? '{}';
  let parsed: { mappings?: LlmMapping[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = /\{[\s\S]*\}/.exec(raw);
    parsed = m ? JSON.parse(m[0]) : {};
  }

  const valid = new Set<string>(FIELD_KEYS);
  const out = new Map<number, FieldKey>();
  for (const item of parsed.mappings ?? []) {
    if (typeof item?.index !== 'number') continue;
    if (!item.field || !valid.has(item.field)) continue;
    out.set(item.index, item.field as FieldKey);
  }
  return out;
}
