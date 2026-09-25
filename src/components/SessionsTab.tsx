import { useState } from "react";
import { useLedger } from "../LedgerContext";
import { getCaseConsentView } from "../modules/consent";
import { NOTE_STATUS_LABEL } from "../modules/sessions";
import type { SessionNote } from "../types";
import { Badge, Field, formatTime } from "./ui";

function NoteCard({ note }: { note: SessionNote }) {
  const { cases, today } = useLedger();
  const code = cases.find((c) => c.id === note.caseId)?.code ?? note.caseId;
  const overdue =
    note.status === "emergency" && !note.followUpDone && !!note.followUpDue && note.followUpDue < today;

  return (
    <article className={`note-card status-${note.status}`}>
      <div className="note-head">
        <div>
          <h3>
            {code} · {note.sessionDate} 会谈
          </h3>
          <div className="note-topics">
            {note.topics.map((t) => (
              <span key={t} className="mini-chip">
                {t}
              </span>
            ))}
          </div>
        </div>
        <Badge kind={note.status}>{NOTE_STATUS_LABEL[note.status]}</Badge>
      </div>

      <dl className="note-body">
        <div>
          <dt>主要内容</dt>
          <dd>{note.summary}</dd>
        </div>
        <div>
          <dt>情绪状态 / 干预</dt>
          <dd>
            {note.mood} · {note.intervention}
          </dd>
        </div>
        <div>
          <dt>下次目标</dt>
          <dd>{note.nextGoal}</dd>
        </div>
      </dl>

      {note.status === "emergency" ? (
        <div className="emergency-box">
          <p>
            <strong>督导原因：</strong>
            {note.emergencyReason}
          </p>
          <p>
            <strong>回访期限：</strong>
            {note.followUpDue}
            {note.followUpDone ? (
              <Badge kind="filed">已回访</Badge>
            ) : overdue ? (
              <Badge kind="expired">回访超期</Badge>
            ) : (
              <Badge kind="expiring">待回访</Badge>
            )}
          </p>
        </div>
      ) : null}

      <div className="version-chain compact">
        <h4>记录版本链（{note.versions.length}）</h4>
        {[...note.versions].reverse().map((v) => (
          <div key={v.version} className="chain-item small">
            <span className="chain-time">
              v{v.version} · {NOTE_STATUS_LABEL[v.status]} · {formatTime(v.at)} · {v.actor}
            </span>
            {v.reason ? <p className="chain-reason">{v.reason}</p> : null}
          </div>
        ))}
      </div>
    </article>
  );
}

export default function SessionsTab() {
  const { cases, consents, notes, today, role, saveNote, markFollowUpDone } = useLedger();
  const [caseId, setCaseId] = useState(cases.find((c) => !c.closed)?.id ?? cases[0]?.id ?? "");
  const [sessionDate, setDate] = useState(today);
  const [topics, setTopics] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [mood, setMood] = useState("");
  const [intervention, setIntervention] = useState("");
  const [nextGoal, setNextGoal] = useState("");
  const [result, setResult] = useState<{ filed: boolean; msg: string } | null>(null);
  const [filter, setFilter] = useState<"all" | "filed" | "draft" | "emergency">("all");

  const minorCase = cases.find((c) => c.id === caseId);
  const view = minorCase ? getCaseConsentView(consents, minorCase, today) : undefined;

  const toggleTopic = (t: string) =>
    setTopics((list) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t]));

  const submit = () => {
    if (!minorCase) return;
    if (topics.length === 0 || !summary.trim()) {
      setResult({ filed: false, msg: "请至少选择会谈主题并填写主要内容" });
      return;
    }
    const { filed } = saveNote({
      caseId,
      sessionDate,
      topics,
      summary: summary.trim(),
      mood: mood.trim(),
      intervention: intervention.trim(),
      nextGoal: nextGoal.trim(),
    });
    setResult({
      filed,
      msg: filed
        ? "会谈日期与主题均在有效授权范围内，记录已进入正式档案。"
        : "授权失效或主题超出可谈范围，记录已保存为「受限草稿」，不会进入正式档案；可在督导页临时提交，或等监护人补签后复核转正。",
    });
    setTopics([]);
    setSummary("");
    setMood("");
    setIntervention("");
    setNextGoal("");
  };

  const visible = notes.filter((n) => (filter === "all" ? true : n.status === filter || (filter === "filed" && n.status === "closed-archive")));

  return (
    <div className="tab-stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p>会谈记录</p>
            <h2>登记会谈</h2>
          </div>
        </div>
        {role !== "counselor" ? (
          <p className="warn-text">当前身份为{role === "supervisor" ? "督导" : "管理员"}，会谈记录由咨询师登记；以下记录仍可查看。</p>
        ) : null}
        <div className="field-grid">
          <Field label="个案">
            <select value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}（{c.age} 岁）{c.closed ? " · 已关闭" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="会谈日期">
            <input type="date" value={sessionDate} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        {view ? (
          <div className={`scope-check scope-${minorCase?.closed ? "expired" : view.state}`}>
            <div className="scope-check-head">
              <Badge kind={minorCase?.closed ? "closed-archive" : view.state}>
                {minorCase?.closed ? "个案已关闭" : ""}
                {!minorCase?.closed
                  ? view.state === "valid"
                    ? "授权有效"
                    : view.state === "expiring"
                    ? `授权临期（剩 ${view.daysLeft} 天）`
                    : view.state === "pending"
                    ? "授权未生效"
                    : "授权已过期"
                  : ""}
              </Badge>
              <span>
                当前可谈范围：
                {view.topics.length ? view.topics.join("、") : "（无）"} · 有效期至{" "}
                {view.consent?.validUntil ?? "—"}
              </span>
            </div>
          </div>
        ) : null}

        <Field label="本次会谈主题" hint="选择授权范围外的主题会自动进入受限草稿">
          <div className="topic-picker">
            {(view?.topics.length ? Array.from(new Set([...view.topics, "家庭冲突", "学业压力", "同伴关系"])) : ["学业压力", "同伴关系", "情绪调节", "亲子沟通", "自伤风险", "家庭冲突"]).map(
              (t) => (
                <button
                  type="button"
                  key={t}
                  className={
                    topics.includes(t)
                      ? view?.topics.includes(t)
                        ? "topic-btn on"
                        : "topic-btn on out"
                      : view && view.topics.length > 0 && !view.topics.includes(t)
                      ? "topic-btn out-scope"
                      : "topic-btn"
                  }
                  onClick={() => toggleTopic(t)}
                >
                  {t}
                  {view && view.topics.length > 0
                    ? view.topics.includes(t)
                      ? " ✓授权"
                      : " ✕范围外"
                    : ""}
                </button>
              )
            )}
          </div>
        </Field>

        <div className="field-grid">
          <Field label="主要内容">
            <textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </Field>
          <Field label="情绪状态">
            <input value={mood} onChange={(e) => setMood(e.target.value)} />
          </Field>
          <Field label="干预方法">
            <input value={intervention} onChange={(e) => setIntervention(e.target.value)} />
          </Field>
          <Field label="下次目标">
            <input value={nextGoal} onChange={(e) => setNextGoal(e.target.value)} />
          </Field>
        </div>

        {role === "counselor" ? (
          <div className="form-actions">
            <button className="primary-action" onClick={submit}>
              保存会谈记录
            </button>
          </div>
        ) : null}
        {result ? (
          <p className={result.filed ? "form-ok" : "form-error"}>{result.msg}</p>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>归档分流</p>
            <h2>会谈记录列表</h2>
          </div>
          <div className="btn-row">
            {(
              [
                ["all", "全部"],
                ["filed", "正式档案"],
                ["draft", "受限草稿"],
                ["emergency", "紧急提交"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                className={filter === k ? "filter-btn on" : "filter-btn"}
                onClick={() => setFilter(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="note-list">
          {visible.length === 0 ? (
            <p className="muted-text">该分类下暂无记录。</p>
          ) : (
            visible.map((n) => (
              <div key={n.id}>
                <NoteCard note={n} />
                {n.status === "emergency" && !n.followUpDone ? (
                  <div className="followup-row">
                    <button onClick={() => markFollowUpDone(n.id)}>登记已完成回访</button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
