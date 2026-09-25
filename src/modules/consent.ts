// 授权模块：监护人授权范围与有效期限（纯函数，不依赖 React 与本地保存）

import type { Consent, ConsentState, MinorCase } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDate(value: string): number {
  // 按 UTC 解析，避免 toISOString 的时区漂移
  return Date.parse(value + "T00:00:00Z");
}

/** 15 天内到期视为临期 */
export const EXPIRING_SOON_DAYS = 15;

/** 授权在指定日期是否在有效期内（含起止当日） */
export function isWithinValidity(consent: Consent, date: string): boolean {
  const d = parseDate(date);
  return parseDate(consent.validFrom) <= d && d <= parseDate(consent.validUntil);
}

/** 距离到期天数（负数表示已过期） */
export function daysUntilExpiry(consent: Consent, today: string): number {
  return Math.round((parseDate(consent.validUntil) - parseDate(today)) / DAY_MS);
}

/** 单个授权在某日的状态 */
export function consentState(consent: Consent, today: string): ConsentState {
  const d = parseDate(today);
  if (d < parseDate(consent.validFrom)) return "pending";
  const left = daysUntilExpiry(consent, today);
  if (left < 0) return "expired";
  if (left <= EXPIRING_SOON_DAYS) return "expiring";
  return "valid";
}

/** 取个案当前授权版本；未补签时回退到首版本用于范围判断 */
export function getCurrentConsent(
  consents: Consent[],
  caseId: string,
  currentConsentId?: string
): Consent | undefined {
  const list = consents
    .filter((c) => c.caseId === caseId)
    .sort((a, b) => a.version - b.version);
  if (list.length === 0) return undefined;
  return list.find((c) => c.id === currentConsentId) ?? list[list.length - 1];
}

export interface CaseConsentView {
  consent?: Consent;
  state: ConsentState;
  daysLeft: number | null;
  topics: string[];
}

/** 个案授权台账视图 */
export function getCaseConsentView(
  consents: Consent[],
  minorCase: MinorCase,
  today: string
): CaseConsentView {
  const consent = getCurrentConsent(consents, minorCase.id, minorCase.currentConsentId);
  if (!consent) return { state: "expired", daysLeft: null, topics: [] };
  const state = minorCase.closed ? "expired" : consentState(consent, today);
  return {
    consent,
    state,
    daysLeft: daysUntilExpiry(consent, today),
    topics: consent.scopes.map((s) => s.topic),
  };
}

/** 会谈主题是否全部落在可谈范围内 */
export function isTopicAllowed(consent: Consent | undefined, topics: string[]): boolean {
  if (!consent) return false;
  const allowed = new Set(consent.scopes.map((s) => s.topic));
  return topics.length > 0 && topics.every((t) => allowed.has(t));
}

/** 补签后的新版本号 */
export function nextConsentVersion(consents: Consent[], caseId: string): number {
  return consents.filter((c) => c.caseId === caseId).length + 1;
}
