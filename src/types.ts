export type ScopeTopic =
  | "学业压力"
  | "情绪管理"
  | "同伴关系"
  | "亲子沟通"
  | "网络使用"
  | "家庭变故";

export const SCOPE_TOPICS: ScopeTopic[] = [
  "学业压力",
  "情绪管理",
  "同伴关系",
  "亲子沟通",
  "网络使用",
  "家庭变故",
];

export interface Guardian {
  name: string;
  relation: string;
  phone: string;
}

/** 监护人授权：可谈范围 + 有效期限 */
export interface Authorization {
  id: string;
  caseId: string;
  guardian: Guardian;
  scope: ScopeTopic[];
  validFrom: string; // YYYY-MM-DD
  validTo: string; // YYYY-MM-DD
  signedAt: string;
}

export interface MinorCase {
  id: string;
  alias: string;
  age: number;
  counselor: string;
  riskLevel: "稳定" | "关注" | "高风险";
}

/**
 * formal      正式档案：落在有效授权范围内
 * restricted  受限草稿：授权过期或超出可谈范围，仅咨询师可见
 * provisional 临时提交：督导紧急情况提交，待补签或关闭
 * closed      已关闭：封存，保留版本链
 */
export type SessionStatus = "formal" | "restricted" | "provisional" | "closed";

export interface SessionVersion {
  version: number;
  at: string;
  actor: string;
  action: string;
  note: string;
}

export interface EmergencyInfo {
  supervisor: string;
  reason: string;
  followUpBy: string; // 回访期限 YYYY-MM-DD
  submittedAt: string;
}

export interface SessionRecord {
  id: string;
  caseId: string;
  date: string;
  topic: ScopeTopic;
  summary: string;
  mood: string;
  intervention: string;
  nextGoal: string;
  status: SessionStatus;
  blockReasons: string[];
  emergency?: EmergencyInfo;
  versions: SessionVersion[];
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  caseId: string;
  action: string;
  detail: string;
}

export interface LedgerData {
  cases: MinorCase[];
  authorizations: Authorization[];
  sessions: SessionRecord[];
  audit: AuditEntry[];
}
