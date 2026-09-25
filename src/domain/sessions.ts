import type { Authorization, ScopeTopic, SessionRecord } from "../types";
import { evaluateSession, type AuthCheck } from "./authorization";

export interface SessionInput {
  caseId: string;
  date: string;
  topic: ScopeTopic;
  summary: string;
  mood: string;
  intervention: string;
  nextGoal: string;
}

function nextVersion(record: SessionRecord): number {
  return record.versions.length + 1;
}

/**
 * 会谈入档：先做授权判定。
 * 通过 → 正式档案；不通过 → 受限草稿（不进入正式档案，仅留草稿与原因）。
 */
export function intakeSession(
  input: SessionInput,
  auths: Authorization[],
  now: string,
  id: string,
  counselor: string
): { record: SessionRecord; check: AuthCheck } {
  const check = evaluateSession(auths, input);
  const record: SessionRecord = {
    id,
    ...input,
    status: check.ok ? "formal" : "restricted",
    blockReasons: check.reasons,
    versions: [
      {
        version: 1,
        at: now,
        actor: counselor,
        action: check.ok ? "会谈入档" : "存为受限草稿",
        note: check.ok
          ? "落在有效授权范围内，进入正式档案"
          : check.reasons.join("；"),
      },
    ],
  };
  return { record, check };
}

/** 紧急情况：督导写明原因与回访期限后，受限草稿可临时提交 */
export function emergencySubmit(
  record: SessionRecord,
  supervisor: string,
  reason: string,
  followUpBy: string,
  now: string
): SessionRecord {
  if (record.status !== "restricted") return record;
  return {
    ...record,
    status: "provisional",
    emergency: { supervisor, reason, followUpBy, submittedAt: now },
    versions: [
      ...record.versions,
      {
        version: nextVersion(record),
        at: now,
        actor: supervisor,
        action: "紧急临时提交",
        note: `${reason}（回访期限 ${followUpBy}）`,
      },
    ],
  };
}

/** 监护人补签：临时提交的记录转为正式档案，版本链保留 */
export function countersign(
  record: SessionRecord,
  guardianName: string,
  now: string
): SessionRecord {
  if (record.status !== "provisional") return record;
  return {
    ...record,
    status: "formal",
    versions: [
      ...record.versions,
      {
        version: nextVersion(record),
        at: now,
        actor: guardianName,
        action: "补签确认",
        note: "监护人补充签署授权，记录转入正式档案",
      },
    ],
  };
}

/** 关闭：受限草稿或临时提交记录封存，版本链保留 */
export function closeRecord(
  record: SessionRecord,
  actor: string,
  note: string,
  now: string
): SessionRecord {
  if (record.status !== "restricted" && record.status !== "provisional") {
    return record;
  }
  return {
    ...record,
    status: "closed",
    versions: [
      ...record.versions,
      {
        version: nextVersion(record),
        at: now,
        actor,
        action: "记录关闭",
        note: note || "记录封存，不再进入正式档案",
      },
    ],
  };
}
