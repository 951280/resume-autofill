import type { SectionKey } from '../shared/types.ts';
import { SECTION_LABEL } from '../shared/dictionary.ts';

export interface PlanItemVM {
  index: number;
  label: string;
  value: string;
  score: number;
  section: SectionKey;
  checked: boolean;
  reason: string;
  kind: 'rule' | 'custom';
}

export interface PanelOptions {
  onScan: () => void;
  onFill: (indices: number[]) => void;
  onClear: () => void;
  onProfileChange: (id: string) => void;
  onAI: () => void;
  onLocate: (index: number) => void;
  onClose: () => void;
}

const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const STYLE = `
:host { all: initial; }
* { box-sizing: border-box; margin: 0; padding: 0; }
.panel, .launcher { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }

.panel {
  position: fixed; right: 20px; bottom: 20px; width: 380px;
  max-height: min(72vh, 640px); display: flex; flex-direction: column;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 14px;
  box-shadow: 0 14px 44px rgba(15, 23, 42, .18), 0 2px 6px rgba(15, 23, 42, .06);
  overflow: hidden; font-size: 13px; color: #0f172a; line-height: 1.45;
}
.panel[hidden], .launcher[hidden] { display: none !important; }

.hd { display: flex; align-items: center; gap: 8px; padding: 11px 12px;
  background: linear-gradient(135deg, #1f3864, #2f5496); color: #fff; }
.logo { width: 20px; height: 20px; border-radius: 6px; background: rgba(255,255,255,.18);
  display: grid; place-items: center; font-size: 11px; font-weight: 700; }
.title { font-weight: 600; font-size: 13px; letter-spacing: .3px; }
.env { font-size: 10px; padding: 1px 6px; border-radius: 99px; background: rgba(255,255,255,.16); }
.spacer { flex: 1; }
.icon-btn { width: 22px; height: 22px; border: 0; border-radius: 6px; cursor: pointer;
  background: rgba(255,255,255,.14); color: #fff; font-size: 14px; line-height: 1; display: grid; place-items: center; }
.icon-btn:hover { background: rgba(255,255,255,.28); }

.body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
.row { display: flex; align-items: center; gap: 8px; }
.k { color: #64748b; font-size: 12px; flex: none; }
select { flex: 1; min-width: 0; height: 28px; padding: 0 8px; border: 1px solid #cbd5e1;
  border-radius: 7px; background: #fff; color: #0f172a; font-size: 12px; outline: none; }
select:focus { border-color: #2f5496; box-shadow: 0 0 0 3px rgba(47,84,150,.12); }

.btns { display: flex; gap: 8px; }
button.act { flex: 1; height: 30px; border-radius: 8px; border: 1px solid #cbd5e1;
  background: #f8fafc; color: #334155; font-size: 12px; cursor: pointer; font-weight: 500; }
button.act:hover:not(:disabled) { background: #eef2f7; }
button.act.primary { background: #1f3864; border-color: #1f3864; color: #fff; }
button.act.primary:hover:not(:disabled) { background: #2f5496; }
button.act:disabled { opacity: .5; cursor: not-allowed; }

.status { font-size: 11.5px; color: #64748b; min-height: 16px; }
.status[data-kind="ok"] { color: #15803d; }
.status[data-kind="warn"] { color: #b45309; }
.status[data-kind="err"] { color: #b91c1c; }

.list { overflow-y: auto; border: 1px solid #eef2f7; border-radius: 10px; background: #fcfdff; }
.list::-webkit-scrollbar { width: 8px; }
.list::-webkit-scrollbar-thumb { background: #dbe3ec; border-radius: 99px; }

.item { display: grid; grid-template-columns: 18px 92px 1fr 40px; align-items: center; gap: 8px;
  padding: 6px 9px; border-bottom: 1px solid #f1f5f9; cursor: pointer; }
.item:last-child { border-bottom: 0; }
.item:hover { background: #f1f5fb; }
.item input { width: 14px; height: 14px; accent-color: #1f3864; cursor: pointer; }
.name { color: #334155; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.val { color: #0f172a; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chip { justify-self: end; font-size: 10px; padding: 1px 5px; border-radius: 99px; font-variant-numeric: tabular-nums; }
.chip[data-lv="high"] { background: #dcfce7; color: #15803d; }
.chip[data-lv="mid"] { background: #fef3c7; color: #b45309; }
.chip[data-lv="low"] { background: #f1f5f9; color: #64748b; }
.item[data-kind="custom"] .name { color: #7c3aed; }

.empty { padding: 26px 12px; text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.7; }
.empty span { font-size: 11px; color: #b6c2d1; }

.tip { font-size: 10.5px; color: #94a3b8; text-align: center; }

.launcher {
  position: fixed; right: 20px; bottom: 20px; width: 46px; height: 46px; border-radius: 50%;
  border: 0; cursor: pointer; color: #fff; font-size: 13px; font-weight: 700;
  background: linear-gradient(135deg, #1f3864, #2f5496);
  box-shadow: 0 8px 22px rgba(31, 56, 100, .38);
  display: grid; place-items: center; letter-spacing: .5px;
}
.launcher:hover { transform: translateY(-1px); }
`;

export class Panel {
  private host: HTMLDivElement;
  private root: ShadowRoot;
  private panel: HTMLDivElement;
  private launcher: HTMLButtonElement;
  private select: HTMLSelectElement;
  private statusEl: HTMLDivElement;
  private listEl: HTMLDivElement;
  private scanBtn: HTMLButtonElement;
  private fillBtn: HTMLButtonElement;
  private aiBtn: HTMLButtonElement;

  private items: PlanItemVM[] = [];
  private opened = false;
  private busy = false;
  private lastHover = -1;
  private launcherAllowed = false;

  constructor(private opts: PanelOptions) {
    this.host = document.createElement('div');
    this.host.setAttribute('data-resume-autofill', 'host');
    this.host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483646;';

    this.root = this.host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = STYLE;

    this.panel = document.createElement('div');
    this.panel.className = 'panel';
    this.panel.hidden = true;
    this.panel.innerHTML = `
      <div class="hd">
        <span class="logo">简</span>
        <span class="title">简历秒填</span>
        <span class="env">本地</span>
        <span class="spacer"></span>
        <button class="icon-btn" data-role="min" title="收起">—</button>
        <button class="icon-btn" data-role="close" title="关闭">×</button>
      </div>
      <div class="body">
        <div class="row"><span class="k">简历</span><select data-role="profile"></select></div>
        <div class="btns">
          <button class="act" data-role="scan">扫描本页字段</button>
          <button class="act" data-role="ai" title="用 LLM 识别规则没覆盖的字段">AI 补识别</button>
        </div>
        <div class="status" data-role="status"></div>
        <div class="list" data-role="list"></div>
        <div class="btns">
          <button class="act primary" data-role="fill">填充选中</button>
          <button class="act" data-role="clear">清除高亮</button>
        </div>
        <div class="tip">不会自动提交 · 填完请自行核对</div>
      </div>`;

    this.launcher = document.createElement('button');
    this.launcher.className = 'launcher';
    this.launcher.hidden = true;
    this.launcher.textContent = '填写';
    this.launcher.title = '简历秒填';

    this.root.append(style, this.panel, this.launcher);

    this.select = this.panel.querySelector('[data-role="profile"]') as HTMLSelectElement;
    this.statusEl = this.panel.querySelector('[data-role="status"]') as HTMLDivElement;
    this.listEl = this.panel.querySelector('[data-role="list"]') as HTMLDivElement;
    this.scanBtn = this.panel.querySelector('[data-role="scan"]') as HTMLButtonElement;
    this.fillBtn = this.panel.querySelector('[data-role="fill"]') as HTMLButtonElement;
    this.aiBtn = this.panel.querySelector('[data-role="ai"]') as HTMLButtonElement;

    this.wire();
    this.renderList();
  }

  private wire(): void {
    this.panel.querySelector('[data-role="close"]')?.addEventListener('click', () => {
      this.close();
      this.opts.onClose();
    });
    this.panel.querySelector('[data-role="min"]')?.addEventListener('click', () => this.close());

    this.scanBtn.addEventListener('click', () => this.opts.onScan());
    this.aiBtn.addEventListener('click', () => this.opts.onAI());
    this.fillBtn.addEventListener('click', () => {
      const indices = this.items.filter((i) => i.checked).map((i) => i.index);
      this.opts.onFill(indices);
    });
    this.panel.querySelector('[data-role="clear"]')?.addEventListener('click', () => this.opts.onClear());
    this.launcher.addEventListener('click', () => this.open());

    this.select.addEventListener('change', () => this.opts.onProfileChange(this.select.value));

    // 勾选 / 悬停定位，用事件委托
    this.listEl.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      if (input.dataset.role !== 'check') return;
      const row = input.closest('.item') as HTMLElement | null;
      const idx = Number(row?.dataset.i);
      const item = this.items.find((i) => i.index === idx);
      if (item) item.checked = input.checked;
      this.syncFillButton();
    });

    this.listEl.addEventListener('mouseover', (e) => {
      const row = (e.target as HTMLElement).closest('.item') as HTMLElement | null;
      if (!row) return;
      const idx = Number(row.dataset.i);
      if (idx === this.lastHover) return;
      this.lastHover = idx;
      this.opts.onLocate(idx);
    });
  }

  mount(): void {
    if (!this.host.isConnected) document.documentElement.appendChild(this.host);
  }

  open(): void {
    this.mount();
    this.panel.hidden = false;
    this.launcher.hidden = true;
    this.opened = true;
  }

  close(): void {
    this.panel.hidden = true;
    this.opened = false;
    // 收起后留一个小气泡，方便再次唤出
    this.launcher.hidden = !this.launcherAllowed;
  }

  toggle(): void {
    if (this.opened) this.close();
    else this.open();
  }

  isOpen(): boolean {
    return this.opened;
  }

  showLauncher(show: boolean): void {
    this.mount();
    this.launcherAllowed = show;
    this.launcher.hidden = !show || this.opened;
  }

  setProfiles(profiles: Array<{ id: string; title: string }>, activeId: string): void {
    this.select.innerHTML = profiles
      .map((p) => `<option value="${esc(p.id)}"${p.id === activeId ? ' selected' : ''}>${esc(p.title)}</option>`)
      .join('');
  }

  setBusy(busy: boolean): void {
    this.busy = busy;
    this.scanBtn.disabled = busy;
    this.aiBtn.disabled = busy;
    this.syncFillButton();
  }

  private syncFillButton(): void {
    const count = this.items.filter((i) => i.checked).length;
    this.fillBtn.disabled = this.busy || count === 0;
    this.fillBtn.textContent = count ? `填充选中 ${count} 项` : '填充选中';
  }

  setItems(items: PlanItemVM[]): void {
    this.items = items;
    this.lastHover = -1;
    this.renderList();
  }

  setStatus(text: string, kind: 'info' | 'ok' | 'warn' | 'err' = 'info'): void {
    this.statusEl.textContent = text;
    this.statusEl.dataset.kind = kind;
  }

  private renderList(): void {
    if (!this.items.length) {
      this.listEl.innerHTML = `<div class="empty">还没有扫描结果<br><span>点「扫描本页字段」开始</span></div>`;
    } else {
      this.listEl.innerHTML = this.items
        .map((it) => {
          const level = it.score >= 0.85 ? 'high' : it.score >= 0.7 ? 'mid' : 'low';
          return `<label class="item" data-i="${it.index}" data-kind="${it.kind}" title="${esc(it.reason)}｜${esc(SECTION_LABEL[it.section])}">
            <input type="checkbox" data-role="check"${it.checked ? ' checked' : ''}>
            <span class="name" title="${esc(it.label)}">${esc(it.label)}</span>
            <span class="val" title="${esc(it.value)}">${esc(it.value)}</span>
            <span class="chip" data-lv="${level}">${Math.round(it.score * 100)}</span>
          </label>`;
        })
        .join('');
    }
    this.syncFillButton();
  }
}
