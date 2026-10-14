import { FormEvent, useState } from "react";
import UserService from "../../../../../src/services/users.service";
import {
  Card,
  Field,
  PasswordFields,
  passwordError,
  primaryButton,
  TextInput,
} from "../../../../../src/components/UserFields";
import { ActivityIndicator } from "../../../../../src/components/Icons";
import { saveAuthToken } from "../../../../../src/utils/auth";
import Toast from "../../../../../src/utils/toast";

const empty = { current: "", password: "", confirm: "" };

export default function () {
  const [form, setForm] = useState(empty);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentError = submitted && !form.current
    ? "Enter your current password"
    : null;
  const sameError = submitted && form.password && form.password === form.current
    ? "Choose a password different from the current one"
    : null;

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setSubmitted(true);
    if (
      saving || !form.current ||
      passwordError(form.password, form.confirm) ||
      form.password === form.current
    ) return;
    setSaving(true);
    const { ok, data } = await UserService.changePassword(
      form.current,
      form.password,
    );
    setSaving(false);
    if (!ok || !data) return;
    // Every older session was signed out by the change; this one carries on with the
    // tokens the database just issued.
    saveAuthToken(data);
    Toast.success("Password changed");
    setForm(empty);
    setSubmitted(false);
  };

  return (
    <form className="flex max-w-2xl flex-col gap-5" onSubmit={submit} noValidate>
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Change password</h1>
        <p className="text-sm text-zinc-500">
          You stay signed in here. Any other device or browser signed in to
          your account is signed out.
        </p>
      </div>
      <Card title="Password">
        <div className="flex flex-col gap-4">
          <Field label="Current password" error={currentError}>
            <TextInput
              type="password"
              autoComplete="current-password"
              value={form.current}
              invalid={!!currentError}
              onChange={(ev) => setForm({ ...form, current: ev.target.value })}
            />
          </Field>
          <PasswordFields
            password={form.password}
            confirm={form.confirm}
            onChange={({ password, confirm }) =>
              setForm({ ...form, password, confirm })}
            showErrors={submitted}
            labels={{ password: "New password", confirm: "Confirm new password" }}
          />
          {sameError && <p className="text-xs text-red-600">{sameError}</p>}
        </div>
        <div className="mt-5 flex justify-end">
          <button type="submit" className={primaryButton} disabled={saving}>
            {saving && <ActivityIndicator active className="size-4" />}
            Change password
          </button>
        </div>
      </Card>
    </form>
  );
}
