import type { ResumeData, ResumeProfile, Settings } from './types.ts';

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

export const DEFAULT_SETTINGS: Settings = {
  minScore: 0.55,
  fillEmptyOnly: false,
  showPanelOnLoad: false,
  disabledHosts: [],
  llm: {
    enabled: false,
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
  },
};

/**
 * 示例简历（虚构人物），仅用于首次安装时演示填充流程。
 * 真实信息请在设置页「导入」或直接编辑，不要写回源码。
 */
const RESUME: ResumeData = {
  basic: {
    name: '张明',
    gender: '男',
    birthday: '2000-03-03',
    phone: '13800138000',
    email: 'zhangming@example.com',
    city: '杭州',
    address: '浙江省杭州市西湖区文一西路 1 号',
    hometown: '江苏省南京市',
    politicalStatus: '中共党员',
    ethnicity: '汉',
    github: 'https://github.com/example',
  },

  intention: {
    position: '前端开发工程师',
    cities: ['杭州', '上海'],
    jobType: '实习',
    salary: '面议',
    availableDate: '随时可实习',
    internDaysPerWeek: '5',
    internDuration: '6 个月以上',
  },

  educations: [
    {
      id: 'edu1',
      school: '示例大学',
      major: '计算机科学与技术',
      degree: '硕士',
      startDate: '2024-09',
      endDate: '2027-06',
      rank: '专业前 30%',
      description: '示例数据，可在设置页替换为自己的经历。',
    },
    {
      id: 'edu2',
      school: '示例学院',
      major: '计算机科学与技术',
      degree: '本科',
      startDate: '2018-09',
      endDate: '2022-06',
      gpa: '8.249/10',
      rank: '专业前 20%',
    },
  ],

  works: [
    {
      id: 'work1',
      company: '示例科技有限公司',
      position: '前端开发工程师',
      startDate: '2022-06',
      endDate: '2023-01',
      city: '西安',
      description:
        '示例工作内容：负责内部 OA 考勤审批模块的页面开发与交互实现，对接后端接口完成表单校验与数据渲染。\n' +
        '示例工作内容：基于 Vue2 + Ant Design Vue 封装条件筛选、关键字搜索等复用组件。',
    },
  ],

  projects: [
    {
      id: 'proj1',
      name: '基于大模型的智能取名小程序',
      role: '个人项目负责人',
      startDate: '2024-06',
      endDate: '',
      techStack: 'uni-app、Vue3（组合式 API）、FastAPI、SQLAlchemy（异步）、LangChain、DeepSeek、Pydantic',
      link: 'https://github.com/example/ai-name-app',
      description:
        '示例项目：基于 uni-app 与 Vue3 完成页面搭建，处理表单、loading、结果展示与错误提示。\n' +
        '示例项目：使用 LangChain 组织 Prompt 调用大模型，Pydantic 校验输出为固定结构。',
    },
    {
      id: 'proj2',
      name: '多任务协同多目标进化特征选择算法（GF-McMoEFS）',
      role: '论文第一作者',
      startDate: '2026-01',
      endDate: '',
      techStack: 'MATLAB、多目标进化算法、特征选择、机器学习',
      link: 'https://github.com/example/feature-selection',
      description: '示例科研内容：提出主任务与辅助任务协同的多目标进化特征选择框架。',
    },
  ],

  skills: [
    '前端：HTML/CSS/JavaScript（ES6+）、Vue3、uni-app，具备页面搭建与接口联调能力。',
    '后端：了解 Python、FastAPI、SQLAlchemy（异步）、MySQL。',
  ],

  certificates: ['英语四级（CET-4）'],
  awards: ['示例奖项，可替换为自己的荣誉'],
  languages: ['英语（CET-4）'],

  selfEvaluation: '示例自我评价：这里写一段 2-3 行的自我介绍，说明技术栈、项目经验与求职意向。',

  /** 招聘表单里那些「非标准」但常出现的字段，按标签名直接命中 */
  custom: [
    { label: '紧急联系人', value: '王五' },
    { label: '紧急联系人电话', value: '13900139000' },
    { label: '是否服从调剂', value: '是' },
    { label: '能否接受出差', value: '能' },
    { label: '计算机等级', value: '无' },
  ],
};

export function createDefaultProfile(): ResumeProfile {
  return {
    id: uid('p_'),
    title: '示例简历',
    data: structuredClone(RESUME),
    updatedAt: Date.now(),
  };
}

export function emptyResume(): ResumeData {
  return {
    basic: { name: '', phone: '', email: '' },
    intention: { position: '', cities: [] },
    educations: [],
    works: [],
    projects: [],
    skills: [],
    certificates: [],
    awards: [],
    languages: [],
    selfEvaluation: '',
    custom: [],
  };
}
