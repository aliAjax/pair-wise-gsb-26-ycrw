import type { AuditEntry, Authorization, LedgerData, MinorCase, SessionRecord } from "../types";

/** 本地保存：四个集合分别存取，与领域逻辑完全解耦 */
const NS = "hxwl12.ledger.";
const KEYS = {
  cases: NS + "cases",
  authorizations: NS + "authorizations",
  sessions: NS + "sessions",
  audit: NS + "audit",
} as const;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 本地存储不可用时静默降级为内存态
  }
}

export const localStore = {
  load(): LedgerData | null {
    const cases = read<MinorCase[]>(KEYS.cases);
    const authorizations = read<Authorization[]>(KEYS.authorizations);
    const sessions = read<SessionRecord[]>(KEYS.sessions);
    const audit = read<AuditEntry[]>(KEYS.audit);
    if (!cases || !authorizations || !sessions || !audit) return null;
    return { cases, authorizations, sessions, audit };
  },

  save(data: LedgerData): void {
    write(KEYS.cases, data.cases);
    write(KEYS.authorizations, data.authorizations);
    write(KEYS.sessions, data.sessions);
    write(KEYS.audit, data.audit);
  },

  clear(): void {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  },
};
