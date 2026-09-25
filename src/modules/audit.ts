// 变更台账模块：授权、会谈、紧急处置的操作流水（纯函数）

import type { AuditAction, AuditEntry, Role } from "../types";
import { makeId } from "./sessions";

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  case_created: "新建未成年个案",
  session_saved: "会谈记录入档",
  note_restricted: "转入受限草稿",
  consent_signed: "监护人授权补签/变更",
  note_promoted: "补签后草稿转正",
  emergency_filed: "督导紧急临时提交",
  case_closed: "个案关闭封存",
};

export function buildAuditEntry(input: {
  action: AuditAction;
  actor: string;
  role: Role;
  caseId: string;
  detail: string;
  refId?: string;
  at: string;
}): AuditEntry {
  return { id: makeId("aud"), ...input };
}
