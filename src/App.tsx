import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import {
  SCOPE_TOPICS,
  type Authorization,
  type LedgerData,
  type ScopeTopic,
  type SessionRecord,
  type SessionStatus,
} from "./types";
import { isValidOn, latestAuthorization } from "./domain/authorization";
import {
  closeRecord,
  countersign,
  emergencySubmit,
  intakeSession,
  type SessionInput,
} from "./domain/sessions";
import { makeAudit, sortAuditDesc } from "./domain/audit";
import { localStore } from "./store/localStore";
import { seedLedger } from "./data/seed";

const project = {
  id: "hxwl-12",
  port: 5112,
  title: "未成年人个案授权与保密台账",
  subtitle:
    "每个未成年个案登记监护人、可谈范围与有效期限；会谈记录只有落在有效授权内才进入正式档案，超范围先存受限草稿，紧急情况由督导临时提交并保留版本链。",
  stack: "React + Vite + TypeScript + CSS",
};

const today = new Date().toISOString().slice(0, 10);

function nowIso(): string {
  return new Date().toISOString().slice(0, 19);
}

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  formal: "正式档案",
  restricted: "受限草稿",
  provisional: "临时提交·待回访",
  closed: "已关闭",
};

function StatusBadge({ status }: { status: SessionStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>;
}

function VersionChain({ record }: { record: SessionRecord }) {
  return (
    <ol className="version-chain">
      {record.versions.map((v) => (
        <li key={v.version}>
          <span className="v-tag">v{v.version}</span>
          <div>
            <strong>{v.action}</strong>
            <p>{v.note}</p>
            <time>
              {v.actor} · {v.at.replace("T", " ")}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}

interface SessionCardProps {
  record: SessionRecord;
  caseAlias: string;
  onEmergency: (id: string, supervisor: string, reason: string, followUpBy: string) => void;
  onCountersign: (id: string) => void;
  onClose: (id: string) => void;
}

function SessionCard({ record, caseAlias, onEmergency, onCountersign, onClose }: SessionCardProps) {
  const [showEmergency, setShowEmergency] = useState(false);
  const [supervisor, setSupervisor] = useState("督导·周岚");
  const [reason, setReason] = useState("");
  const [followUpBy, setFollowUpBy] = useState(addDays(today, 7));
  const [showVersions, setShowVersions] = useState(false);

  const overdue =
    record.status === "provisional" &&
    record.emergency !== undefined &&
    record.emergency.followUpBy < today;

  return (
    <article className={`record-card status-border-${record.status}`}>
      <div className="record-head">
        <div>
          <h3>
            {record.id} · {caseAlias}
            <StatusBadge status={record.status} />
            {overdue && <span className="badge badge-overdue">回访逾期</span>}
          </h3>
          <p className="record-meta">
            {record.date} · {record.topic} · 情绪：{record.mood}
          </p>
        </div>
        <button className="link-btn" onClick={() => setShowVersions((v) => !v)}>
          {showVersions ? "收起版本链" : `版本链（${record.versions.length}）`}
        </button>
      </div>

      <p className="record-summary">{record.summary}</p>
      <p className="record-meta">
        干预：{record.intervention} · 下次目标：{record.nextGoal}
      </p>

      {record.blockReasons.length > 0 && record.status !== "formal" && (
        <ul className="block-reasons">
          {record.blockReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {record.emergency && (
        <div className="emergency-box">
          <strong>紧急临时提交</strong>
          <p>
            {record.emergency.supervisor}：{record.emergency.reason}
          </p>
          <p>
            回访期限 {record.emergency.followUpBy}
            {overdue ? "（已逾期，请尽快回访）" : ""}
          </p>
        </div>
      )}

      {showVersions && <VersionChain record={record} />}

      {(record.status === "restricted" || record.status === "provisional") && (
        <div className="record-actions">
          {record.status === "restricted" && (
            <button className="primary-action" onClick={() => setShowEmergency((v) => !v)}>
              紧急临时提交
            </button>
          )}
          {record.status === "provisional" && (
            <button className="primary-action" onClick={() => onCountersign(record.id)}>
              监护人补签确认
            </button>
          )}
          <button className="danger-action" onClick={() => onClose(record.id)}>
            关闭记录
          </button>
        </div>
      )}

      {showEmergency && record.status === "restricted" && (
        <div className="emergency-form">
          <label>
            <span>督导</span>
            <input value={supervisor} onChange={(e) => setSupervisor(e.target.value)} />
          </label>
          <label>
            <span>紧急原因（必填）</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="说明为何需要临时提交"
            />
          </label>
          <label>
            <span>回访期限</span>
            <input
              type="date"
              value={followUpBy}
              onChange={(e) => setFollowUpBy(e.target.value)}
            />
          </label>
          <button
            className="primary-action"
            disabled={!reason.trim() || !followUpBy}
            onClick={() => {
              onEmergency(record.id, supervisor.trim() || "督导", reason.trim(), followUpBy);
              setShowEmergency(false);
              setReason("");
            }}
          >
            确认临时提交
          </button>
        </div>
      )}
    </article>
  );
}

function App() {
  const [ledger, setLedger] = useState<LedgerData>(() => localStore.load() ?? seedLedger());
  const [banner, setBanner] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [showAuthForm, setShowAuthForm] = useState(false);

  useEffect(() => {
    localStore.save(ledger);
  }, [ledger]);

  const caseAlias = useMemo(() => {
    const map = new Map(ledger.cases.map((c) => [c.id, c.alias]));
    return (id: string) => map.get(id) ?? id;
  }, [ledger.cases]);

  const counselorOf = useMemo(() => {
    const map = new Map(ledger.cases.map((c) => [c.id, c.counselor]));
    return (id: string) => map.get(id) ?? "咨询师";
  }, [ledger.cases]);

  // 新增会谈表单
  const [form, setForm] = useState<SessionInput>({
    caseId: ledger.cases[0]?.id ?? "",
    date: today,
    topic: SCOPE_TOPICS[0],
    summary: "",
    mood: "",
    intervention: "",
    nextGoal: "",
  });

  // 登记/续签授权表单
  const [authForm, setAuthForm] = useState({
    caseId: ledger.cases[0]?.id ?? "",
    guardianName: "",
    relation: "母亲",
    phone: "",
    scope: [] as ScopeTopic[],
    validFrom: today,
    validTo: addDays(today, 182),
  });

  const metrics = [
    { label: "在册未成年个案", value: String(ledger.cases.length) },
    {
      label: "有效授权",
      value: String(ledger.authorizations.filter((a) => isValidOn(a, today)).length),
    },
    {
      label: "受限草稿",
      value: String(ledger.sessions.filter((s) => s.status === "restricted").length),
    },
    {
      label: "临时提交待回访",
      value: String(ledger.sessions.filter((s) => s.status === "provisional").length),
    },
  ];

  const attention = ledger.sessions
    .filter((s) => s.status === "restricted" || s.status === "provisional")
    .sort((a, b) => b.date.localeCompare(a.date));
  const archive = ledger.sessions
    .filter((s) => s.status === "formal" || s.status === "closed")
    .sort((a, b) => b.date.localeCompare(a.date));

  function pushAudit(actor: string, caseId: string, action: string, detail: string) {
    return makeAudit(uid("L"), nowIso(), actor, caseId, action, detail);
  }

  function submitSession() {
    if (!form.summary.trim()) {
      setBanner({ kind: "warn", text: "请填写会谈摘要后再提交。" });
      return;
    }
    const { record, check } = intakeSession(
      form,
      ledger.authorizations,
      nowIso(),
      uid("S"),
      counselorOf(form.caseId)
    );
    const audit = pushAudit(
      counselorOf(form.caseId),
      form.caseId,
      check.ok ? "会谈入档" : "存为受限草稿",
      check.ok
        ? `${record.id} 落在有效授权范围内，进入正式档案`
        : `${record.id} ${check.reasons.join("；")}`
    );
    setLedger((l) => ({ ...l, sessions: [...l.sessions, record], audit: [...l.audit, audit] }));
    setBanner(
      check.ok
        ? { kind: "ok", text: `${record.id} 授权校验通过，已进入正式档案。` }
        : { kind: "warn", text: `${record.id} 已存为受限草稿：${check.reasons.join("；")}` }
    );
    setForm((f) => ({ ...f, summary: "", mood: "", intervention: "", nextGoal: "" }));
  }

  function submitAuthorization() {
    if (!authForm.guardianName.trim() || authForm.scope.length === 0) {
      setBanner({ kind: "warn", text: "请填写监护人姓名并勾选可谈范围。" });
      return;
    }
    const prev = latestAuthorization(ledger.authorizations, authForm.caseId);
    const auth: Authorization = {
      id: uid("A"),
      caseId: authForm.caseId,
      guardian: {
        name: authForm.guardianName.trim(),
        relation: authForm.relation,
        phone: authForm.phone.trim() || "未留",
      },
      scope: authForm.scope,
      validFrom: authForm.validFrom,
      validTo: authForm.validTo,
      signedAt: today,
    };
    const action = prev ? "授权续签" : "授权登记";
    const audit = pushAudit(
      "机构管理员",
      auth.caseId,
      action,
      `${auth.guardian.name}（${auth.guardian.relation}）签署，范围：${auth.scope.join("、")}，` +
        `有效期 ${auth.validFrom} 至 ${auth.validTo}`
    );
    setLedger((l) => ({
      ...l,
      authorizations: [...l.authorizations, auth],
      audit: [...l.audit, audit],
    }));
    setBanner({
      kind: "ok",
      text: `${caseAlias(auth.caseId)} 的授权已${prev ? "续签" : "登记"}，有效期至 ${auth.validTo}。`,
    });
    setAuthForm((f) => ({ ...f, guardianName: "", phone: "", scope: [] }));
  }

  function handleEmergency(id: string, supervisor: string, reason: string, followUpBy: string) {
    setLedger((l) => {
      const sessions = l.sessions.map((s) =>
        s.id === id ? emergencySubmit(s, supervisor, reason, followUpBy, nowIso()) : s
      );
      const target = sessions.find((s) => s.id === id)!;
      return {
        ...l,
        sessions,
        audit: [
          ...l.audit,
          pushAudit(supervisor, target.caseId, "紧急临时提交", `${id} ${reason}，回访期限 ${followUpBy}`),
        ],
      };
    });
    setBanner({ kind: "ok", text: `${id} 已临时提交，请在 ${followUpBy} 前完成回访。` });
  }

  function handleCountersign(id: string) {
    setLedger((l) => {
      const target = l.sessions.find((s) => s.id === id)!;
      const guardian = latestAuthorization(l.authorizations, target.caseId)?.guardian;
      const guardianName = guardian ? `${guardian.name}（${guardian.relation}）` : "监护人";
      const sessions = l.sessions.map((s) =>
        s.id === id ? countersign(s, guardianName, nowIso()) : s
      );
      return {
        ...l,
        sessions,
        audit: [
          ...l.audit,
          pushAudit(guardianName, target.caseId, "补签确认", `${id} 监护人补签，转入正式档案`),
        ],
      };
    });
    setBanner({ kind: "ok", text: `${id} 补签完成，已转入正式档案，版本链保留。` });
  }

  function handleClose(id: string) {
    setLedger((l) => {
      const target = l.sessions.find((s) => s.id === id)!;
      const sessions = l.sessions.map((s) =>
        s.id === id ? closeRecord(s, "督导·周岚", "经督导评估后封存，保留版本链", nowIso()) : s
      );
      return {
        ...l,
        sessions,
        audit: [...l.audit, pushAudit("督导·周岚", target.caseId, "记录关闭", `${id} 封存`)],
      };
    });
    setBanner({ kind: "warn", text: `${id} 已关闭封存，版本链保留可查。` });
  }

  function resetDemo() {
    localStore.clear();
    setLedger(seedLedger());
    setBanner({ kind: "ok", text: "已重置为演示数据。" });
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{project.id} · port {project.port}</p>
          <h1>{project.title}</h1>
          <p className="subtitle">{project.subtitle}</p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>{project.stack}</strong>
          <span>数据保存在浏览器本地（localStorage），授权 / 会谈 / 变更记录 / 本地保存分模块实现</span>
        </div>
      </section>

      <section className="metrics-grid">
        {metrics.map((m, i) => (
          <article className="metric-card" key={m.label}>
            <span>{m.label}</span>
            <strong>{m.value}</strong>
            <i className={["status-ok", "status-ok", "status-watch", "status-danger"][i]} />
          </article>
        ))}
      </section>

      {banner && (
        <div className={`banner banner-${banner.kind}`} onClick={() => setBanner(null)}>
          {banner.text}
        </div>
      )}

      <section className="workspace">
        <aside className="panel narrow">
          <div className="section-heading">
            <h2>个案与授权</h2>
            <button className="link-btn" onClick={() => setShowAuthForm((v) => !v)}>
              {showAuthForm ? "收起" : "登记/续签授权"}
            </button>
          </div>

          {ledger.cases.map((c) => {
            const auth = latestAuthorization(ledger.authorizations, c.id);
            const valid = auth ? isValidOn(auth, today) : false;
            return (
              <div className="case-card" key={c.id}>
                <div className="case-head">
                  <strong>
                    {c.id} · {c.alias}（{c.age} 岁）
                  </strong>
                  <span className={`badge ${valid ? "badge-formal" : "badge-restricted"}`}>
                    {valid ? "授权有效" : "授权失效"}
                  </span>
                </div>
                <p className="record-meta">
                  {c.counselor} · 风险等级：{c.riskLevel}
                </p>
                {auth ? (
                  <>
                    <p className="record-meta">
                      监护人：{auth.guardian.name}（{auth.guardian.relation}）{auth.guardian.phone}
                    </p>
                    <p className="record-meta">
                      有效期：{auth.validFrom} 至 {auth.validTo}
                    </p>
                    <div className="chips">
                      {auth.scope.map((s) => (
                        <span key={s}>{s}</span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="record-meta">尚未登记监护人授权</p>
                )}
              </div>
            );
          })}

          {showAuthForm && (
            <div className="auth-form">
              <h3>登记 / 续签授权</h3>
              <label>
                <span>个案</span>
                <select
                  value={authForm.caseId}
                  onChange={(e) => setAuthForm((f) => ({ ...f, caseId: e.target.value }))}
                >
                  {ledger.cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} · {c.alias}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>监护人姓名</span>
                <input
                  value={authForm.guardianName}
                  onChange={(e) => setAuthForm((f) => ({ ...f, guardianName: e.target.value }))}
                  placeholder="签署人姓名"
                />
              </label>
              <label>
                <span>关系</span>
                <select
                  value={authForm.relation}
                  onChange={(e) => setAuthForm((f) => ({ ...f, relation: e.target.value }))}
                >
                  {["父亲", "母亲", "祖父母", "其他法定监护人"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>联系电话</span>
                <input
                  value={authForm.phone}
                  onChange={(e) => setAuthForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="用于补签与回访"
                />
              </label>
              <div className="scope-picker">
                <span>可谈范围</span>
                <div className="chips">
                  {SCOPE_TOPICS.map((t) => (
                    <button
                      key={t}
                      className={authForm.scope.includes(t) ? "chip-on" : ""}
                      onClick={() =>
                        setAuthForm((f) => ({
                          ...f,
                          scope: f.scope.includes(t)
                            ? f.scope.filter((s) => s !== t)
                            : [...f.scope, t],
                        }))
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="date-row">
                <label>
                  <span>生效日期</span>
                  <input
                    type="date"
                    value={authForm.validFrom}
                    onChange={(e) => setAuthForm((f) => ({ ...f, validFrom: e.target.value }))}
                  />
                </label>
                <label>
                  <span>失效日期</span>
                  <input
                    type="date"
                    value={authForm.validTo}
                    onChange={(e) => setAuthForm((f) => ({ ...f, validTo: e.target.value }))}
                  />
                </label>
              </div>
              <button className="primary-action" onClick={submitAuthorization}>
                保存授权
              </button>
            </div>
          )}
        </aside>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p>心理咨询</p>
              <h2>新增会谈记录</h2>
            </div>
            <button className="primary-action" onClick={submitSession}>
              提交并校验授权
            </button>
          </div>
          <div className="field-grid">
            <label>
              <span>个案</span>
              <select
                value={form.caseId}
                onChange={(e) => setForm((f) => ({ ...f, caseId: e.target.value }))}
              >
                {ledger.cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} · {c.alias}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>会谈日期</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </label>
            <label>
              <span>会谈主题</span>
              <select
                value={form.topic}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value as ScopeTopic }))}
              >
                {SCOPE_TOPICS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              <span>情绪状态</span>
              <input
                value={form.mood}
                onChange={(e) => setForm((f) => ({ ...f, mood: e.target.value }))}
                placeholder="如：平稳 / 低落 / 激动"
              />
            </label>
            <label className="span-2">
              <span>会谈摘要</span>
              <input
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder="主要困扰与会谈内容摘要"
              />
            </label>
            <label>
              <span>干预方法</span>
              <input
                value={form.intervention}
                onChange={(e) => setForm((f) => ({ ...f, intervention: e.target.value }))}
                placeholder="如：放松训练、认知重构"
              />
            </label>
            <label>
              <span>下次目标</span>
              <input
                value={form.nextGoal}
                onChange={(e) => setForm((f) => ({ ...f, nextGoal: e.target.value }))}
                placeholder="下次会谈前要完成的目标"
              />
            </label>
          </div>
          <p className="hint">
            提交时自动校验：会谈日期须落在授权有效期内，且主题在可谈范围内；不满足则存为受限草稿，不进入正式档案。
          </p>
        </section>
      </section>

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>需要处理</p>
            <h2>受限草稿与临时提交（{attention.length}）</h2>
          </div>
        </div>
        <div className="record-list">
          {attention.length === 0 && <p className="hint">当前没有待处理的受限记录。</p>}
          {attention.map((r) => (
            <SessionCard
              key={r.id}
              record={r}
              caseAlias={caseAlias(r.caseId)}
              onEmergency={handleEmergency}
              onCountersign={handleCountersign}
              onClose={handleClose}
            />
          ))}
        </div>
      </section>

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>正式档案</p>
            <h2>会谈档案（{archive.length}）</h2>
          </div>
        </div>
        <div className="record-list">
          {archive.map((r) => (
            <SessionCard
              key={r.id}
              record={r}
              caseAlias={caseAlias(r.caseId)}
              onEmergency={handleEmergency}
              onCountersign={handleCountersign}
              onClose={handleClose}
            />
          ))}
        </div>
      </section>

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>保密台账</p>
            <h2>变更记录（{ledger.audit.length}）</h2>
          </div>
          <button onClick={resetDemo}>重置演示数据</button>
        </div>
        <ol className="audit-list">
          {sortAuditDesc(ledger.audit).map((a) => (
            <li key={a.id}>
              <div>
                <strong>{a.action}</strong>
                <span className="audit-case">{caseAlias(a.caseId)}</span>
                <p>{a.detail}</p>
                <time>
                  {a.actor} · {a.at.replace("T", " ")}
                </time>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

export default App;
