import { useState } from "react";
import { useLedger } from "../LedgerContext";
import { AUDIT_ACTION_LABEL } from "../modules/audit";
import { ROLE_LABEL, formatTime } from "./ui";
import type { AuditAction } from "../types";

const ACTION_KIND: Record<AuditAction, string> = {
  case_created: "valid",
  session_saved: "valid",
  note_restricted: "draft",
  consent_signed: "valid",
  note_promoted: "valid",
  emergency_filed: "emergency",
  case_closed: "closed-archive",
};

export default function AuditTab() {
  const { audit, cases } = useLedger();
  const [actionFilter, setActionFilter] = useState<AuditAction | "all">("all");

  const list = audit.filter((a) => (actionFilter === "all" ? true : a.action === actionFilter));

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>变更记录台账</p>
          <h2>授权 / 会谈 / 紧急处置流水（{audit.length}）</h2>
        </div>
      </div>
      <p className="muted-text">
        所有写操作都只追加、不修改不删除；每条记录关联操作人、角色、个案与对应授权/会谈记录。
      </p>
      <div className="btn-row audit-filters">
        <button
          className={actionFilter === "all" ? "filter-btn on" : "filter-btn"}
          onClick={() => setActionFilter("all")}
        >
          全部
        </button>
        {(Object.keys(AUDIT_ACTION_LABEL) as AuditAction[]).map((a) => (
          <button
            key={a}
            className={actionFilter === a ? "filter-btn on" : "filter-btn"}
            onClick={() => setActionFilter(a)}
          >
            {AUDIT_ACTION_LABEL[a]}
          </button>
        ))}
      </div>

      <ol className="audit-list">
        {list.map((entry) => {
          const code = cases.find((c) => c.id === entry.caseId)?.code ?? entry.caseId;
          return (
            <li key={entry.id} className="audit-item">
              <span className={`audit-dot dot-${ACTION_KIND[entry.action]}`} />
              <div>
                <div className="audit-head">
                  <strong>{AUDIT_ACTION_LABEL[entry.action]}</strong>
                  <span className="audit-meta">
                    {code} · {entry.actor}（{ROLE_LABEL[entry.role]}） · {formatTime(entry.at)}
                  </span>
                </div>
                <p>{entry.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
