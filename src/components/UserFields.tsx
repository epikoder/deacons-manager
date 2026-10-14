import { ReactNode, useState } from "react";
export {
  Card,
  dangerButton,
  primaryButton,
  secondaryButton,
} from "./ui";
import {
  AppUser,
  MIN_PASSWORD,
  ROLE_HINT,
  ROLE_LABEL,
  UserRole,
} from "../services/users.service";

export const Avatar = (
  { user, size = "md" }: {
    user: Pick<AppUser, "fname" | "lname" | "email">;
    size?: "md" | "lg";
  },
) => {
  const initials = ((user.fname?.[0] ?? "") + (user.lname?.[0] ?? "")) ||
    user.email[0];
  return (
    <span
      aria-hidden
      className={`inline-grid place-items-center shrink-0 rounded-full bg-green-100 font-semibold uppercase text-green-800 ${
        size === "lg" ? "size-14 text-lg" : "size-8 text-xs"
      }`}
    >
      {initials}
    </span>
  );
};

export const RoleBadge = ({ role }: { role: UserRole }) => (
  <span
    className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
      role === "admin"
        ? "bg-violet-50 text-violet-700 ring-violet-600/30"
        : "bg-zinc-100 text-zinc-700 ring-zinc-300"
    }`}
  >
    {ROLE_LABEL[role]}
  </span>
);

export const RemovedBadge = () => (
  <span className="inline-flex items-center rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/30">
    Removed
  </span>
);

const inputClass =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition-shadow placeholder:text-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-500";
const okBorder =
  "border-zinc-300 focus:border-green-500 focus:ring-2 focus:ring-green-500/20";
const badBorder = "border-red-500 focus:ring-2 focus:ring-red-500/20";

export function Field(
  { label, error, hint, children }: {
    label: string;
    error?: string | null;
    hint?: ReactNode;
    children: ReactNode;
  },
) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-zinc-800">{label}</span>
      {children}
      {error
        ? <span className="text-xs text-red-600">{error}</span>
        : hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function TextInput(
  { invalid, ...props }: React.InputHTMLAttributes<HTMLInputElement> & {
    invalid?: boolean;
  },
) {
  return (
    <input
      {...props}
      className={`${inputClass} ${invalid ? badBorder : okBorder} ${
        props.className ?? ""
      }`}
    />
  );
}

export function RoleSelect(
  { value, onChange, disabled, disabledReason }: {
    value: UserRole;
    onChange: (r: UserRole) => void;
    disabled?: boolean;
    disabledReason?: string;
  },
) {
  return (
    <fieldset className="flex flex-col gap-1.5 text-sm" disabled={disabled}>
      <legend className="mb-1.5 font-medium text-zinc-800">Role</legend>
      <div className="grid sm:grid-cols-2 gap-2">
        {(["authenticated", "admin"] as UserRole[]).map((role) => (
          <label
            key={role}
            className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
              value === role
                ? "border-green-600 bg-green-50/60 ring-1 ring-green-600"
                : "border-zinc-300 hover:bg-zinc-50"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <input
              type="radio"
              name="role"
              value={role}
              checked={value === role}
              onChange={() => onChange(role)}
              className="mt-0.5 accent-green-600"
            />
            <span>
              <span className="block font-medium text-zinc-900">
                {ROLE_LABEL[role]}
              </span>
              <span className="block text-xs text-zinc-500">
                {ROLE_HINT[role]}
              </span>
            </span>
          </label>
        ))}
      </div>
      {disabled && disabledReason && (
        <span className="text-xs text-zinc-500">{disabledReason}</span>
      )}
    </fieldset>
  );
}

/** New password + confirmation, with the rule the database enforces. */
export const passwordError = (password: string, confirm: string) => {
  if (password.length < MIN_PASSWORD) {
    return { password: `Use at least ${MIN_PASSWORD} characters`, confirm: null };
  }
  if (confirm !== password) {
    return { password: null, confirm: "Passwords don't match" };
  }
  return null;
};

export function PasswordFields(
  { password, confirm, onChange, showErrors, disabled, labels }: {
    password: string;
    confirm: string;
    onChange: (next: { password: string; confirm: string }) => void;
    showErrors: boolean;
    disabled?: boolean;
    labels?: { password?: string; confirm?: string };
  },
) {
  const [visible, setVisible] = useState(false);
  const errors = showErrors ? passwordError(password, confirm) : null;
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Field
        label={labels?.password ?? "Password"}
        error={errors?.password}
        hint={`At least ${MIN_PASSWORD} characters`}
      >
        <TextInput
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          disabled={disabled}
          invalid={!!errors?.password}
          onChange={(ev) => onChange({ password: ev.target.value, confirm })}
        />
      </Field>
      <Field label={labels?.confirm ?? "Confirm password"} error={errors?.confirm}>
        <TextInput
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          disabled={disabled}
          invalid={!!errors?.confirm}
          onChange={(ev) => onChange({ password, confirm: ev.target.value })}
        />
      </Field>
      <label className="sm:col-span-2 flex items-center gap-2 text-xs text-zinc-600 w-fit cursor-pointer">
        <input
          type="checkbox"
          checked={visible}
          onChange={(ev) => setVisible(ev.target.checked)}
          className="accent-green-600"
        />
        Show passwords
      </label>
    </div>
  );
}

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
export const emailError = (email: string) =>
  !email.trim()
    ? "Email is required"
    : !EMAIL_RE.test(email.trim())
    ? "Enter a valid email address"
    : null;

export const formatDate = (iso?: string | null, withTime = false) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    })
    : "—";
