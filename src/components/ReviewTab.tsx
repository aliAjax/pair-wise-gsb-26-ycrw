import { useState } from "react";
import { useLedger } from "../LedgerContext";
import { getCaseConsentView, isWithinValidity } from "../modules/consent";
import { canPromote, emergencyReady, NOTE_STATUS_LABEL } from "../modules/sessions";
import type { SessionNote } from "../types";
import { Badge, Field, formatTime } from "./ui";

function restrictReason(note: SessionNote, consentView: ReturnType<typeof getCaseConsentView>, caseClosed: boolean): string {
  if (caseClosed) return "个案已关闭";
  if (!consentView.consent) return "未登记监护人授权";
  if (!isWithinValidity(consentView.consent, note.sessionDate))
    return `会谈日 ${note.sessionDate} 不在授权有效期 ${consentView.consent.validFrom} ~ ${consentView.consent.validUntil} 内`;
  const out = note.topics.filter((t) => !consentView.topics.includes(t));
  if (out.length) return `主题「${out.join("、")}」超出可谈范围`;
  return "未知原因";
}

function DraftCard({ note }: { note: SessionNote }) {
  const { cases, consents, today, role, emergencySubmit } = useLedger();
  const minorCase = cases.find((c) => c.id === note.caseId);
  const view = minorCase ? getCaseConsentView(consents, minorCase, today) : undefined;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [followUpDue, setDue] = useState(today);
  const [error, setError] = useState("");

  const reasonText = view ? restrictReason(note, view, !!minorCase?.closed) : "";
  const promotable = minorCase && view ? canPromote(note, view.consent, minorCase.closed) : false;

  const submit = () => {
    if (!emergencyReady(reason, followUpDue, today)) {
      setError("请写清紧急原因（至少 4 字），且回访期限不得早于今天");
      return;
    }
    const res = emergencySubmit(note.id, reason.trim(), followUpDue);
    if (!res.ok) setError(res.error ?? "提交失败");
    else setOpen(false);
  };

  return (
    <article className="note-card status-draft">
      <div className="note-head">
        <div>
          <h3>
            {minorCase?.code} · {note.sessionDate} 会谈
          </h3>
          <div className="note-topics">
            {note.topics.map((t) => (
              <span key={t} className="mini-chip">
                {t}
              </span>
            ))}
          </div>
        </div>
        <Badge kind="draft">受限草稿</Badge>
      </div>
      <p className="restrict-reason">
        <strong>受限原因：</strong>
        {reasonText}
      </p>
      <p className="note-summary">{note.summary}</p>

      {promotable ? (
        <p className="form-ok">
          新授权已覆盖本会谈：前往「授权台账」补签后系统会自动复核转正，或由督导按紧急流程处理。
        </p>
      ) : null}

      {role === "supervisor" ? (
        open ? (
          <div className="sub-form">
            <h4>督导紧急临时提交</h4>
            <p className="warn-text">
              仅用于自伤/伤人等紧急情形。提交后记录以「督导临时提交」状态入档，必须在回访期限内补齐监护人授权。
            </p>
            <Field label="紧急原因" hint="将写入版本链与变更台账，不可删除">
              <textarea
                rows={3}
                value={reason}
                placeholder="写明：发生了什么紧急情况、为何无法即时取得监护人确认"
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <Field label="回访期限" hint="期限前完成回访并补签">
              <input type="date" value={followUpDue} onChange={(e) => setDue(e.target.value)} />
            </Field>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="form-actions">
              <button className="primary-action" onClick={submit}>
                确认临时提交
              </button>
              <button onClick={() => setOpen(false)}>取消</button>
            </div>
          </div>
        ) : (
          <div className="form-actions">
            <button className="warn-action" onClick={() => setOpen(true)}>
              督导临时提交
            </button>
          </div>
        )
      ) : (
        <p className="muted-text">受限草稿仅督导可临时提交；咨询师请联系监护人补签授权。</p>
      )}

      <div className="version-chain compact">
        <h4>版本链（{note.versions.length}）</h4>
        {note.versions.map((v) => (
          <div key={v.version} className="chain-item small">
            <span className="chain-time">
              v{v.version} · {NOTE_STATUS_LABEL[v.status]} · {formatTime(v.at)} · {v.actor}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function ReviewTab() {
  const { notes, cases, today, role } = useLedger();
  const drafts = notes.filter((n) => n.status === "draft");
  const emergencies = notes.filter((n) => n.status === "emergency");

  return (
    <div className="tab-stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p>督导处置台</p>
            <h2>受限草稿队列（{drafts.length}）</h2>
          </div>
          <Badge kind="draft">不进入正式档案</Badge>
        </div>
        {role !== "supervisor" ? (
          <p className="warn-text">当前不是督导身份：可查看受限草稿，但「临时提交」按钮仅督导可用。</p>
        ) : null}
        {drafts.length === 0 ? (
          <p className="muted-text">没有受限草稿。</p>
        ) : (
          <div className="note-list">
            {drafts.map((n) => (
              <DraftCard key={n.id} note={n} />
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>紧急流程跟踪</p>
            <h2>督导临时提交（{emergencies.length}）</h2>
          </div>
        </div>
        {emergencies.length === 0 ? (
          <p className="muted-text">暂无紧急提交记录。</p>
        ) : (
          <div className="note-list">
            {emergencies.map((n) => {
              const code = cases.find((c) => c.id === n.caseId)?.code ?? n.caseId;
              const overdue = !n.followUpDone && !!n.followUpDue && n.followUpDue < today;
              return (
                <article key={n.id} className="note-card status-emergency">
                  <div className="note-head">
                    <h3>
                      {code} · {n.sessionDate}
                    </h3>
                    {n.followUpDone ? (
                      <Badge kind="filed">已回访</Badge>
                    ) : overdue ? (
                      <Badge kind="expired">回访超期</Badge>
                    ) : (
                      <Badge kind="expiring">待回访（{n.followUpDue} 前）</Badge>
                    )}
                  </div>
                  <p>
                    <strong>原因：</strong>
                    {n.emergencyReason}
                  </p>
                  <p className="muted-text">
                    补签监护人授权后，本记录的版本链会继续追加；关闭个案时整条链封存保留。
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
