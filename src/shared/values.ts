import type { ControlContext, FieldKey, ResumeData } from './types.ts';

const pad2 = (v: string | number) => String(v).padStart(2, '0');

/**
 * 简历里统一存 YYYY-MM，但目标输入框可能是 date / month / 文本。
 * 这里按控件类型和 placeholder 提示猜一个最可能的格式，填错也能在预览里看到。
 */
export function formatDateForInput(value: string | undefined, ctx: ControlContext): string {
  if (!value) return '';
  const m = /^(\d{4})[-./年]?\s*(\d{1,2})(?:[-./月]?\s*(\d{1,2}))?/.exec(value.trim());
  if (!m) return value.trim();
  const [, y, mo, d] = m;
  const type = (ctx.type || '').toLowerCase();

  if (type === 'date') return `${y}-${pad2(mo)}-${pad2(d ?? '01')}`;
  if (type === 'month') return `${y}-${pad2(mo)}`;
  if (type === 'number') return y;

  const hint = `${ctx.placeholder} ${ctx.labelText} ${ctx.ariaLabel}`;
  if (/yyyy\s*[/-]\s*mm/i.test(hint)) {
    const sep = /yyyy\s*\/\s*mm/i.test(hint) ? '/' : '-';
    return `${y}${sep}${pad2(mo)}`;
  }
  if (/年/.test(hint) && /月/.test(hint)) return `${y}年${Number(mo)}月`;
  return `${y}.${pad2(mo)}`;
}

function joinList(list: string[] | undefined, ctx: ControlContext, sep = '、'): string {
  if (!list || !list.length) return '';
  const tag = ctx.tag.toLowerCase();
  const multiline = tag === 'textarea' || ctx.type === 'textarea' || ctx.options.length > 8;
  return list.join(multiline ? '\n' : sep);
}

/** 自定义字段取值 */
export function resolveCustomValue(label: string, resume: ResumeData): string {
  const hit = resume.custom.find((c) => c.label === label);
  return (hit?.value ?? '').trim();
}

/** 按字段 key 从简历里取值，取不到返回空串（调用方据此跳过） */
export function resolveValue(key: FieldKey, resume: ResumeData, ctx: ControlContext): string {
  const b = resume.basic;
  const it = resume.intention;
  const edu = resume.educations[0];
  const work = resume.works[0];
  const proj = resume.projects[0];
  const s = (v?: string) => (v ?? '').trim();

  switch (key) {
    case 'name': return s(b.name);
    case 'nameEn': return s(b.nameEn);
    case 'gender': return s(b.gender);
    case 'birthday': return formatDateForInput(b.birthday, ctx);
    case 'age': {
      if (!b.birthday) return '';
      const y = Number(b.birthday.slice(0, 4));
      if (!y) return '';
      return String(new Date().getFullYear() - y);
    }
    case 'phone': return s(b.phone);
    case 'email': return s(b.email);
    case 'wechat': return s(b.wechat);
    case 'qq': return s(b.qq);
    case 'city': return s(b.city);
    case 'address': return s(b.address);
    case 'hometown': return s(b.hometown);
    case 'politicalStatus': return s(b.politicalStatus);
    case 'ethnicity': return s(b.ethnicity);
    case 'nationality': return s(b.nationality);
    case 'maritalStatus': return s(b.maritalStatus);
    case 'idCard': return s(b.idCard);
    case 'github': return s(b.github);
    case 'website': return s(b.website);

    case 'position': return s(it.position);
    case 'expectedCity': return joinList(it.cities, ctx);
    case 'expectedSalary': return s(it.salary);
    case 'jobType': return s(it.jobType);
    case 'availableDate': return s(it.availableDate);
    case 'internDays': return s(it.internDaysPerWeek);
    case 'internDuration': return s(it.internDuration);
    case 'workYears': return '';

    case 'school': return s(edu?.school);
    case 'major': return s(edu?.major);
    case 'degree': return s(edu?.degree);
    case 'educationStart': return formatDateForInput(edu?.startDate, ctx);
    case 'educationEnd': return edu?.endDate ? formatDateForInput(edu.endDate, ctx) : '至今';
    case 'gpa': return s(edu?.gpa) || s(resume.educations.find((e) => e.gpa)?.gpa);
    case 'rank': return s(edu?.rank) || s(resume.educations.find((e) => e.rank)?.rank);

    case 'company': return s(work?.company);
    case 'workPosition': return s(work?.position);
    case 'workStart': return formatDateForInput(work?.startDate, ctx);
    case 'workEnd': return work?.endDate ? formatDateForInput(work.endDate, ctx) : '至今';

    case 'projectName': return s(proj?.name);
    case 'projectRole': return s(proj?.role);
    case 'projectStart': return formatDateForInput(proj?.startDate, ctx);
    case 'projectEnd': return proj?.endDate ? formatDateForInput(proj.endDate, ctx) : '至今';
    case 'techStack': return s(proj?.techStack);
    case 'link': return s(proj?.link);

    case 'description': {
      if (ctx.section === 'work') return s(work?.description);
      if (ctx.section === 'project') return s(proj?.description);
      if (ctx.section === 'education') return s(edu?.description);
      return s(work?.description) || s(proj?.description) || s(edu?.description);
    }
    case 'dateRange': {
      if (ctx.section === 'work' && work) {
        return `${formatDateForInput(work.startDate, ctx)} - ${work.endDate ? formatDateForInput(work.endDate, ctx) : '至今'}`;
      }
      if (ctx.section === 'project' && proj) {
        return `${formatDateForInput(proj.startDate, ctx)} - ${proj.endDate ? formatDateForInput(proj.endDate, ctx) : '至今'}`;
      }
      if (edu) {
        return `${formatDateForInput(edu.startDate, ctx)} - ${edu.endDate ? formatDateForInput(edu.endDate, ctx) : '至今'}`;
      }
      return '';
    }

    case 'selfEvaluation': return s(resume.selfEvaluation);
    case 'skills': return joinList(resume.skills, ctx);
    case 'certificates': return joinList(resume.certificates, ctx);
    case 'awards': return joinList(resume.awards, ctx);
    case 'languages': return joinList(resume.languages, ctx);

    default: return '';
  }
}
