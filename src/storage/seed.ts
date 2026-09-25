// 原型演示数据：覆盖 授权有效 / 授权过期 / 超出范围 / 督导紧急提交 四种情形

import type { AuditEntry, Consent, MinorCase, SessionNote } from "../types";
import { firstVersion } from "../modules/sessions";

// 原型基准日：2026-09-25（演示固定，便于观察临期与过期）
export const SEED_TODAY = "2026-09-25";

export interface SeedState {
  cases: MinorCase[];
  consents: Consent[];
  notes: SessionNote[];
  audit: AuditEntry[];
}

export function buildSeedState(): SeedState {
  const cases: MinorCase[] = [
    {
      id: "case-042",
      code: "M-042",
      age: 14,
      riskLevel: "中风险",
      openedAt: "2026-03-02T09:00:00.000Z",
      closed: false,
      currentConsentId: "con-042-1",
    },
    {
      id: "case-117",
      code: "M-117",
      age: 16,
      riskLevel: "关注",
      openedAt: "2026-01-12T09:00:00.000Z",
      closed: false,
      currentConsentId: "con-117-1",
    },
    {
      id: "case-203",
      code: "M-203",
      age: 13,
      riskLevel: "高风险关注",
      openedAt: "2026-06-20T09:00:00.000Z",
      closed: false,
      currentConsentId: "con-203-1",
    },
  ];

  const consents: Consent[] = [
    {
      id: "con-042-1",
      caseId: "case-042",
      version: 1,
      guardianName: "陈某某（父亲）",
      relation: "父亲",
      phone: "138****2201",
      scopes: [
        { topic: "学业压力", boundary: "可谈考试焦虑与时间管理，不涉及家庭经济细节" },
        { topic: "同伴关系", boundary: "可谈校园人际冲突" },
        { topic: "情绪调节", boundary: "可谈情绪识别与放松练习" },
      ],
      validFrom: "2026-03-01",
      validUntil: "2026-12-31",
      signedAt: "2026-03-01T10:20:00.000Z",
      status: "active",
    },
    {
      id: "con-117-1",
      caseId: "case-117",
      version: 1,
      guardianName: "周某某（母亲）",
      relation: "母亲",
      phone: "139****7745",
      scopes: [
        { topic: "情绪调节", boundary: "可谈情绪波动与睡眠" },
        { topic: "亲子沟通", boundary: "可谈与父母的日常沟通" },
      ],
      validFrom: "2026-01-10",
      validUntil: "2026-08-31", // 已过期
      signedAt: "2026-01-10T14:00:00.000Z",
      status: "active",
    },
    {
      id: "con-203-1",
      caseId: "case-203",
      version: 1,
      guardianName: "林某某（父亲）",
      relation: "父亲",
      phone: "137****9088",
      scopes: [
        { topic: "情绪调节", boundary: "仅可谈情绪稳定化与安全计划" },
        { topic: "自伤风险", boundary: "可谈自伤冲动评估与危机干预" },
      ],
      validFrom: "2026-09-01",
      validUntil: "2026-10-05", // 15 天内临期
      signedAt: "2026-09-01T11:00:00.000Z",
      status: "active",
    },
  ];

  const actor = "李咨询师";
  const supervisor = "王督导";
  const notes: SessionNote[] = [
    {
      id: "note-042-1",
      caseId: "case-042",
      sessionDate: "2026-09-12",
      topics: ["学业压力", "情绪调节"],
      summary: "期中考试临近出现入睡困难，练习了腹式呼吸与任务拆分。",
      mood: "焦虑偏高",
      intervention: "放松训练、认知重构",
      nextGoal: "每日 10 分钟呼吸练习，记录焦虑评分",
      status: "filed",
      versions: firstVersion("filed", actor, "2026-09-12T11:00:00.000Z"),
    },
    {
      id: "note-117-1",
      caseId: "case-117",
      sessionDate: "2026-09-19",
      topics: ["亲子沟通"],
      summary: "谈到与母亲的争吵。会谈时系统提示授权已于 8 月 31 日过期，记录先存受限草稿。",
      mood: "低落",
      intervention: "倾听与情绪反映",
      nextGoal: "联系监护人补签授权后复核",
      status: "draft",
      versions: firstVersion("draft", actor, "2026-09-19T10:30:00.000Z"),
    },
    {
      id: "note-203-1",
      caseId: "case-203",
      sessionDate: "2026-09-06",
      topics: ["家庭冲突"],
      summary: "来访者主动谈到家庭暴力细节，超出当前授权可谈范围，先存受限草稿待补签。",
      mood: "恐惧、警觉",
      intervention: "稳定化技术",
      nextGoal: "督导评估是否扩大授权范围",
      status: "draft",
      versions: firstVersion("draft", actor, "2026-09-06T13:00:00.000Z"),
    },
    {
      id: "note-203-2",
      caseId: "case-203",
      sessionDate: "2026-09-22",
      topics: ["自伤风险"],
      summary: "夜间出现自伤冲动并到校医室处理，紧急会谈。督导写明原因后临时提交，等待回访。",
      mood: "高风险",
      intervention: "安全计划、危机干预、家校联动",
      nextGoal: "48 小时内回访并确认安全计划执行",
      status: "emergency",
      versions: [
        {
          version: 1,
          status: "emergency",
          at: "2026-09-22T22:10:00.000Z",
          actor: supervisor,
          reason: "夜间危机，无法即时取得监护人书面确认",
        },
      ],
      emergencyReason: "夜间危机干预，来访者有即时自伤行为，无法即时取得监护人书面确认",
      followUpDue: "2026-09-24",
      followUpDone: false,
    },
  ];

  const audit: AuditEntry[] = [
    {
      id: "aud-seed-1",
      at: "2026-03-02T09:05:00.000Z",
      action: "case_created",
      actor: "李咨询师",
      role: "counselor",
      caseId: "case-042",
      detail: "新建未成年个案 M-042（14 岁），登记监护人授权 v1",
      refId: "con-042-1",
    },
    {
      id: "aud-seed-2",
      at: "2026-09-12T11:00:00.000Z",
      action: "session_saved",
      actor: "李咨询师",
      role: "counselor",
      caseId: "case-042",
      detail: "会谈记录 note-042-1 在授权范围内，进入正式档案",
      refId: "note-042-1",
    },
    {
      id: "aud-seed-3",
      at: "2026-09-19T10:30:00.000Z",
      action: "note_restricted",
      actor: "李咨询师",
      role: "counselor",
      caseId: "case-117",
      detail: "授权 v1 已于 2026-08-31 过期，note-117-1 先存受限草稿",
      refId: "note-117-1",
    },
    {
      id: "aud-seed-4",
      at: "2026-09-06T13:00:00.000Z",
      action: "note_restricted",
      actor: "李咨询师",
      role: "counselor",
      caseId: "case-203",
      detail: "主题「家庭冲突」超出授权可谈范围，note-203-1 先存受限草稿",
      refId: "note-203-1",
    },
    {
      id: "aud-seed-5",
      at: "2026-09-22T22:10:00.000Z",
      action: "emergency_filed",
      actor: "王督导",
      role: "supervisor",
      caseId: "case-203",
      detail:
        "紧急情况临时提交 note-203-2：夜间危机，无法即时取得监护人书面确认；回访期限 2026-09-24",
      refId: "note-203-2",
    },
  ];

  return { cases, consents, notes, audit };
}
