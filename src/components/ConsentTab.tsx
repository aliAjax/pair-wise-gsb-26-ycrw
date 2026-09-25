import { useMemo, useState } from "react";
import { useLedger } from "../LedgerContext";
import type { ConsentScope, MinorCase } from "../types";
import { getCaseConsentView } from "../modules/consent";
import { Badge, Field, formatTime } from "./ui";

const STATE_LABEL = {
  valid: "授权有效",
  expiring: "即将到期",
  expired: "授权已过期",
  pending: "未生效",
} as const;

const ALL_TOPICS = ["学业压力", "同伴关系", "情绪调节", "亲子沟通", "自伤风险", "家庭冲突"];

function TopicPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (t: string) => void;
}) {
  return (
    <div className="topic-picker">
      {ALL_TOPICS.map((t) => (
        <button
          type="button"
          key={t}
          className={selected.includes(t) ? "topic-btn on" : "topic-btn"}
          onClick={() => onToggle(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function ConsentVersions({ caseId }: { caseId: string }) {
  const { consents } = useLedger();
  const list = consents
    .filter((c) => c.caseId === caseId)
    .sort((a, b) => b.version - a.version);
  return (
    <div className="version-chain">
      <h4>授权版本链</h4>
      {list.map((c) => (
        <div key={c.id} className="chain-item">
          <div className="chain-head">
            <strong>v{c.version}</strong>
            {c.status === "active" ? (
              <Badge kind="valid">当前版本</Badge>
            ) : (
              <Badge kind="pending">已被替代 · 保留</Badge>
            )}
            <span className="chain-time">签署 {formatTime(c.signedAt)}</span>
          </div>
          <p className="chain-line">
            监护人：{c.guardianName}（{c.relation}） {c.phone}
          </p>
          <p className="chain-line">
            有效期：{c.validFrom} ~ {c.validUntil}
          </p>
          <p className="chain-line">可谈范围：{c.scopes.map((s) => s.topic).join("、")}</p>
        </div>
      ))}
    </div>
  );
}

interface RenewFormState {
  guardianName: string;
  relation: string;
  phone: string;
  topics: string[];
  boundaries: Record<string, string>;
  validFrom: string;
  validUntil: string;
}

function RenewForm({
  minorCase,
  onDone,
  onCancel,
}: {
  minorCase: MinorCase;
  onDone: (promoted: number) => void;
  onCancel: () => void;
}) {
  const { consents, today, renewConsent } = useLedger();
  const current = getCaseConsentView(consents, minorCase, today).consent;
  const [form, setForm] = useState<RenewFormState>({
    guardianName: current?.guardianName ?? "",
    relation: current?.relation ?? "",
    phone: current?.phone ?? "",
    topics: current?.scopes.map((s) => s.topic) ?? [],
    boundaries: Object.fromEntries(current?.scopes.map((s) => [s.topic, s.boundary]) ?? []),
    validFrom: today,
    validUntil: "",
  });
  const [error, setError] = useState("");

  const toggle = (t: string) =>
    setForm((f) => ({
      ...f,
      topics: f.topics.includes(t) ? f.topics.filter((x) => x !== t) : [...f.topics, t],
    }));

  const submit = () => {
    if (!form.guardianName.trim() || !form.validUntil) {
      setError("请填写监护人与新有效期限");
      return;
    }
    if (form.topics.length === 0) {
      setError("至少选择一个可谈主题");
      return;
    }
    if (form.validUntil < form.validFrom) {
      setError("有效期限止日不能早于起日");
      return;
    }
    const { promoted } = renewConsent({
      caseId: minorCase.id,
      guardianName: form.guardianName,
      relation: form.relation,
      phone: form.phone,
      topics: form.topics,
      boundaries: form.boundaries,
      validFrom: form.validFrom,
      validUntil: form.validUntil,
    });
    onDone(promoted.length);
  };

  return (
    <div className="sub-form">
      <h4>监护人补签 / 变更授权（新增版本，旧版本保留）</h4>
      <div className="field-grid">
        <Field label="监护人姓名">
          <input
            value={form.guardianName}
            onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
          />
        </Field>
        <Field label="与来访者关系">
          <input
            value={form.relation}
            onChange={(e) => setForm({ ...form, relation: e.target.value })}
          />
        </Field>
        <Field label="联系方式">
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field label="授权起始日">
          <input
            type="date"
            value={form.validFrom}
            onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
          />
        </Field>
        <Field label="授权截止日" hint="过期后会谈只能进受限草稿">
          <input
            type="date"
            value={form.validUntil}
            onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
          />
        </Field>
      </div>
      <Field label="可谈范围" hint="范围外的会谈主题将进入受限草稿">
        <TopicPicker selected={form.topics} onToggle={toggle} />
      </Field>
      <div className="scope-boundaries">
        {form.topics.map((t) => (
          <label key={t} className="boundary-row">
            <span>{t} · 边界说明</span>
            <input
              value={form.boundaries[t] ?? ""}
              placeholder={`写明「${t}」可谈到哪里、不谈什么`}
              onChange={(e) =>
                setForm({ ...form, boundaries: { ...form.boundaries, [t]: e.target.value } })
              }
            />
          </label>
        ))}
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="form-actions">
        <button className="primary-action" onClick={submit}>
          提交补签
        </button>
        <button onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

function NewCaseForm({ onDone }: { onDone: () => void }) {
  const { today, createCase } = useLedger();
  const [code, setCode] = useState("");
  const [age, setAge] = useState("14");
  const [riskLevel, setRiskLevel] = useState("关注");
  const [guardianName, setGuardian] = useState("");
  const [relation, setRelation] = useState("");
  const [phone, setPhone] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [boundaries, setBoundaries] = useState<Record<string, string>>({});
  const [validFrom, setFrom] = useState(today);
  const [validUntil, setUntil] = useState("");
  const [error, setError] = useState("");

  const toggle = (t: string) =>
    setTopics((list) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t]));

  const submit = () => {
    if (!code.trim() || !guardianName.trim() || !validUntil) {
      setError("请填写个案代号、监护人与授权期限");
      return;
    }
    if (topics.length === 0) {
      setError("至少选择一个可谈主题");
      return;
    }
    createCase({
      code: code.trim(),
      age: Number(age) || 0,
      riskLevel,
      guardianName: guardianName.trim(),
      relation: relation.trim() || "监护人",
      phone: phone.trim(),
      topics,
      boundaries,
      validFrom,
      validUntil,
    });
    onDone();
  };

  return (
    <div className="sub-form">
      <h4>新建未成年个案并登记首份监护人授权</h4>
      <div className="field-grid">
        <Field label="来访者代号">
          <input value={code} placeholder="如 M-301" onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label="年龄">
          <input type="number" value={age} onChange={(e) => setAge(e.target.value)} />
        </Field>
        <Field label="风险等级">
          <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
            <option>稳定</option>
            <option>关注</option>
            <option>中风险</option>
            <option>高风险关注</option>
          </select>
        </Field>
        <Field label="监护人姓名">
          <input value={guardianName} onChange={(e) => setGuardian(e.target.value)} />
        </Field>
        <Field label="与来访者关系">
          <input value={relation} placeholder="父亲 / 母亲 / 法定监护人" onChange={(e) => setRelation(e.target.value)} />
        </Field>
        <Field label="联系方式">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="授权起始日">
          <input type="date" value={validFrom} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="授权截止日">
          <input type="date" value={validUntil} onChange={(e) => setUntil(e.target.value)} />
        </Field>
      </div>
      <Field label="可谈范围">
        <TopicPicker selected={topics} onToggle={toggle} />
      </Field>
      <div className="scope-boundaries">
        {topics.map((t) => (
          <label key={t} className="boundary-row">
            <span>{t} · 边界说明</span>
            <input
              value={boundaries[t] ?? ""}
              onChange={(e) => setBoundaries({ ...boundaries, [t]: e.target.value })}
            />
          </label>
        ))}
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="form-actions">
        <button className="primary-action" onClick={submit}>
          建档并登记授权
        </button>
        <button onClick={onDone}>取消</button>
      </div>
    </div>
  );
}

export default function ConsentTab() {
  const { cases, consents, today, role, closeCase } = useLedger();
  const [selectedId, setSelectedId] = useState(cases[0]?.id ?? "");
  const [mode, setMode] = useState<"view" | "new" | "renew">("view");
  const [notice, setNotice] = useState("");

  const selected = cases.find((c) => c.id === selectedId) ?? cases[0];
  const views = useMemo(
    () => new Map(cases.map((c) => [c.id, getCaseConsentView(consents, c, today)])),
    [cases, consents, today]
  );

  if (!selected) {
    return (
      <section className="panel">
        <p>尚无个案。</p>
        <button className="primary-action" onClick={() => setMode("new")}>
          新建未成年个案
        </button>
        {mode === "new" ? <NewCaseForm onDone={() => setMode("view")} /> : null}
      </section>
    );
  }

  const view = views.get(selected.id)!;

  return (
    <div className="two-col">
      <aside className="panel case-list">
        <div className="section-heading compact">
          <h2>未成年个案</h2>
          {role === "counselor" ? (
            <button className="primary-action" onClick={() => setMode("new")}>
              新建个案
            </button>
          ) : null}
        </div>
        {cases.map((c) => {
          const v = views.get(c.id)!;
          return (
            <button
              key={c.id}
              className={c.id === selected.id ? "case-row on" : "case-row"}
              onClick={() => {
                setSelectedId(c.id);
                setMode("view");
                setNotice("");
              }}
            >
              <span className="case-code">{c.code}</span>
              <span className="case-meta">
                {c.age} 岁 · {c.riskLevel}
                {c.closed ? " · 已关闭" : ""}
              </span>
              <Badge kind={c.closed ? "closed-archive" : v.state}>
                {c.closed ? "已关闭" : STATE_LABEL[v.state]}
              </Badge>
            </button>
          );
        })}
      </aside>

      <section className="panel">
        {mode === "new" ? (
          <NewCaseForm onDone={() => setMode("view")} />
        ) : (
          <>
            <div className="section-heading">
              <div>
                <p>授权与保密台账</p>
                <h2>
                  {selected.code}{" "}
                  <Badge kind={selected.closed ? "closed-archive" : view.state}>
                    {selected.closed ? "个案已关闭" : STATE_LABEL[view.state]}
                  </Badge>
                </h2>
              </div>
              {!selected.closed && role === "counselor" && mode === "view" ? (
                <div className="btn-row">
                  <button onClick={() => setMode("renew")}>补签 / 变更授权</button>
                  <button
                    className="danger-action"
                    onClick={() => {
                      if (confirm(`确认关闭个案 ${selected.code}？记录将封存，版本链保留。`))
                        closeCase(selected.id);
                    }}
                  >
                    关闭个案
                  </button>
                </div>
              ) : null}
            </div>

            {notice ? <p className="form-ok">{notice}</p> : null}

            {mode === "renew" ? (
              <RenewForm
                minorCase={selected}
                onDone={(promoted) => {
                  setMode("view");
                  setNotice(
                    `已登记新授权版本，旧版本保留备查${
                      promoted > 0 ? `；${promoted} 条受限草稿经复核转入正式档案` : ""
                    }`
                  );
                }}
                onCancel={() => setMode("view")}
              />
            ) : (
              <>
                <div className="consent-card">
                  {view.consent ? (
                    <>
                      <div className="consent-grid">
                        <div>
                          <span>监护人</span>
                          <strong>
                            {view.consent.guardianName}（{view.consent.relation}）
                          </strong>
                        </div>
                        <div>
                          <span>联系方式</span>
                          <strong>{view.consent.phone || "—"}</strong>
                        </div>
                        <div>
                          <span>有效期</span>
                          <strong>
                            {view.consent.validFrom} ~ {view.consent.validUntil}
                          </strong>
                        </div>
                        <div>
                          <span>到期倒计时</span>
                          <strong>
                            {selected.closed
                              ? "已关闭"
                              : view.daysLeft === null
                              ? "—"
                              : view.daysLeft < 0
                              ? `已过期 ${-view.daysLeft} 天`
                              : `剩余 ${view.daysLeft} 天`}
                          </strong>
                        </div>
                      </div>
                      <h4>可谈范围与边界</h4>
                      <ul className="scope-list">
                        {view.consent.scopes.map((s: ConsentScope) => (
                          <li key={s.topic}>
                            <strong>{s.topic}</strong>
                            <span>{s.boundary || "未填写边界说明"}</span>
                          </li>
                        ))}
                      </ul>
                      {view.state === "expired" && !selected.closed ? (
                        <p className="alert-text">
                          授权已过期：此期间的会谈记录只能保存为受限草稿，不能进入正式档案，需监护人补签后复核。
                        </p>
                      ) : null}
                      {view.state === "expiring" ? (
                        <p className="warn-text">
                          授权将在 {view.daysLeft} 天后到期，请提前安排监护人续签。
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="alert-text">未登记监护人授权，任何会谈记录都只能进入受限草稿。</p>
                  )}
                </div>
                <ConsentVersions caseId={selected.id} />
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
