import { useMemo, useState } from "react";
import "./styles.css";
import { LedgerProvider, useLedger } from "./LedgerContext";
import { getCaseConsentView } from "./modules/consent";
import { statRepository } from "./storage/repository";
import { createLedgerStorage } from "./storage/ledgerStorage";
import { RoleSwitcher } from "./components/ui";
import ConsentTab from "./components/ConsentTab";
import SessionsTab from "./components/SessionsTab";
import ReviewTab from "./components/ReviewTab";
import AuditTab from "./components/AuditTab";

type TabKey = "consent" | "sessions" | "review" | "audit";

const TABS: { key: TabKey; label: string; hint: string }[] = [
  { key: "consent", label: "授权台账", hint: "监护人 · 可谈范围 · 有效期限" },
  { key: "sessions", label: "会谈记录", hint: "在范围内入档 / 超范围受限草稿" },
  { key: "review", label: "督导处置", hint: "紧急临时提交 · 回访跟踪" },
  { key: "audit", label: "变更记录", hint: "只追加的操作流水" },
];

function MetricCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub: string;
  tone: string;
}) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p className="metric-sub">{sub}</p>
      <i className={tone} />
    </article>
  );
}

function StoragePanel() {
  const { resetDemo } = useLedger();
  const storage = useMemo(() => createLedgerStorage(), []);
  // 每次渲染读一次，reset 后刷新
  const stats = [
    { name: "个案仓库", ...statRepository(storage.cases) },
    { name: "授权仓库（版本链）", ...statRepository(storage.consents) },
    { name: "会谈记录仓库", ...statRepository(storage.notes) },
    { name: "变更台账仓库", ...statRepository(storage.audit) },
  ];
  return (
    <section className="panel storage-panel">
      <div className="section-heading compact">
        <div>
          <p>本地保存</p>
          <h2>四个独立 localStorage 仓库</h2>
        </div>
        <button
          onClick={() => {
            if (confirm("清空本地数据并恢复演示数据？")) resetDemo();
          }}
        >
          重置演示数据
        </button>
      </div>
      <div className="storage-grid">
        {stats.map((s) => (
          <div key={s.storageKey} className="storage-item">
            <strong>{s.name}</strong>
            <code>{s.storageKey}</code>
            <span>
              {s.count} 条 · {s.bytes} B
            </span>
          </div>
        ))}
      </div>
      <p className="muted-text">
        授权、会谈、变更记录分别持久化；本地保存模块不包含任何业务规则，清空某个仓库不影响其余两个的结构。
      </p>
    </section>
  );
}

function Workspace() {
  const { cases, consents, notes, today, role, setRole } = useLedger();
  const [tab, setTab] = useState<TabKey>("consent");

  const metrics = useMemo(() => {
    const open = cases.filter((c) => !c.closed);
    let expired = 0;
    let highRisk = 0;
    for (const c of open) {
      const v = getCaseConsentView(consents, c, today);
      if (v.state === "expired") expired += 1;
      if (c.riskLevel.includes("高")) highRisk += 1;
    }
    const drafts = notes.filter((n) => n.status === "draft").length;
    const pendingFollowUp = notes.filter(
      (n) => n.status === "emergency" && !n.followUpDone
    ).length;
    return { open: open.length, expired, drafts, highRisk, pendingFollowUp };
  }, [cases, consents, notes, today]);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-12 · 未成年人咨询授权与保密台账</p>
          <h1>授权范围内才入档，超范围先进受限草稿</h1>
          <p className="subtitle">
            每个未成年个案保留监护人、可谈范围与有效期限；会谈记录经规则判定后分流。紧急情况由督导写明原因与回访期限临时提交，补签或关闭后版本链完整保留。
          </p>
        </div>
        <div className="stack-card">
          <span>原型基准日（演示）</span>
          <strong>{today}</strong>
          <RoleSwitcher role={role} onChange={setRole} />
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="在管未成年个案" value={metrics.open} sub="未关闭个案数" tone="status-ok" />
        <MetricCard
          label="授权过期"
          value={metrics.expired}
          sub="会谈只能存受限草稿"
          tone="status-danger"
        />
        <MetricCard
          label="受限草稿"
          value={metrics.drafts}
          sub="待补签复核或督导处置"
          tone="status-watch"
        />
        <MetricCard
          label="紧急待回访"
          value={metrics.pendingFollowUp}
          sub={`高风险个案 ${metrics.highRisk} 个`}
          tone="status-watch"
        />
      </section>

      <nav className="tab-bar" aria-label="功能模块">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "tab-btn active" : "tab-btn"}
            onClick={() => setTab(t.key)}
          >
            <strong>{t.label}</strong>
            <span>{t.hint}</span>
          </button>
        ))}
      </nav>

      {tab === "consent" ? <ConsentTab /> : null}
      {tab === "sessions" ? <SessionsTab /> : null}
      {tab === "review" ? <ReviewTab /> : null}
      {tab === "audit" ? <AuditTab /> : null}

      <StoragePanel />
    </main>
  );
}

function App() {
  return (
    <LedgerProvider>
      <Workspace />
    </LedgerProvider>
  );
}

export default App;
