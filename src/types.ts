// 领域类型：授权 / 会谈 / 变更台账
// 四个关注点在这里只共享类型，逻辑与存储各自分开实现。

export type Role = "counselor" | "supervisor" | "admin";

/** 授权状态（由有效期限实时推导，不落库） */
export type ConsentState = "valid" | "expiring" | "expired" | "pending";

/** 授权状态 */
export type ConsentStatus = "active" | "superseded";

/** 授权范围项：可谈主题 + 边界说明 */
export interface ConsentScope {
  topic: string;
  boundary: string;
}

/** 单份监护人授权（补签时新增版本，不覆盖旧版本） */
export interface Consent {
  id: string;
  caseId: string;
  version: number;
  guardianName: string;
  relation: string;
  phone: string;
  scopes: ConsentScope[];
  validFrom: string; // YYYY-MM-DD
  validUntil: string; // YYYY-MM-DD
  signedAt: string; // ISO 时间戳
  status: ConsentStatus;
}

/** 未成年个案 */
export interface MinorCase {
  id: string; // 个案编号，如 M-042
  code: string; // 来访者代号
  age: number;
  riskLevel: string;
  openedAt: string; // ISO
  closed: boolean;
  closedAt?: string;
  currentConsentId?: string; // 当前生效授权版本 id
}

/** 会谈记录归档状态 */
export type NoteStatus =
  | "draft" // 受限草稿：超出授权范围 / 授权失效
  | "filed" // 正式档案
  | "emergency" // 督导临时提交
  | "closed-archive"; // 个案关闭后封存版本

export interface NoteVersion {
  version: number;
  status: NoteStatus;
  at: string; // ISO
  actor: string;
  reason?: string; // 状态变更原因（补签转正 / 督导临时提交原因 / 关闭封存）
}

/** 会谈记录 */
export interface SessionNote {
  id: string;
  caseId: string;
  sessionDate: string;
  topics: string[];
  summary: string;
  mood: string;
  intervention: string;
  nextGoal: string;
  status: NoteStatus;
  versions: NoteVersion[];
  /** 督导临时提交时填写 */
  emergencyReason?: string;
  followUpDue?: string; // 回访期限 YYYY-MM-DD
  followUpDone?: boolean;
}

/** 变更台账动作 */
export type AuditAction =
  | "case_created"
  | "session_saved"
  | "note_restricted"
  | "consent_signed"
  | "note_promoted"
  | "emergency_filed"
  | "case_closed";

export interface AuditEntry {
  id: string;
  at: string;
  action: AuditAction;
  actor: string;
  role: Role;
  caseId: string;
  detail: string;
  refId?: string; // 关联的授权 / 会谈记录 id
}
