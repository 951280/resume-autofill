import type { Settings } from './types.ts';

/**
 * LLM 兜底：仅用规则匹配不上的控件去问模型。
 * 走 OpenAI 兼容的 /chat/completions，Key 只存在本机的 chrome.storage 里。
 * 默认关闭，只有用户在设置里显式打开并且点「AI 补识别」时才会发起请求。
 */

const SYSTEM_PROMPT = `你是一个网页表单字段识别助手。用户会给你一批招聘网站表单控件的信息，以及一份简历可用的字段列表。
请判断每个控件对应哪个字段。只输出 JSON，格式：{"mappings":[{"index":0,"field":"phone"}]}
- field 必须是给定字段列表中的一个；无法判断时用空字符串 ""。
- 不要输出解释，不要输出 markdown 代码块。`;

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

function headers(apiKey: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
}

export async function testLlm(settings: Settings): Promise<string> {
  const { baseUrl, apiKey, model } = settings.llm;
  if (!baseUrl || !apiKey) throw new Error('请先填写接口地址与 API Key');

  const res = await fetch(endpoint(baseUrl), {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({
      model,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}：${text.slice(0, 160)}`);
  }
  return '连接正常';
}
