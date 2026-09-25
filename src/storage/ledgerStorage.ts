// 三个仓库在物理上分开：授权、会谈、变更台账各自一个 localStorage key

import { createRepository, type Repository } from "./repository";
import type { AuditEntry, MinorCase, Consent, SessionNote } from "../types";

export interface LedgerStorage {
  cases: Repository<MinorCase>;
  consents: Repository<Consent>;
  notes: Repository<SessionNote>;
  audit: Repository<AuditEntry>;
  clearAll(): void;
}

export function createLedgerStorage(): LedgerStorage {
  const cases = createRepository<MinorCase>("cases");
  const consents = createRepository<Consent>("consents");
  const notes = createRepository<SessionNote>("notes");
  const audit = createRepository<AuditEntry>("audit");
  return {
    cases,
    consents,
    notes,
    audit,
    clearAll() {
      cases.clear();
      consents.clear();
      notes.clear();
      audit.clear();
    },
  };
}
