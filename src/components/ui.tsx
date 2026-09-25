import type { ReactNode } from "react";
import type { Role } from "../types";

export const ROLE_LABEL: Record<Role, string> = {
  counselor: "咨询师",
  supervisor: "督导",
  admin: "机构管理员",
};

const BADGE_CLASS: Record<string, string> = {
  valid: "badge badge-ok",
  expiring: "badge badge-warn",
  expired: "badge badge-danger",
  pending: "badge badge-muted",
  draft: "badge badge-danger",
  filed: "badge badge-ok",
  emergency: "badge badge-warn",
  "closed-archive": "badge badge-muted",
};

export function Badge({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={BADGE_CLASS[kind] ?? "badge badge-muted"}>{children}</span>;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="form-field">
      <span>
        {label}
        {hint ? <em>{hint}</em> : null}
      </span>
      {children}
    </label>
  );
}

export function RoleSwitcher({
  role,
  onChange,
}: {
  role: Role;
  onChange: (role: Role) => void;
}) {
  const roles: Role[] = ["counselor", "supervisor", "admin"];
  return (
    <div className="role-switcher" aria-label="当前角色">
      <span className="role-label">当前身份</span>
      {roles.map((r) => (
        <button
          key={r}
          className={role === r ? "role-btn active" : "role-btn"}
          onClick={() => onChange(r)}
        >
          {ROLE_LABEL[r]}
        </button>
      ))}
    </div>
  );
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}
