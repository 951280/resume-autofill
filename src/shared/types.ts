/** 简历数据结构与字段标识。全部为纯类型，可被 Node 直接擦除类型后加载。 */

export interface BasicInfo {
  name: string;
  nameEn?: string;
  gender?: string;
  birthday?: string; // YYYY-MM-DD 或 YYYY-MM
  phone: string;
  email: string;
  wechat?: string;
  qq?: string;
  city?: string;
  address?: string;
  hometown?: string;
  politicalStatus?: string;
  ethnicity?: string;
  nationality?: string;
  maritalStatus?: string;
  idCard?: string;
  github?: string;
  website?: string;
}

export interface JobIntention {
  position: string;
  cities: string[];
  jobType?: string;
  salary?: string;
  availableDate?: string;
  internDaysPerWeek?: string;
  internDuration?: string;
}

export interface Education {
  id: string;
  school: string;
  major: string;
  degree: string;
  startDate: string; // YYYY-MM
  endDate: string; // YYYY-MM，空表示至今
  gpa?: string;
  rank?: string;
  city?: string;
  description?: string;
}

export interface WorkExperience {
  id: string;
  company: string;
  position: string;
  department?: string;
  startDate: string;
  endDate: string;
  city?: string;
  description: string;
}

export interface ProjectExperience {
  id: string;
  name: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  techStack?: string;
  link?: string;
  description: string;
}

export interface ResumeData {
  basic: BasicInfo;
  intention: JobIntention;
  educations: Education[];
  works: WorkExperience[];
  projects: ProjectExperience[];
  skills: string[];
  certificates: string[];
  awards: string[];
  languages: string[];
  selfEvaluation: string;
  /** 用户自定义字段，词典里匹配不到时可按标签名精确命中 */
  custom: Array<{ label: string; value: string }>;
}

export interface ResumeProfile {
  id: string;
  title: string;
  data: ResumeData;
  updatedAt: number;
}

export interface LlmSettings {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface Settings {
  /** 低于该分值不显示 / 不填充，0..1 */
  minScore: number;
  /** 只填充空字段，不动已填内容 */
  fillEmptyOnly: boolean;
  /** 打开页面时是否自动展开面板 */
  showPanelOnLoad: boolean;
  /** 这些域名上一律不启用 */
  disabledHosts: string[];
  llm: LlmSettings;
}

export interface StoredState {
  profiles: ResumeProfile[];
  activeProfileId: string;
  settings: Settings;
}

/** 页面上可被填充的控件 */
export type ControlElement =
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement
  | HTMLElement;

/** 控件所属区块，用于消歧（「职位」在求职意向 vs 工作经历里含义不同） */
export type SectionKey =
  | 'basic'
  | 'intention'
  | 'education'
  | 'work'
  | 'project'
  | 'other';

/** 扫描阶段采到的单个控件上下文 */
export interface ControlContext {
  index: number;
  tag: string;
  type: string;
  name: string;
  id: string;
  autocomplete: string;
  placeholder: string;
  ariaLabel: string;
  title: string;
  /** <label> 及其它显式关联文本 */
  labelText: string;
  /** 相邻文本、表格左侧单元格、表单 item 的标签等 */
  nearbyText: string;
  /** 所属区块推断 */
  section: SectionKey;
  /** 区块标题原文，方便调试 */
  sectionText: string;
  /** select / radio 的候选项文本 */
  options: string[];
  visible: boolean;
  disabled: boolean;
  required: boolean;
  /** 已填内容（用于 fillEmptyOnly 判断） */
  currentValue: string;
  /** radio / checkbox 同组元素（tag 为 'radio-group' / 'checkbox-group' 时使用） */
  groupElements?: HTMLInputElement[];
}

/** 匹配结果 */
export interface FieldMatch {
  key: FieldKey;
  score: number;
  reason: string;
}

/** 自定义字段的匹配结果（简历 custom 里的 label → value） */
export interface CustomMatch {
  label: string;
  score: number;
  reason: string;
}

export const FIELD_KEYS = [
  'name',
  'nameEn',
  'gender',
  'birthday',
  'age',
  'phone',
  'email',
  'wechat',
  'qq',
  'city',
  'address',
  'hometown',
  'politicalStatus',
  'ethnicity',
  'nationality',
  'maritalStatus',
  'idCard',
  'github',
  'website',
  'position',
  'expectedCity',
  'expectedSalary',
  'jobType',
  'availableDate',
  'internDays',
  'internDuration',
  'workYears',
  'school',
  'major',
  'degree',
  'educationStart',
  'educationEnd',
  'gpa',
  'rank',
  'company',
  'workPosition',
  'workStart',
  'workEnd',
  'projectName',
  'projectRole',
  'projectStart',
  'projectEnd',
  'techStack',
  'link',
  'description',
  'dateRange',
  'selfEvaluation',
  'skills',
  'certificates',
  'awards',
  'languages',
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];
