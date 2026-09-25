import type { AuditEntry } from "../types";

/** 变更记录：授权、会谈状态的每一次变动都追加一条台账 */
export function makeAudit(
  id: string,
  at: string,
  actor: string,
  caseId: string,
  action: string,
  detail: string
): AuditEntry {
  return { id, at, actor, caseId, action, detail };
}

export function sortAuditDesc(entries: AuditEntry[]): AuditEntry[] {
  return [...entries].sort((a, b) => b.at.localeCompare(a.at));
}
