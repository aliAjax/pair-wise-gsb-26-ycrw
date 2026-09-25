// 会谈模块：会谈记录的归档判定与版本链（纯函数）

import type { Consent, NoteStatus, NoteVersion, SessionNote } from "../types";
import { isTopicAllowed, isWithinValidity } from "./consent";

export interface ClassificationInput {
  sessionDate: string;
  topics: string[];
  consent?: Consent;
  caseClosed: boolean;
}

export type Classification = "filed" | "draft";

/**
 * 核心规则：会谈日期落在有效授权期限内、且主题全部在可谈范围内，
 * 才进入正式档案；否则一律先存受限草稿。
 * 个案已关闭时也不允许新记录入档。
 */
export function classifySession(input: ClassificationInput): Classification {
  if (input.caseClosed) return "draft";
  if (!input.consent) return "draft";
  if (!isWithinValidity(input.consent, input.sessionDate)) return "draft";
  if (!isTopicAllowed(input.consent, input.topics)) return "draft";
  return "filed";
}

let seq = 0;
export function makeId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function firstVersion(status: NoteStatus, actor: string, at: string): NoteVersion[] {
  return [{ version: 1, status, at, actor }];
}

/** 补签后：受限草稿是否可以转正（重新按新授权判定） */
export function canPromote(
  note: SessionNote,
  consent: Consent | undefined,
  caseClosed: boolean
): boolean {
  if (note.status !== "draft") return false;
  return classifySession({
    sessionDate: note.sessionDate,
    topics: note.topics,
    consent,
    caseClosed,
  }) === "filed";
}

/** 督导临时提交所需字段是否齐全 */
export function emergencyReady(reason: string, followUpDue: string, today: string): boolean {
  return reason.trim().length >= 4 && parseSafe(followUpDue) >= parseSafe(today);
}

function parseSafe(value: string): number {
  const t = Date.parse(value + "T00:00:00Z");
  return Number.isNaN(t) ? -Infinity : t;
}

/** 追加版本链节点（不修改原对象） */
export function withVersion(
  note: SessionNote,
  status: NoteStatus,
  at: string,
  actor: string,
  reason?: string
): SessionNote {
  const next: NoteVersion = {
    version: note.versions.length + 1,
    status,
    at,
    actor,
    reason,
  };
  return { ...note, status, versions: [...note.versions, next] };
}

export const NOTE_STATUS_LABEL: Record<NoteStatus, string> = {
  draft: "受限草稿",
  filed: "正式档案",
  emergency: "督导临时提交",
  "closed-archive": "关闭封存",
};
