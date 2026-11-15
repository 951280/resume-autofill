import type { ControlContext, CustomMatch, FieldKey, FieldMatch, SectionKey } from './types.ts';
import type { FieldRule } from './dictionary.ts';
import { FIELD_LABEL, RULES, compact } from './dictionary.ts';

interface Source {
  name: string;
  read: (c: ControlContext) => string;
  weight: number;
}

/** 不同文本来源的可信度：label 最可信，相邻文本最弱 */
const SOURCES: Source[] = [
  { name: 'label', read: (c) => c.labelText, weight: 0.92 },
  { name: 'aria-label', read: (c) => c.ariaLabel, weight: 0.88 },
  { name: 'placeholder', read: (c) => c.placeholder, weight: 0.86 },
  { name: 'title', read: (c) => c.title, weight: 0.8 },
  { name: 'name/id', read: (c) => `${c.name} ${c.id}`, weight: 0.78 },
  { name: '相邻文本', read: (c) => c.nearbyText, weight: 0.66 },
];

/** 命中阈值：低于它的结果直接丢弃，避免瞎填 */
export const MATCH_FLOOR = 0.5;

function scoreRule(rule: FieldRule, ctx: ControlContext, corpus: string): FieldMatch | null {
  if (rule.negative && rule.negative.some((re) => re.test(corpus))) return null;

  let base = 0;
  let reason = '';

  // 1. name / id / autocomplete 的精确 token 命中，可信度最高
  if (rule.tokens && rule.tokens.length) {
    const attrs = [compact(ctx.name), compact(ctx.id), compact(ctx.autocomplete)];
    for (const token of rule.tokens) {
      if (attrs.includes(token)) {
        base = 0.98;
        reason = `name/id 属性 = ${token}`;
        break;
      }
    }
  }

  // 2. 标签文本与字段中文名完全一致
  if (!base) {
    const labelCompact = compact(ctx.labelText);
    if (labelCompact && labelCompact === compact(rule.label)) {
      base = 0.96;
      reason = `标签完全一致「${rule.label}」`;
    }
  }

  // 3. 正则匹配各文本来源，取最高权重
  if (!base) {
    let best = 0;
    let bestSource = '';
    for (const src of SOURCES) {
      const text = compact(src.read(ctx));
      if (!text) continue;
      for (const re of rule.patterns) {
        if (re.test(text)) {
          if (src.weight > best) {
            best = src.weight;
            bestSource = src.name;
          }
          break;
        }
      }
    }
    if (best === 0) return null;
    base = best;
    reason = `${bestSource} 命中「${rule.label}」`;
  }

  let score = base;

  // 4. 区块加权：同一个「职位」，在求职意向里是意向岗位，在工作经历里是任职职位
  if (rule.preferredSections?.includes(ctx.section)) score += 0.1;
  if (rule.avoidSections?.includes(ctx.section)) score -= 0.25;

  return {
    key: rule.key,
    score: Math.max(0, Math.min(1, score)),
    reason,
  };
}

/** 单个控件的字段识别（只走内置词典） */
export function matchControl(ctx: ControlContext): FieldMatch | null {
  const corpus = compact(
    [ctx.labelText, ctx.ariaLabel, ctx.placeholder, ctx.title, ctx.name, ctx.id, ctx.nearbyText].join(' '),
  );
  if (!corpus) return null;

  let best: FieldMatch | null = null;
  for (const rule of RULES) {
    const hit = scoreRule(rule, ctx, corpus);
    if (!hit) continue;
    if (!best || hit.score > best.score) best = hit;
  }
  if (!best || best.score < MATCH_FLOOR) return null;
  return best;
}

/**
 * 自定义字段匹配：简历里 custom[] 的 label 与控件标签做同名 / 包含匹配。
 * 用来兜住「紧急联系人」「档案所在地」「是否服从调剂」这类词典覆盖不到的表单。
 */
export function matchCustom(
  ctx: ControlContext,
  customs: Array<{ label: string; value: string }>,
): CustomMatch | null {
  if (!customs.length) return null;
  const sources = [
    { text: ctx.labelText, w: 0.93 },
    { text: ctx.nearbyText, w: 0.9 },
    { text: ctx.ariaLabel, w: 0.86 },
    { text: ctx.placeholder, w: 0.8 },
  ];

  let best: CustomMatch | null = null;
  for (const item of customs) {
    const target = compact(item.label);
    if (target.length < 2) continue;
    for (const src of sources) {
      const text = compact(src.text);
      if (!text) continue;
      let score = 0;
      if (text === target) score = src.w + 0.05;
      else if (text.includes(target)) score = src.w - 0.1;
      else if (target.includes(text) && text.length >= 4) score = src.w - 0.18;
      if (score > 0 && (!best || score > best.score)) {
        best = {
          label: item.label,
          score: Math.min(1, score),
          reason: `自定义字段「${item.label}」`,
        };
      }
    }
  }
  return best && best.score >= MATCH_FLOOR ? best : null;
}

export interface MatchedItem {
  index: number;
  fieldKey?: FieldKey;
  customLabel?: string;
  label: string;
  score: number;
  reason: string;
  section: SectionKey;
}

function dedupeKey(item: MatchedItem): string {
  if (item.customLabel) return `custom:${item.customLabel}`;
  if (item.fieldKey === 'description') return `description:${item.section}`;
  return `key:${item.fieldKey}`;
}

/**
 * 批量识别 + 去重。
 * 同一个字段在同一页只保留分数最高的控件；description 按区块区分，
 * 因为一页里工作经历和项目经历各有一个描述框。
 */
export function matchAll(
  contexts: ControlContext[],
  customs: Array<{ label: string; value: string }> = [],
): Array<MatchedItem | null> {
  const items: Array<MatchedItem | null> = contexts.map((ctx) => {
    const ruleMatch = matchControl(ctx);
    const customMatch = matchCustom(ctx, customs);

    if (ruleMatch && (!customMatch || ruleMatch.score >= customMatch.score)) {
      return {
        index: ctx.index,
        fieldKey: ruleMatch.key,
        label: FIELD_LABEL[ruleMatch.key] ?? ruleMatch.key,
        score: ruleMatch.score,
        reason: ruleMatch.reason,
        section: ctx.section,
      };
    }
    if (customMatch) {
      return {
        index: ctx.index,
        customLabel: customMatch.label,
        label: customMatch.label,
        score: customMatch.score,
        reason: customMatch.reason,
        section: ctx.section,
      };
    }
    return null;
  });

  const bestByKey = new Map<string, number>();
  items.forEach((item, i) => {
    if (!item) return;
    const key = dedupeKey(item);
    const prev = bestByKey.get(key);
    if (prev === undefined || item.score > items[prev]!.score) bestByKey.set(key, i);
  });

  items.forEach((item, i) => {
    if (!item) return;
    if (bestByKey.get(dedupeKey(item)) !== i) items[i] = null;
  });

  return items;
}

export function describeControl(ctx: ControlContext): string {
  const bits = [ctx.labelText, ctx.placeholder, ctx.ariaLabel, ctx.name, ctx.id]
    .map((s) => (s || '').trim())
    .filter(Boolean);
  return bits[0] || `${ctx.tag}[${ctx.type}] #${ctx.index}`;
}
