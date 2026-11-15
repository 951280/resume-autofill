import type { FieldKey, SectionKey } from './types.ts';

/**
 * 文本归一化：全角转半角、压空白、转小写。
 * 匹配统一在 compact() 后的字符串上做，能消掉「姓 名」「* 姓名：」这类噪声。
 */
export function normalizeText(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/[\uFF01-\uFF5E]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    )
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** 去掉空白与常见标点，只留语义字符 */
export function compact(raw: string | null | undefined): string {
  return normalizeText(raw).replace(
    /[\s\-_:：*＊·.,，。、;；!！?？"'“”‘’()（）[\]【】{}<>《》/\\|~`^+=%#@&]/g,
    '',
  );
}

export interface FieldRule {
  key: FieldKey;
  /** 面板 / 调试用的中文名 */
  label: string;
  /**
   * name / id / autocomplete 的强匹配 token。
   * 对比前同样走 compact()，所以 full_name / fullName / full-name 都会归一为 fullname。
   */
  tokens?: string[];
  /** 在标签 / placeholder / aria-label / 相邻文本上匹配（compact 后） */
  patterns: RegExp[];
  /** 命中任一负向词则该规则作废，用于消歧（如「姓名拼音」不是姓名） */
  negative?: RegExp[];
  /** 处于这些区块时加权 */
  preferredSections?: SectionKey[];
  /** 处于这些区块时降权（如工作经历里的「职位」不是求职意向） */
  avoidSections?: SectionKey[];
}

export const RULES: FieldRule[] = [
  {
    key: 'name',
    label: '姓名',
    tokens: ['name', 'realname', 'fullname', 'truename', 'username', 'xm', 'applicantname', 'contactname'],
    patterns: [/姓名/, /真实姓名/, /^名字$/, /fullname/, /yourname/, /realname/, /applicantname/],
    negative: [/拼音/, /pinyin/, /英文名/, /englishname/, /昵称/, /nickname/, /曾用名/, /公司名/, /项目名/, /学校名/, /文件名/, /账号/, /account/, /密码/, /password/],
  },
  {
    key: 'nameEn',
    label: '英文名 / 拼音',
    tokens: ['englishname', 'namepinyin', 'pinyin', 'spellname'],
    patterns: [/英文名/, /英文姓名/, /姓名拼音/, /姓名英文/, /englishname/, /^pinyin$/],
  },
  {
    key: 'gender',
    label: '性别',
    tokens: ['gender', 'sex', 'xb'],
    patterns: [/^性别$/, /性别/, /^gender$/, /^sex$/],
    negative: [/性别偏好/, /性别要求/, /性别不限/],
  },
  {
    key: 'birthday',
    label: '出生日期',
    tokens: ['birthday', 'birthdate', 'birth', 'dob', 'csrq'],
    patterns: [/出生日期/, /出生年月/, /出生时间/, /^生日$/, /dateofbirth/, /birthday/, /birthdate/, /^dob$/],
    negative: [/出生地/, /籍贯/],
  },
  {
    key: 'age',
    label: '年龄',
    tokens: ['age', 'nl'],
    patterns: [/^年龄$/, /年龄/, /^age$/],
    negative: [/年龄段/, /年龄要求/],
  },
  {
    key: 'phone',
    label: '手机号',
    tokens: ['phone', 'mobile', 'tel', 'telephone', 'cellphone', 'sj', 'lxdh', 'phonenumber', 'mobilephone', 'contactphone'],
    patterns: [/手机号码/, /手机号/, /^手机$/, /联系电话/, /电话号码/, /^电话$/, /联系方式/, /移动电话/, /^phone$/, /^mobile$/, /^tel$/, /phonenumber/, /mobilephone/],
    negative: [/验证码/, /区号/, /传真/, /紧急联系/, /座机/, /固话/, /归属地/, /手机型号/],
  },
  {
    key: 'email',
    label: '邮箱',
    tokens: ['email', 'mail', 'emailaddress', 'mailaddress', 'yx'],
    patterns: [/电子邮箱/, /邮箱地址/, /电子邮件/, /^邮箱$/, /^邮件$/, /^email$/, /^e-mail$/, /emailaddress/],
    negative: [/验证码/, /邮件订阅/],
  },
  {
    key: 'wechat',
    label: '微信',
    tokens: ['wechat', 'weixin', 'wx'],
    patterns: [/微信号/, /^微信$/, /wechat/, /weixin/],
    negative: [/公众号/, /微信群/, /二维码/],
  },
  {
    key: 'qq',
    label: 'QQ',
    tokens: ['qq', 'qqnumber'],
    patterns: [/^qq号$/, /^qq$/, /qq号码/],
    negative: [/qq群/, /邮箱/],
  },
  {
    key: 'city',
    label: '现居城市',
    tokens: ['city', 'currentcity', 'livecity', 'cs'],
    patterns: [/现居城市/, /居住城市/, /所在城市/, /当前城市/, /现居地/, /所在地区/, /^城市$/, /^city$/],
    negative: [/期望/, /意向/, /目标/, /工作地点/, /出生地/, /籍贯/, /户口/, /邮编/, /公司地址/],
  },
  {
    key: 'address',
    label: '详细地址',
    tokens: ['address', 'addr', 'homeaddress', 'contactaddress'],
    patterns: [/详细地址/, /现居住地/, /居住地址/, /现住址/, /联系地址/, /通讯地址/, /家庭地址/, /^地址$/, /^address$/],
    negative: [/邮箱/, /email/, /网址/, /url/, /邮编/, /公司地址/, /学校地址/],
  },
  {
    key: 'hometown',
    label: '籍贯',
    tokens: ['hometown', 'nativeplace', 'jg'],
    patterns: [/籍贯/, /出生地/, /户口所在地/, /户籍所在地/, /户籍/, /生源地/, /家乡/],
  },
  {
    key: 'politicalStatus',
    label: '政治面貌',
    tokens: ['politicalstatus', 'zzmm'],
    patterns: [/政治面貌/],
  },
  {
    key: 'ethnicity',
    label: '民族',
    tokens: ['ethnicity', 'nation', 'mz'],
    patterns: [/^民族$/, /民族/],
    negative: [/民族团结/, /民族要求/],
  },
  {
    key: 'nationality',
    label: '国籍',
    tokens: ['nationality', 'country'],
    patterns: [/^国籍$/, /国籍/, /^nationality$/],
  },
  {
    key: 'maritalStatus',
    label: '婚姻状况',
    tokens: ['maritalstatus', 'marriage', 'marital'],
    patterns: [/婚姻状况/, /^婚否$/, /婚姻/],
  },
  {
    key: 'idCard',
    label: '身份证号',
    tokens: ['idcard', 'idnumber', 'cardno', 'sfzh', 'identity'],
    patterns: [/身份证号/, /身份证号码/, /证件号码/, /^身份证$/],
    negative: [/有效期/, /证件类型/, /身份证正面/, /身份证反面/],
  },
  {
    key: 'github',
    label: 'GitHub',
    tokens: ['github', 'giturl', 'gitee'],
    patterns: [/^github$/, /github/, /git地址/, /代码仓库/, /开源地址/, /gitee/],
  },
  {
    key: 'website',
    label: '个人主页',
    tokens: ['website', 'homepage', 'blog', 'portfolio', 'personalwebsite'],
    patterns: [/个人主页/, /个人网站/, /^博客$/, /作品集/, /portfolio/, /homepage/, /personalwebsite/],
  },
  {
    key: 'position',
    label: '求职意向',
    tokens: ['position', 'jobtitle', 'applyposition', 'expectposition', 'desiredposition', 'job'],
    patterns: [/应聘职位/, /期望职位/, /意向职位/, /求职意向/, /应聘岗位/, /期望岗位/, /意向岗位/, /目标职位/, /应聘方向/, /期望从事/, /appliedposition/, /desiredposition/],
    avoidSections: ['work'],
    negative: [/当前职位/, /现任职位/, /离职原因/, /职位要求/],
  },
  {
    key: 'expectedCity',
    label: '期望城市',
    tokens: ['expectcity', 'desiredcity', 'workcity', 'jobcity'],
    patterns: [/期望工作城市/, /期望城市/, /意向城市/, /期望工作地点/, /期望地点/, /工作城市/, /期望工作地/, /意向地区/, /工作地点/, /期望地区/],
  },
  {
    key: 'expectedSalary',
    label: '期望薪资',
    tokens: ['salary', 'expectsalary', 'desiredsalary', 'pay'],
    patterns: [/期望薪资/, /薪资要求/, /期望月薪/, /期望年薪/, /期望待遇/, /^薪资$/, /expectedsalary/],
    negative: [/当前薪资/, /现薪/, /薪资结构/],
  },
  {
    key: 'jobType',
    label: '工作性质',
    tokens: ['jobtype', 'employmenttype', 'worktype'],
    patterns: [/求职类型/, /工作性质/, /工作类型/, /^工作方式$/, /jobtype/, /employmenttype/],
  },
  {
    key: 'availableDate',
    label: '到岗时间',
    tokens: ['available', 'onboard', 'arrivaldate', 'reportdate'],
    patterns: [/可到岗时间/, /到岗时间/, /入职时间/, /最快到岗/, /可入职/, /期望到岗/, /到岗日期/, /可到岗/],
  },
  {
    key: 'internDays',
    label: '每周实习天数',
    tokens: ['interndays', 'daysperweek'],
    patterns: [/每周实习天数/, /实习天数/, /每周可实习/, /一周到岗天数/, /每周工作天数/, /可实习天数/, /每周出勤/],
  },
  {
    key: 'internDuration',
    label: '实习时长',
    tokens: ['internduration', 'internperiod'],
    patterns: [/实习时长/, /可实习时长/, /实习期限/, /^实习期$/, /可实习几个月/, /实习几个月/],
  },
  {
    key: 'workYears',
    label: '工作年限',
    tokens: ['workyears', 'experienceyears', 'yearsofexperience'],
    patterns: [/工作年限/, /工作经验年限/, /工作年数/, /yearsofexperience/],
  },
  {
    key: 'school',
    label: '学校',
    tokens: ['school', 'university', 'college', 'institution', 'graduationschool', 'shool'],
    patterns: [/毕业院校/, /学校名称/, /就读学校/, /院校名称/, /^学校$/, /^院校$/, /^school$/, /university/, /^college$/],
    preferredSections: ['education'],
    negative: [/学校地址/, /学校性质/, /学校类型/, /院系/, /学校排名/],
  },
  {
    key: 'major',
    label: '专业',
    tokens: ['major', 'profession', 'specialty', 'subject'],
    patterns: [/所学专业/, /专业名称/, /^专业$/, /^major$/, /fieldofstudy/, /^subject$/],
    preferredSections: ['education'],
  },
  {
    key: 'degree',
    label: '学历',
    tokens: ['degree', 'education', 'edulevel', 'educationlevel', 'xl'],
    patterns: [/最高学历/, /^学历$/, /学历层次/, /^学位$/, /^degree$/, /educationlevel/, /edulevel/],
    preferredSections: ['education', 'basic'],
    negative: [/学历要求/, /学历性质/, /学历认证/],
  },
  {
    key: 'educationStart',
    label: '入学时间',
    tokens: ['educationstart', 'schoolstart', 'enrolldate'],
    patterns: [/入学时间/, /入学日期/, /在校开始/, /^开始时间$/, /^起始时间$/, /^开始日期$/],
    preferredSections: ['education'],
  },
  {
    key: 'educationEnd',
    label: '毕业时间',
    tokens: ['educationend', 'graduationdate', 'graduate'],
    patterns: [/毕业时间/, /毕业日期/, /^结束时间$/, /^截止时间$/, /^结束日期$/],
    preferredSections: ['education'],
  },
  {
    key: 'gpa',
    label: 'GPA',
    tokens: ['gpa', 'grade', 'averagescore'],
    patterns: [/^gpa$/, /绩点/, /平均绩点/, /学分绩点/, /平均分/],
    preferredSections: ['education'],
    negative: [/成绩单/],
  },
  {
    key: 'rank',
    label: '排名',
    tokens: ['rank', 'ranking', 'classrank'],
    patterns: [/专业排名/, /年级排名/, /班级排名/, /^排名$/, /percentile/],
    preferredSections: ['education'],
  },
  {
    key: 'company',
    label: '公司',
    tokens: ['company', 'companyname', 'employer', 'organization', 'corp', 'gs'],
    patterns: [/公司名称/, /工作单位/, /单位名称/, /任职公司/, /就职公司/, /^公司$/, /^单位$/, /^company$/, /employer/],
    preferredSections: ['work'],
    negative: [/公司地址/, /公司规模/, /公司性质/, /公司行业/, /公司网站/],
  },
  {
    key: 'workPosition',
    label: '职位',
    tokens: ['workposition', 'jobname', 'duty', 'zw'],
    patterns: [/^职位$/, /^岗位$/, /^职务$/, /职位名称/, /岗位名称/, /^position$/, /^jobtitle$/],
    preferredSections: ['work'],
  },
  {
    key: 'workStart',
    label: '入职时间',
    tokens: ['workstart', 'joindate'],
    patterns: [/入职时间/, /^开始时间$/, /^起始时间$/, /^开始日期$/],
    preferredSections: ['work'],
  },
  {
    key: 'workEnd',
    label: '离职时间',
    tokens: ['workend', 'leavedate', 'resigndate'],
    patterns: [/离职时间/, /离职日期/, /^结束时间$/, /^截止时间$/, /^结束日期$/],
    preferredSections: ['work'],
  },
  {
    key: 'projectName',
    label: '项目名称',
    tokens: ['projectname', 'projname'],
    patterns: [/项目名称/, /^项目名$/, /^项目$/],
    preferredSections: ['project'],
  },
  {
    key: 'projectRole',
    label: '项目角色',
    tokens: ['projectrole', 'role'],
    patterns: [/担任角色/, /项目角色/, /^角色$/, /^职务$/, /承担职责/],
    preferredSections: ['project'],
  },
  {
    key: 'projectStart',
    label: '项目开始时间',
    patterns: [/^开始时间$/, /^起始时间$/, /项目开始/],
    preferredSections: ['project'],
  },
  {
    key: 'projectEnd',
    label: '项目结束时间',
    patterns: [/^结束时间$/, /^截止时间$/, /项目结束/],
    preferredSections: ['project'],
  },
  {
    key: 'techStack',
    label: '技术栈',
    tokens: ['techstack', 'technology', 'tech'],
    patterns: [/技术栈/, /使用技术/, /开发技术/, /技术选型/, /主要技术/, /技术关键词/],
    preferredSections: ['project'],
  },
  {
    key: 'link',
    label: '项目链接',
    tokens: ['projectlink', 'projecturl', 'repourl'],
    patterns: [/项目链接/, /项目地址/, /成果链接/, /仓库地址/, /^链接$/, /^网址$/, /^url$/],
    preferredSections: ['project'],
  },
  {
    key: 'description',
    label: '描述',
    tokens: ['description', 'desc', 'content', 'detail', 'remark', 'duty', 'responsibility'],
    patterns: [/工作内容/, /工作描述/, /工作职责/, /职责描述/, /职务描述/, /实习内容/, /项目描述/, /项目内容/, /项目职责/, /个人职责/, /主要工作/, /内容描述/, /^描述$/, /^详情$/, /^说明$/, /description/, /responsibility/],
    negative: [/项目名称/, /公司名称/],
  },
  {
    key: 'dateRange',
    label: '起止时间',
    tokens: ['daterange', 'period', 'duration'],
    patterns: [/起止时间/, /时间范围/, /起止年月/, /在校时间/, /任职时间/, /^时间段$/],
  },
  {
    key: 'selfEvaluation',
    label: '自我评价',
    tokens: ['selfevaluation', 'selfintroduction', 'summary', 'aboutme', 'introduction'],
    patterns: [/自我评价/, /个人评价/, /自我介绍/, /个人优势/, /个人简介/, /自我描述/, /个人总结/, /^简介$/, /aboutme/],
  },
  {
    key: 'skills',
    label: '专业技能',
    tokens: ['skills', 'skill', 'skillset'],
    patterns: [/专业技能/, /技能特长/, /技能描述/, /技能标签/, /^技能$/, /^skills?$/],
  },
  {
    key: 'certificates',
    label: '证书',
    tokens: ['certificate', 'cert', 'certificates'],
    patterns: [/资格证书/, /所获证书/, /技能证书/, /^证书$/, /执业资格/, /certificate/],
  },
  {
    key: 'awards',
    label: '获奖情况',
    tokens: ['awards', 'honors', 'honor', 'reward'],
    patterns: [/获奖情况/, /^获奖$/, /^荣誉$/, /奖项/, /奖励经历/, /奖学金/, /awards?/, /honors?/],
  },
  {
    key: 'languages',
    label: '语言能力',
    tokens: ['languages', 'language', 'englishlevel'],
    patterns: [/语言能力/, /外语水平/, /英语水平/, /语言等级/],
  },
];

export const SECTION_KEYWORDS: Array<{ section: SectionKey; re: RegExp }> = [
  { section: 'intention', re: /求职意向|求职意愿|意向岗位|期望工作|求职方向/ },
  { section: 'education', re: /教育经历|教育背景|学习经历|学历信息|教育信息|教育情况/ },
  { section: 'work', re: /工作经历|工作经验|实习经历|工作履历|职业经历|任职经历/ },
  { section: 'project', re: /项目经历|项目经验|项目展示|项目情况/ },
  { section: 'basic', re: /基本信息|个人信息|联系方式|个人资料|基本资料/ },
];

export function guessSection(text: string | null | undefined): SectionKey | null {
  if (!text) return null;
  const c = compact(text);
  if (!c) return null;
  for (const item of SECTION_KEYWORDS) {
    if (item.re.test(c)) return item.section;
  }
  return null;
}

export const SECTION_LABEL: Record<SectionKey, string> = {
  basic: '基本信息',
  intention: '求职意向',
  education: '教育经历',
  work: '工作经历',
  project: '项目经历',
  other: '其他',
};

export const FIELD_LABEL: Record<FieldKey, string> = RULES.reduce(
  (acc, r) => {
    acc[r.key] = r.label;
    return acc;
  },
  {} as Record<FieldKey, string>,
);
