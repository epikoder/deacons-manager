import { FormEvent, useState } from "react";
import { navigate } from "vike/client/router";
import UserService, { UserRole } from "../../../../src/services/users.service";
import {
  Card,
  emailError,
  Field,
  PasswordFields,
  passwordError,
  primaryButton,
  RoleSelect,
  secondaryButton,
  TextInput,
} from "../../../../src/components/UserFields";
import { ActivityIndicator } from "../../../../src/components/Icons";
import Toast from "../../../../src/utils/toast";

export default function () {
  const [form, setForm] = useState({
    fname: "",
    lname: "",
    email: "",
    role: "authenticated" as UserRole,
  });
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const errors = {
    fname: !form.fname.trim() ? "First name is required" : null,
    email: emailError(form.email),
    password: passwordError(pw.password, pw.confirm),
  };
  const valid = !errors.fname && !errors.email && !errors.password;

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setSubmitted(true);
    if (!valid || saving) return;
    setSaving(true);
    const { ok, data: id } = await UserService.create({
      ...form,
      email: form.email.trim(),
      password: pw.password,
    });
    setSaving(false);
    if (!ok || !id) return;
    Toast.success("User created");
    navigate(`/users/${id}`);
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
      <div>
        <a href="/users" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← Users
        </a>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900">New user</h1>
        <p className="text-sm text-zinc-500">
          They sign in with this email and password. Share the password with
          them directly.
        </p>
      </div>

      <Card title="Details">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label="First name"
            error={submitted ? errors.fname : null}
          >
            <TextInput
              autoFocus
              autoComplete="off"
              value={form.fname}
              invalid={submitted && !!errors.fname}
              onChange={(ev) => setForm({ ...form, fname: ev.target.value })}
            />
          </Field>
          <Field label="Last name">
            <TextInput
              autoComplete="off"
              value={form.lname}
              onChange={(ev) => setForm({ ...form, lname: ev.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Email" error={submitted ? errors.email : null}>
              <TextInput
                type="email"
                autoComplete="off"
                value={form.email}
                invalid={submitted && !!errors.email}
                onChange={(ev) => setForm({ ...form, email: ev.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <RoleSelect
              value={form.role}
              onChange={(role) => setForm({ ...form, role })}
            />
          </div>
        </div>
      </Card>

      <Card title="Password">
        <PasswordFields
          password={pw.password}
          confirm={pw.confirm}
          onChange={setPw}
          showErrors={submitted}
        />
      </Card>

      <div className="flex justify-end gap-2">
        <a href="/users" className={secondaryButton}>Cancel</a>
        <button type="submit" className={primaryButton} disabled={saving}>
          {saving && <ActivityIndicator active className="size-4" />}
          Create user
        </button>
      </div>
    </form>
  );
}
