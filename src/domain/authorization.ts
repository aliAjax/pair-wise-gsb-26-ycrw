import type { Authorization, ScopeTopic } from "../types";

export interface AuthCheck {
  ok: boolean;
  reasons: string[];
  authorization: Authorization | null;
}

export function isValidOn(auth: Authorization, date: string): boolean {
  return auth.validFrom <= date && date <= auth.validTo;
}

/** 会谈日期当天覆盖该个案的授权；没有则返回 null */
export function findAuthorization(
  auths: Authorization[],
  caseId: string,
  date: string
): Authorization | null {
  return (
    auths
      .filter((a) => a.caseId === caseId)
      .sort((a, b) => b.validTo.localeCompare(a.validTo))
      .find((a) => isValidOn(a, date)) ?? null
  );
}

/** 个案最近一次签署的授权（用于提示"已于何时到期"） */
export function latestAuthorization(
  auths: Authorization[],
  caseId: string
): Authorization | null {
  const list = auths
    .filter((a) => a.caseId === caseId)
    .sort((a, b) => b.validTo.localeCompare(a.validTo));
  return list[0] ?? null;
}

/**
 * 授权判定：会谈记录只有落在有效授权范围内（日期在有效期内且主题在可谈范围内）
 * 才允许进入正式档案，否则给出拦截原因。
 */
export function evaluateSession(
  auths: Authorization[],
  input: { caseId: string; date: string; topic: ScopeTopic }
): AuthCheck {
  const auth = findAuthorization(auths, input.caseId, input.date);
  if (!auth) {
    const latest = latestAuthorization(auths, input.caseId);
    const reason = latest
      ? `监护人授权已于 ${latest.validTo} 到期，需续签后方可入档`
      : "该个案尚未登记监护人授权";
    return { ok: false, reasons: [reason], authorization: null };
  }
  if (!auth.scope.includes(input.topic)) {
    return {
      ok: false,
      reasons: [
        `主题「${input.topic}」超出授权可谈范围（授权范围：${auth.scope.join("、")}）`,
      ],
      authorization: auth,
    };
  }
  return { ok: true, reasons: [], authorization: auth };
}
