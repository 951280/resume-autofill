import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  Education,
  ProjectExperience,
  ResumeData,
  ResumeProfile,
  StoredState,
  WorkExperience,
} from '../shared/types.ts';
import { activeProfile, loadState, saveState } from '../shared/storage.ts';
import { createDefaultProfile, emptyResume, uid } from '../shared/defaultProfile.ts';
import { testLlm } from '../shared/llmClient.ts';
import './app.css';

type TabKey = 'basic' | 'intention' | 'education' | 'work' | 'project' | 'skills' | 'custom' | 'settings';

const TABS: Array<{ key: TabKey; label: string; hint: string }> = [
  { key: 'basic', label: '基本信息', hint: '姓名、联系方式、证件' },
  { key: 'intention', label: '求职意向', hint: '岗位、城市、到岗' },
  { key: 'education', label: '教育经历', hint: '学校 / 专业 / 时间' },
  { key: 'work', label: '工作经历', hint: '公司 / 职位 / 职责' },
  { key: 'project', label: '项目经历', hint: '项目 / 技术栈 / 职责' },
  { key: 'skills', label: '技能与荣誉', hint: '技能、证书、获奖' },
  { key: 'custom', label: '自定义字段', hint: '表单里其它问题的答案' },
  { key: 'settings', label: '设置', hint: '填充策略、AI、站点' },
];

/* ------------------------------------------------------------------ 小组件 */

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  wide?: boolean;
}) {
  return (
    <label className={`field${props.wide ? ' wide' : ''}`}>
      <span className="field-label">{props.label}</span>
      <input
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

function Area(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="field wide">
      <span className="field-label">{props.label}</span>
      <textarea
        rows={props.rows ?? 3}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

function Card(props: { title: string; onRemove?: () => void; children: ReactNode }) {
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">{props.title}</span>
        {props.onRemove && (
          <button className="link danger" onClick={props.onRemove}>
            删除
          </button>
        )}
      </div>
      <div className="grid">{props.children}</div>
    </div>
  );
}

const splitLines = (v: string) => v.split('\n');
const joinLines = (v: string[] | undefined) => (v ?? []).join('\n');

/* ------------------------------------------------------------------ 主组件 */

export default function App() {
  const [store, setStore] = useState<StoredState | null>(null);
  const [tab, setTab] = useState<TabKey>('basic');
  const [toast, setToast] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const loaded = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadState().then((s) => {
      setStore(s);
      loaded.current = true;
    });
  }, []);

  useEffect(() => {
    if (!store || !loaded.current) return;
    const t = setTimeout(() => void saveState(store), 400);
    return () => clearTimeout(t);
  }, [store]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }, []);

  const profile = store ? activeProfile(store) : null;

  const patchData = useCallback((fn: (data: ResumeData) => void) => {
    setStore((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        profiles: prev.profiles.map((p) => {
          if (p.id !== prev.activeProfileId) return p;
          const data = structuredClone(p.data);
          fn(data);
          return { ...p, data, updatedAt: Date.now() };
        }),
      };
    });
  }, []);

  const patchProfileMeta = useCallback((fn: (p: ResumeProfile) => ResumeProfile) => {
    setStore((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        profiles: prev.profiles.map((p) => (p.id === prev.activeProfileId ? fn(p) : p)),
      };
    });
  }, []);

  const patchSettings = useCallback((fn: (s: StoredState['settings']) => void) => {
    setStore((prev) => {
      if (!prev) return prev;
      const settings = structuredClone(prev.settings);
      fn(settings);
      return { ...prev, settings };
    });
  }, []);

  const addProfile = (kind: 'blank' | 'copy' | 'default') => {
    setStore((prev) => {
      if (!prev) return prev;
      const current = activeProfile(prev);
      let next: ResumeProfile;
      if (kind === 'default') next = createDefaultProfile();
      else if (kind === 'copy') {
        next = {
          id: uid('p_'),
          title: `${current.title} 副本`,
          data: structuredClone(current.data),
          updatedAt: Date.now(),
        };
      } else {
        next = { id: uid('p_'), title: '新简历', data: emptyResume(), updatedAt: Date.now() };
      }
      return { ...prev, profiles: [...prev.profiles, next], activeProfileId: next.id };
    });
    flash('已新建简历');
  };

  const removeProfile = () => {
    if (!store || store.profiles.length <= 1) return;
    if (!confirm(`确定删除简历「${profile?.title}」？此操作不可撤销。`)) return;
    setStore((prev) => {
      if (!prev) return prev;
      const profiles = prev.profiles.filter((p) => p.id !== prev.activeProfileId);
      return { ...prev, profiles, activeProfileId: profiles[0].id };
    });
  };

  const exportJson = () => {
    if (!profile) return;
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.title}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as ResumeProfile;
      if (!parsed?.data?.basic) throw new Error('文件格式不对');
      const next: ResumeProfile = {
        id: uid('p_'),
        title: parsed.title || '导入的简历',
        data: parsed.data,
        updatedAt: Date.now(),
      };
      setStore((prev) => (prev ? { ...prev, profiles: [...prev.profiles, next], activeProfileId: next.id } : prev));
      flash('导入成功');
    } catch (err) {
      flash(`导入失败：${(err as Error).message}`);
    }
  };

  if (!store || !profile) {
    return <div className="loading">载入中…</div>;
  }

  const d = profile.data;

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <span className="brand-logo">简</span>
          <div>
            <div className="brand-title">简历秒填</div>
            <div className="brand-sub">数据只存在本机</div>
          </div>
        </div>

        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <span className="tab-label">{t.label}</span>
              <span className="tab-hint">{t.hint}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <select
            className="profile-select"
            value={store.activeProfileId}
            onChange={(e) =>
              setStore((prev) => (prev ? { ...prev, activeProfileId: e.target.value } : prev))
            }
          >
            {store.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          <input
            className="title-input"
            value={profile.title}
            onChange={(e) => patchProfileMeta((p) => ({ ...p, title: e.target.value }))}
            placeholder="简历名称"
          />

          <div className="spacer" />

          <button className="btn ghost" onClick={() => addProfile('blank')}>新建</button>
          <button className="btn ghost" onClick={() => addProfile('copy')}>复制</button>
          <button className="btn ghost" onClick={exportJson}>导出</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>导入</button>
          <button className="btn ghost danger" onClick={removeProfile} disabled={store.profiles.length <= 1}>
            删除
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
              e.target.value = '';
            }}
          />
        </header>

        <section className="content">
          {tab === 'basic' && (
            <div className="grid two">
              <Field label="姓名" value={d.basic.name} onChange={(v) => patchData((x) => { x.basic.name = v; })} />
              <Field label="性别" value={d.basic.gender ?? ''} onChange={(v) => patchData((x) => { x.basic.gender = v; })} placeholder="男 / 女" />
              <Field label="出生日期" value={d.basic.birthday ?? ''} onChange={(v) => patchData((x) => { x.basic.birthday = v; })} placeholder="2000-03-03" />
              <Field label="手机号" value={d.basic.phone} onChange={(v) => patchData((x) => { x.basic.phone = v; })} />
              <Field label="邮箱" value={d.basic.email} onChange={(v) => patchData((x) => { x.basic.email = v; })} />
              <Field label="政治面貌" value={d.basic.politicalStatus ?? ''} onChange={(v) => patchData((x) => { x.basic.politicalStatus = v; })} placeholder="中共党员 / 共青团员 / 群众" />
              <Field label="民族" value={d.basic.ethnicity ?? ''} onChange={(v) => patchData((x) => { x.basic.ethnicity = v; })} />
              <Field label="身份证号" value={d.basic.idCard ?? ''} onChange={(v) => patchData((x) => { x.basic.idCard = v; })} />
              <Field label="现居城市" value={d.basic.city ?? ''} onChange={(v) => patchData((x) => { x.basic.city = v; })} placeholder="芜湖" />
              <Field label="籍贯" value={d.basic.hometown ?? ''} onChange={(v) => patchData((x) => { x.basic.hometown = v; })} />
              <Field label="GitHub" value={d.basic.github ?? ''} onChange={(v) => patchData((x) => { x.basic.github = v; })} />
              <Field label="个人主页" value={d.basic.website ?? ''} onChange={(v) => patchData((x) => { x.basic.website = v; })} />
              <Area label="详细地址" value={d.basic.address ?? ''} onChange={(v) => patchData((x) => { x.basic.address = v; })} rows={2} />
            </div>
          )}

          {tab === 'intention' && (
            <div className="grid two">
              <Field label="期望岗位" value={d.intention.position} onChange={(v) => patchData((x) => { x.intention.position = v; })} />
              <Field label="期望城市" value={(d.intention.cities ?? []).join('、')} onChange={(v) => patchData((x) => { x.intention.cities = v.split(/[、,，/\s]+/).filter(Boolean); })} placeholder="杭州、深圳" />
              <Field label="工作性质" value={d.intention.jobType ?? ''} onChange={(v) => patchData((x) => { x.intention.jobType = v; })} placeholder="实习 / 全职" />
              <Field label="期望薪资" value={d.intention.salary ?? ''} onChange={(v) => patchData((x) => { x.intention.salary = v; })} />
              <Field label="到岗时间" value={d.intention.availableDate ?? ''} onChange={(v) => patchData((x) => { x.intention.availableDate = v; })} />
              <Field label="每周实习天数" value={d.intention.internDaysPerWeek ?? ''} onChange={(v) => patchData((x) => { x.intention.internDaysPerWeek = v; })} />
              <Field label="可实习时长" value={d.intention.internDuration ?? ''} onChange={(v) => patchData((x) => { x.intention.internDuration = v; })} />
            </div>
          )}

          {tab === 'education' && (
            <div className="stack">
              {d.educations.map((edu, i) => (
                <Card key={edu.id} title={`教育经历 ${i + 1}`} onRemove={() => patchData((x) => { x.educations.splice(i, 1); })}>
                  <Field label="学校" value={edu.school} onChange={(v) => patchData((x) => { x.educations[i].school = v; })} />
                  <Field label="专业" value={edu.major} onChange={(v) => patchData((x) => { x.educations[i].major = v; })} />
                  <Field label="学历" value={edu.degree} onChange={(v) => patchData((x) => { x.educations[i].degree = v; })} placeholder="本科 / 硕士" />
                  <Field label="开始时间" value={edu.startDate} onChange={(v) => patchData((x) => { x.educations[i].startDate = v; })} placeholder="2018-09" />
                  <Field label="结束时间" value={edu.endDate} onChange={(v) => patchData((x) => { x.educations[i].endDate = v; })} placeholder="2022-06" />
                  <Field label="GPA" value={edu.gpa ?? ''} onChange={(v) => patchData((x) => { x.educations[i].gpa = v; })} />
                  <Field label="排名" value={edu.rank ?? ''} onChange={(v) => patchData((x) => { x.educations[i].rank = v; })} />
                  <Area label="补充说明" value={edu.description ?? ''} onChange={(v) => patchData((x) => { x.educations[i].description = v; })} />
                </Card>
              ))}
              <button
                className="btn add"
                onClick={() =>
                  patchData((x) => {
                    const item: Education = { id: uid('e_'), school: '', major: '', degree: '', startDate: '', endDate: '' };
                    x.educations.push(item);
                  })
                }
              >
                + 添加教育经历
              </button>
            </div>
          )}

          {tab === 'work' && (
            <div className="stack">
              {d.works.map((w, i) => (
                <Card key={w.id} title={`工作经历 ${i + 1}`} onRemove={() => patchData((x) => { x.works.splice(i, 1); })}>
                  <Field label="公司" value={w.company} onChange={(v) => patchData((x) => { x.works[i].company = v; })} />
                  <Field label="职位" value={w.position} onChange={(v) => patchData((x) => { x.works[i].position = v; })} />
                  <Field label="城市" value={w.city ?? ''} onChange={(v) => patchData((x) => { x.works[i].city = v; })} />
                  <Field label="开始时间" value={w.startDate} onChange={(v) => patchData((x) => { x.works[i].startDate = v; })} />
                  <Field label="结束时间" value={w.endDate} onChange={(v) => patchData((x) => { x.works[i].endDate = v; })} placeholder="留空表示至今" />
                  <Area label="职责描述" value={w.description} onChange={(v) => patchData((x) => { x.works[i].description = v; })} rows={5} placeholder="每行一条，用「关键词：」开头更易读" />
                </Card>
              ))}
              <button
                className="btn add"
                onClick={() =>
                  patchData((x) => {
                    const item: WorkExperience = { id: uid('w_'), company: '', position: '', startDate: '', endDate: '', description: '' };
                    x.works.push(item);
                  })
                }
              >
                + 添加工作经历
              </button>
            </div>
          )}

          {tab === 'project' && (
            <div className="stack">
              {d.projects.map((p, i) => (
                <Card key={p.id} title={`项目经历 ${i + 1}`} onRemove={() => patchData((x) => { x.projects.splice(i, 1); })}>
                  <Field label="项目名称" value={p.name} onChange={(v) => patchData((x) => { x.projects[i].name = v; })} />
                  <Field label="角色" value={p.role ?? ''} onChange={(v) => patchData((x) => { x.projects[i].role = v; })} />
                  <Field label="开始时间" value={p.startDate ?? ''} onChange={(v) => patchData((x) => { x.projects[i].startDate = v; })} />
                  <Field label="结束时间" value={p.endDate ?? ''} onChange={(v) => patchData((x) => { x.projects[i].endDate = v; })} placeholder="留空表示至今" />
                  <Field label="技术栈" value={p.techStack ?? ''} onChange={(v) => patchData((x) => { x.projects[i].techStack = v; })} wide />
                  <Field label="项目链接" value={p.link ?? ''} onChange={(v) => patchData((x) => { x.projects[i].link = v; })} wide />
                  <Area label="项目职责" value={p.description} onChange={(v) => patchData((x) => { x.projects[i].description = v; })} rows={5} />
                </Card>
              ))}
              <button
                className="btn add"
                onClick={() =>
                  patchData((x) => {
                    const item: ProjectExperience = { id: uid('j_'), name: '', description: '' };
                    x.projects.push(item);
                  })
                }
              >
                + 添加项目经历
              </button>
            </div>
          )}

          {tab === 'skills' && (
            <div className="stack">
              <Area label="专业技能（每行一条）" value={joinLines(d.skills)} onChange={(v) => patchData((x) => { x.skills = splitLines(v); })} rows={6} />
              <Area label="证书（每行一条）" value={joinLines(d.certificates)} onChange={(v) => patchData((x) => { x.certificates = splitLines(v); })} rows={3} />
              <Area label="获奖 / 荣誉（每行一条）" value={joinLines(d.awards)} onChange={(v) => patchData((x) => { x.awards = splitLines(v); })} rows={3} />
              <Area label="语言能力（每行一条）" value={joinLines(d.languages)} onChange={(v) => patchData((x) => { x.languages = splitLines(v); })} rows={2} />
              <Area label="自我评价" value={d.selfEvaluation} onChange={(v) => patchData((x) => { x.selfEvaluation = v; })} rows={6} />
            </div>
          )}

          {tab === 'custom' && (
            <div className="stack">
              <p className="note">
                招聘表单里那些标准字段之外的问题（如「紧急联系人」「是否服从调剂」），在这里按
                <b> 表单上的标签名 </b>配置，匹配到时直接填进去。
              </p>
              {d.custom.map((item, i) => (
                <div className="custom-row" key={i}>
                  <input
                    className="custom-label"
                    value={item.label}
                    placeholder="表单标签，如 紧急联系人"
                    onChange={(e) => patchData((x) => { x.custom[i].label = e.target.value; })}
                  />
                  <textarea
                    rows={2}
                    value={item.value}
                    placeholder="填写内容"
                    onChange={(e) => patchData((x) => { x.custom[i].value = e.target.value; })}
                  />
                  <button className="btn ghost danger" onClick={() => patchData((x) => { x.custom.splice(i, 1); })}>
                    删除
                  </button>
                </div>
              ))}
              <button className="btn add" onClick={() => patchData((x) => { x.custom.push({ label: '', value: '' }); })}>
                + 添加自定义字段
              </button>
            </div>
          )}

          {tab === 'settings' && (
            <div className="stack">
              <div className="card">
                <div className="card-head"><span className="card-title">填充策略</span></div>
                <div className="grid">
                  <label className="field wide">
                    <span className="field-label">最低匹配分：{Math.round(store.settings.minScore * 100)}%</span>
                    <input
                      type="range"
                      min={30}
                      max={95}
                      step={5}
                      value={Math.round(store.settings.minScore * 100)}
                      onChange={(e) => patchSettings((s) => { s.minScore = Number(e.target.value) / 100; })}
                    />
                    <span className="field-hint">分数低于该值的字段不显示，避免乱填。</span>
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={store.settings.fillEmptyOnly}
                      onChange={(e) => patchSettings((s) => { s.fillEmptyOnly = e.target.checked; })}
                    />
                    只填充空字段，不动页面里已有内容
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={store.settings.showPanelOnLoad}
                      onChange={(e) => patchSettings((s) => { s.showPanelOnLoad = e.target.checked; })}
                    />
                    打开页面时自动展开面板并扫描
                  </label>
                  <Area
                    label="在这些网站上一律不启用（每行一个域名）"
                    value={store.settings.disabledHosts.join('\n')}
                    onChange={(v) => patchSettings((s) => { s.disabledHosts = v.split('\n').map((x) => x.trim()).filter(Boolean); })}
                    rows={3}
                    placeholder={'hr.example.com'}
                  />
                </div>
              </div>

              <div className="card">
                <div className="card-head"><span className="card-title">AI 补识别（可选，默认关闭）</span></div>
                <div className="grid">
                  <label className="check wide">
                    <input
                      type="checkbox"
                      checked={store.settings.llm.enabled}
                      onChange={(e) => patchSettings((s) => { s.llm.enabled = e.target.checked; })}
                    />
                    启用：规则没认出来的字段，点「AI 补识别」时发给大模型判断
                  </label>
                  <Field
                    label="接口地址（OpenAI 兼容）"
                    value={store.settings.llm.baseUrl}
                    onChange={(v) => patchSettings((s) => { s.llm.baseUrl = v; })}
                    placeholder="https://api.deepseek.com/v1"
                    wide
                  />
                  <Field label="模型" value={store.settings.llm.model} onChange={(v) => patchSettings((s) => { s.llm.model = v; })} />
                  <Field
                    label="API Key"
                    value={store.settings.llm.apiKey}
                    onChange={(v) => patchSettings((s) => { s.llm.apiKey = v; })}
                    placeholder="sk-..."
                  />
                  <div className="row-actions">
                    <button
                      className="btn"
                      onClick={async () => {
                        setTestMsg('测试中…');
                        try {
                          setTestMsg(await testLlm(store.settings));
                        } catch (err) {
                          setTestMsg(`失败：${(err as Error).message}`);
                        }
                      }}
                    >
                      测试连接
                    </button>
                    <span className="field-hint">{testMsg}</span>
                  </div>
                  <p className="note">
                    Key 只写进本机 chrome.storage，不会随插件同步；开启后简历中的字段摘要会发送给你填写的接口。
                  </p>
                </div>
              </div>

              <div className="card">
                <div className="card-head"><span className="card-title">数据</span></div>
                <p className="note">
                  所有简历数据保存在本机浏览器里，不上传任何服务器。卸载插件或清除浏览器数据会一并删除，建议定期用「导出」备份。
                </p>
                <div className="row-actions">
                  <button className="btn ghost" onClick={() => addProfile('default')}>追加一份示例简历</button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
