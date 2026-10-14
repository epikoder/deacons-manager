import { FormEvent, useEffect, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import UserService, {
  AppUser,
  displayName,
  UserInput,
} from "../../../../src/services/users.service";
import {
  Avatar,
  Card,
  dangerButton,
  emailError,
  Field,
  formatDate,
  PasswordFields,
  passwordError,
  primaryButton,
  RemovedBadge,
  RoleBadge,
  RoleSelect,
  secondaryButton,
  TextInput,
} from "../../../../src/components/UserFields";
import CopyButton from "../../../../src/components/CopyButton";
import { ActivityIndicator } from "../../../../src/components/Icons";
import { showAlertDialog } from "../../../../src/components/Dialog";
import Toast from "../../../../src/utils/toast";

const toInput = (u: AppUser): UserInput => ({
  fname: u.fname ?? "",
  lname: u.lname ?? "",
  email: u.email,
  role: u.role,
});

export default function () {
  const context = usePageContext();
  const id = context.routeParams.id;
  const me = context.config.user as User & { id?: string };
  const [user, setUser] = useState<AppUser | null | undefined>(undefined);

  const load = () => UserService.get(id).then(setUser);
  useEffect(() => {
    load();
  }, [id]);

  if (user === undefined) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-zinc-500 gap-2">
        <ActivityIndicator active className="size-5" /> Loading user…
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
        <h1 className="text-base font-semibold text-zinc-900">
          User not found
        </h1>
        <a
          href="/users"
          className="mt-2 inline-block text-sm text-green-700 hover:underline"
        >
          Back to users
        </a>
      </div>
    );
  }

  const isMe = user.id === me?.id;
  const removed = !!user.deleted_at;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <a href="/users" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← Users
        </a>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Avatar user={user} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-zinc-900">
                {displayName(user)}
              </h1>
              <RoleBadge role={user.role} />
              {removed && <RemovedBadge />}
              {isMe && (
                <span className="text-xs font-medium text-zinc-400">You</span>
              )}
            </div>
            <div className="flex items-center gap-1 text-sm text-zinc-500">
              {user.email}
              <CopyButton value={user.email} label="Copy email" />
            </div>
          </div>
        </div>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-xs">
          <div className="flex gap-1.5">
            <dt className="text-zinc-500">Added</dt>
            <dd className="text-zinc-800">{formatDate(user.created_at)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-zinc-500">Last signed in</dt>
            <dd className="text-zinc-800">
              {user.last_seen_at ? formatDate(user.last_seen_at, true) : "Never"}
            </dd>
          </div>
          {removed && (
            <div className="flex gap-1.5">
              <dt className="text-zinc-500">Removed</dt>
              <dd className="text-zinc-800">{formatDate(user.deleted_at)}</dd>
            </div>
          )}
        </dl>
      </div>

      {removed
        ? <RemovedNotice user={user} onRestored={load} />
        : (
          <>
            <ProfileCard key={user.updated_at} user={user} isMe={isMe} onSaved={load} />
            <PasswordCard user={user} isMe={isMe} />
            <RemoveCard user={user} isMe={isMe} onRemoved={load} />
          </>
        )}
    </div>
  );
}

function ProfileCard(
  { user, isMe, onSaved }: {
    user: AppUser;
    isMe: boolean;
    onSaved: () => void;
  },
) {
  const [form, setForm] = useState(toInput(user));
  const [saving, setSaving] = useState(false);
  const initial = toInput(user);
  const dirty = (Object.keys(form) as (keyof UserInput)[]).some((k) =>
    form[k].trim() !== initial[k].trim()
  );
  const errors = {
    fname: !form.fname.trim() ? "First name is required" : null,
    email: emailError(form.email),
  };
  const valid = !errors.fname && !errors.email;
  const signsOut = form.role !== user.role ||
    form.email.trim().toLowerCase() !== user.email.toLowerCase();

  const save = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!dirty || !valid || saving) return;
    setSaving(true);
    const { ok } = await UserService.update(user.id, {
      ...form,
      email: form.email.trim(),
    });
    setSaving(false);
    if (!ok) return;
    Toast.success("Changes saved");
    onSaved();
  };

  return (
    <form onSubmit={save} noValidate>
      <Card title="Profile">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="First name" error={dirty ? errors.fname : null}>
            <TextInput
              value={form.fname}
              invalid={dirty && !!errors.fname}
              onChange={(ev) => setForm({ ...form, fname: ev.target.value })}
            />
          </Field>
          <Field label="Last name">
            <TextInput
              value={form.lname}
              onChange={(ev) => setForm({ ...form, lname: ev.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Email" error={dirty ? errors.email : null}>
              <TextInput
                type="email"
                value={form.email}
                invalid={dirty && !!errors.email}
                onChange={(ev) => setForm({ ...form, email: ev.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <RoleSelect
              value={form.role}
              onChange={(role) => setForm({ ...form, role })}
              disabled={isMe}
              disabledReason="You can't change your own role. Ask another admin."
            />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          {dirty && signsOut && (
            <span className="mr-auto text-xs text-amber-700">
              {isMe
                ? "Changing your email signs you out within the hour."
                : "They'll be signed out and need to sign in again."}
            </span>
          )}
          <button
            type="button"
            className={secondaryButton}
            disabled={!dirty || saving}
            onClick={() => setForm(initial)}
          >
            Discard
          </button>
          <button
            type="submit"
            className={primaryButton}
            disabled={!dirty || !valid || saving}
          >
            {saving && <ActivityIndicator active className="size-4" />}
            Save changes
          </button>
        </div>
      </Card>
    </form>
  );
}

function PasswordCard({ user, isMe }: { user: AppUser; isMe: boolean }) {
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = async (ev: FormEvent) => {
    ev.preventDefault();
    setSubmitted(true);
    if (passwordError(pw.password, pw.confirm) || saving) return;
    setSaving(true);
    const { ok } = await UserService.resetPassword(user.id, pw.password);
    setSaving(false);
    if (!ok) return;
    Toast.success("Password reset");
    setPw({ password: "", confirm: "" });
    setSubmitted(false);
  };

  return (
    <form onSubmit={reset} noValidate>
      <Card
        title="Reset password"
        description={isMe
          ? "Sets a new password for your own account. You'll be signed out within the hour."
          : `Sets a new password for ${displayName(user)}. They're signed out and must use the new one; share it with them directly.`}
      >
        <PasswordFields
          password={pw.password}
          confirm={pw.confirm}
          onChange={setPw}
          showErrors={submitted}
        />
        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            className={primaryButton}
            disabled={saving || !pw.password}
          >
            {saving && <ActivityIndicator active className="size-4" />}
            Reset password
          </button>
        </div>
      </Card>
    </form>
  );
}

function RemoveCard(
  { user, isMe, onRemoved }: {
    user: AppUser;
    isMe: boolean;
    onRemoved: () => void;
  },
) {
  return (
    <Card
      title="Remove user"
      tone="danger"
      description="They can no longer sign in. Their account is kept and can be restored."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-zinc-500">
          {isMe
            ? "You can't remove your own account."
            : user.role === "admin"
            ? "An admin can only be removed while another admin remains."
            : "Orders and records they worked on are not affected."}
        </span>
        <button
          type="button"
          className={dangerButton}
          disabled={isMe}
          onClick={() =>
            showAlertDialog({
              title: `Remove ${displayName(user)}?`,
              message: (
                <p className="text-zinc-600">
                  {user.email} will be signed out and can't sign in again
                  until restored.
                </p>
              ),
              confirmLabel: "Remove user",
              destructive: true,
              onContinue: async () => {
                const { ok } = await UserService.remove(user.id);
                if (!ok) throw new Error("remove failed"); // keep the dialog open
                Toast.success("User removed");
                onRemoved();
              },
            })}
        >
          Remove user
        </button>
      </div>
    </Card>
  );
}

function RemovedNotice(
  { user, onRestored }: { user: AppUser; onRestored: () => void },
) {
  const [saving, setSaving] = useState(false);
  return (
    <Card
      title="This user has been removed"
      description="They can't sign in. Restore the account to let them back in with their existing password."
    >
      <div className="flex justify-end">
        <button
          type="button"
          className={secondaryButton}
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            const { ok } = await UserService.restore(user.id);
            setSaving(false);
            if (!ok) return;
            Toast.success("User restored");
            onRestored();
          }}
        >
          {saving && <ActivityIndicator active className="size-4" />}
          Restore user
        </button>
      </div>
    </Card>
  );
}
