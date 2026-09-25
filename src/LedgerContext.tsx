// 台账状态编排：把授权、会谈、变更台账三个领域模块与本地保存仓库接起来。
// UI 只通过本 context 操作，不直接碰 localStorage。

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AuditEntry,
  Consent,
  MinorCase,
  Role,
  SessionNote,
} from "./types";
import { SEED_TODAY, buildSeedState } from "./storage/seed";
import { createLedgerStorage } from "./storage/ledgerStorage";
import { buildAuditEntry } from "./modules/audit";
import {
  classifySession,
  emergencyReady,
  firstVersion,
  makeId,
  withVersion,
} from "./modules/sessions";
import {
  getCurrentConsent,
  nextConsentVersion,
} from "./modules/consent";

const storage = createLedgerStorage();

function loadInitial() {
  const seed = buildSeedState();
  const cases = storage.cases.load();
  if (cases.length > 0) {
    return {
      cases,
      consents: storage.consents.load(),
      notes: storage.notes.load(),
      audit: storage.audit.load(),
    };
  }
  // 首次打开：写入演示数据
  storage.cases.save(seed.cases);
  storage.consents.save(seed.consents);
  storage.notes.save(seed.notes);
  storage.audit.save(seed.audit);
  return seed;
}

export interface NewCaseInput {
  code: string;
  age: number;
  riskLevel: string;
  guardianName: string;
  relation: string;
  phone: string;
  topics: string[];
  boundaries: Record<string, string>;
  validFrom: string;
  validUntil: string;
}

export interface NewNoteInput {
  caseId: string;
  sessionDate: string;
  topics: string[];
  summary: string;
  mood: string;
  intervention: string;
  nextGoal: string;
}

export interface RenewConsentInput {
  caseId: string;
  guardianName: string;
  relation: string;
  phone: string;
  topics: string[];
  boundaries: Record<string, string>;
  validFrom: string;
  validUntil: string;
}

interface LedgerContextValue {
  today: string;
  role: Role;
  actor: string;
  setRole: (role: Role) => void;
  cases: MinorCase[];
  consents: Consent[];
  notes: SessionNote[];
  audit: AuditEntry[];
  createCase(input: NewCaseInput): void;
  saveNote(input: NewNoteInput): { note: SessionNote; filed: boolean };
  renewConsent(input: RenewConsentInput): { promoted: SessionNote[] };
  emergencySubmit(
    noteId: string,
    reason: string,
    followUpDue: string
  ): { ok: boolean; error?: string };
  markFollowUpDone(noteId: string): void;
  closeCase(caseId: string): void;
  resetDemo(): void;
}

const ROLE_ACTOR: Record<Role, string> = {
  counselor: "李咨询师",
  supervisor: "王督导",
  admin: "赵管理员",
};

const LedgerContext = createContext<LedgerContextValue | null>(null);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(loadInitial);
  const [role, setRole] = useState<Role>("counselor");
  const today = SEED_TODAY;
  const actor = ROLE_ACTOR[role];

  const persist = useCallback(
    (next: {
      cases: MinorCase[];
      consents: Consent[];
      notes: SessionNote[];
      audit: AuditEntry[];
    }) => {
      storage.cases.save(next.cases);
      storage.consents.save(next.consents);
      storage.notes.save(next.notes);
      storage.audit.save(next.audit);
      setState(next);
    },
    []
  );

  const pushAudit = useCallback(
    (
      list: AuditEntry[],
      entry: Omit<AuditEntry, "id" | "at" | "actor" | "role"> &
        Partial<Pick<AuditEntry, "actor" | "role">>
    ): AuditEntry[] => {
      return [
        buildAuditEntry({
          at: new Date().toISOString(),
          actor,
          role,
          ...entry,
        }),
        ...list,
      ];
    },
    [actor, role]
  );

  const createCase = useCallback(
    (input: NewCaseInput) => {
      const now = new Date().toISOString();
      const caseId = makeId("case");
      const newCase: MinorCase = {
        id: caseId,
        code: input.code,
        age: input.age,
        riskLevel: input.riskLevel,
        openedAt: now,
        closed: false,
      };
      const consent: Consent = {
        id: makeId("con"),
        caseId,
        version: 1,
        guardianName: input.guardianName,
        relation: input.relation,
        phone: input.phone,
        scopes: input.topics.map((topic) => ({
          topic,
          boundary: input.boundaries[topic] ?? "",
        })),
        validFrom: input.validFrom,
        validUntil: input.validUntil,
        signedAt: now,
        status: "active",
      };
      newCase.currentConsentId = consent.id;

      setState((prev) => {
        const next = {
          ...prev,
          cases: [newCase, ...prev.cases],
          consents: [consent, ...prev.consents],
        };
        next.audit = pushAudit(next.audit, {
          action: "case_created",
          caseId,
          detail: `新建未成年个案 ${input.code}（${input.age} 岁），登记监护人「${input.guardianName}」授权 v1，有效期 ${input.validFrom} 至 ${input.validUntil}`,
          refId: consent.id,
        });
        persist(next);
        return next;
      });
    },
    [persist, pushAudit]
  );

  const saveNote = useCallback(
    (input: NewNoteInput): { note: SessionNote; filed: boolean } => {
      let result = { note: null as unknown as SessionNote, filed: false };
      setState((prev) => {
        const minorCase = prev.cases.find((c) => c.id === input.caseId);
        const consent = minorCase
          ? getCurrentConsent(prev.consents, minorCase.id, minorCase.currentConsentId)
          : undefined;
        const target = classifySession({
          sessionDate: input.sessionDate,
          topics: input.topics,
          consent,
          caseClosed: minorCase?.closed ?? true,
        });
        const now = new Date().toISOString();
        const id = makeId("note");
        const note: SessionNote = {
          id,
          caseId: input.caseId,
          sessionDate: input.sessionDate,
          topics: input.topics,
          summary: input.summary,
          mood: input.mood,
          intervention: input.intervention,
          nextGoal: input.nextGoal,
          status: target,
          versions: firstVersion(target, ROLE_ACTOR.counselor, now),
        };
        result = { note, filed: target === "filed" };

        const next = { ...prev, notes: [note, ...prev.notes] };
        if (target === "filed") {
          next.audit = pushAudit(next.audit, {
            action: "session_saved",
            caseId: input.caseId,
            detail: `会谈 ${input.sessionDate} 主题「${input.topics.join("、")}」在有效授权范围内，进入正式档案`,
            refId: id,
          });
        } else {
          const reasons: string[] = [];
          if (minorCase?.closed) reasons.push("个案已关闭");
          else if (!consent) reasons.push("无监护人授权");
          else if (input.sessionDate < consent.validFrom || input.sessionDate > consent.validUntil)
            reasons.push(`授权有效期 ${consent.validFrom} 至 ${consent.validUntil} 未覆盖会谈日`);
          else
            reasons.push(
              `主题「${input.topics
                .filter((t) => !consent.scopes.some((s) => s.topic === t))
                .join("、")}」超出可谈范围`
            );
          next.audit = pushAudit(next.audit, {
            action: "note_restricted",
            caseId: input.caseId,
            detail: `会谈 ${input.sessionDate} ${reasons.join("；")}，记录先存受限草稿，待补签后复核`,
            refId: id,
          });
        }
        persist(next);
        return next;
      });
      return result;
    },
    [persist, pushAudit]
  );

  const renewConsent = useCallback(
    (input: RenewConsentInput): { promoted: SessionNote[] } => {
      let promoted: SessionNote[] = [];
      setState((prev) => {
        const now = new Date().toISOString();
        const version = nextConsentVersion(prev.consents, input.caseId);
        const consent: Consent = {
          id: makeId("con"),
          caseId: input.caseId,
          version,
          guardianName: input.guardianName,
          relation: input.relation,
          phone: input.phone,
          scopes: input.topics.map((topic) => ({
            topic,
            boundary: input.boundaries[topic] ?? "",
          })),
          validFrom: input.validFrom,
          validUntil: input.validUntil,
          signedAt: now,
          status: "active",
        };
        // 旧授权标记为被替代（保留原记录，形成版本链）
        const consents = prev.consents.map((c) =>
          c.caseId === input.caseId && c.status === "active"
            ? { ...c, status: "superseded" as const }
            : c
        );
        const cases = prev.cases.map((c) =>
          c.id === input.caseId ? { ...c, currentConsentId: consent.id } : c
        );

        // 补签后重新判定受限草稿：现在落在新授权范围内的转正
        const notes = prev.notes.map((note) => {
          if (note.caseId !== input.caseId || note.status !== "draft") return note;
          const hit =
            classifySession({
              sessionDate: note.sessionDate,
              topics: note.topics,
              consent,
              caseClosed: false,
            }) === "filed";
          if (!hit) return note;
          const updated = withVersion(
            note,
            "filed",
            now,
            ROLE_ACTOR.counselor,
            `监护人补签授权 v${version}（${input.validFrom} 至 ${input.validUntil}），复核通过转正`
          );
          promoted.push(updated);
          return updated;
        });

        const next = {
          ...prev,
          cases,
          consents: [consent, ...consents],
          notes,
        };
        next.audit = pushAudit(next.audit, {
          action: "consent_signed",
          caseId: input.caseId,
          detail: `监护人「${input.guardianName}」补签授权 v${version}，有效期 ${input.validFrom} 至 ${input.validUntil}，可谈范围：${input.topics.join("、")}；旧版本保留`,
          refId: consent.id,
        });
        for (const note of promoted) {
          next.audit = pushAudit(next.audit, {
            action: "note_promoted",
            caseId: input.caseId,
            detail: `受限草稿 ${note.id} 经新授权复核通过，转入正式档案（版本链保留受限阶段）`,
            refId: note.id,
          });
        }
        persist(next);
        return next;
      });
      return { promoted };
    },
    [persist, pushAudit]
  );

  const emergencySubmit = useCallback(
    (noteId: string, reason: string, followUpDue: string) => {
      const note = state.notes.find((n) => n.id === noteId);
      if (!note) return { ok: false, error: "记录不存在" };
      if (note.status !== "draft") return { ok: false, error: "只有受限草稿可临时提交" };
      if (!emergencyReady(reason, followUpDue, today))
        return { ok: false, error: "需写清紧急原因（至少 4 字），且回访期限不得早于今天" };

      setState((prev) => {
        const now = new Date().toISOString();
        const notes = prev.notes.map((n) =>
          n.id === noteId
            ? {
                ...withVersion(
                  n,
                  "emergency",
                  now,
                  ROLE_ACTOR.supervisor,
                  `督导紧急临时提交：${reason}；回访期限 ${followUpDue}`
                ),
                emergencyReason: reason,
                followUpDue,
                followUpDone: false,
              }
            : n
        );
        const next = { ...prev, notes };
        next.audit = pushAudit(next.audit, {
          action: "emergency_filed",
          actor: ROLE_ACTOR.supervisor,
          role: "supervisor",
          caseId: note.caseId,
          detail: `督导临时提交 ${noteId}，原因：${reason}；回访期限 ${followUpDue}`,
          refId: noteId,
        });
        persist(next);
        return next;
      });
      return { ok: true };
    },
    [persist, pushAudit, state.notes, today]
  );

  const markFollowUpDone = useCallback(
    (noteId: string) => {
      setState((prev) => {
        const notes = prev.notes.map((n) =>
          n.id === noteId ? { ...n, followUpDone: true } : n
        );
        const next = { ...prev, notes };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const closeCase = useCallback(
    (caseId: string) => {
      setState((prev) => {
        const now = new Date().toISOString();
        const cases = prev.cases.map((c) =>
          c.id === caseId ? { ...c, closed: true, closedAt: now } : c
        );
        // 关闭：正式档案与紧急提交件封存；受限草稿保留为受限封存版本，版本链不删除
        const notes = prev.notes.map((n) => {
          if (n.caseId !== caseId) return n;
          if (n.status === "draft") return n;
          return withVersion(
            n,
            "closed-archive",
            now,
            actor,
            "个案关闭，记录封存，版本链保留"
          );
        });
        const next = { ...prev, cases, notes };
        next.audit = pushAudit(next.audit, {
          action: "case_closed",
          caseId,
          detail: "个案关闭：已入档/紧急提交记录封存，受限草稿与全部版本链保留备查",
        });
        persist(next);
        return next;
      });
    },
    [actor, persist, pushAudit]
  );

  const resetDemo = useCallback(() => {
    storage.clearAll();
    const seed = buildSeedState();
    storage.cases.save(seed.cases);
    storage.consents.save(seed.consents);
    storage.notes.save(seed.notes);
    storage.audit.save(seed.audit);
    setState(seed);
  }, []);

  const value = useMemo<LedgerContextValue>(
    () => ({
      today,
      role,
      actor,
      setRole,
      cases: state.cases,
      consents: state.consents,
      notes: state.notes,
      audit: state.audit,
      createCase,
      saveNote,
      renewConsent,
      emergencySubmit,
      markFollowUpDone,
      closeCase,
      resetDemo,
    }),
    [
      today,
      role,
      actor,
      state,
      createCase,
      saveNote,
      renewConsent,
      emergencySubmit,
      markFollowUpDone,
      closeCase,
      resetDemo,
    ]
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error("useLedger must be used within LedgerProvider");
  return ctx;
}
