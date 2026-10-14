import { FormEvent, useState } from "react";
import { navigate } from "vike/client/router";
import StateComponent from "../../../../src/components/State.component";
import { postgrest, WithAuth } from "../../../../src/utils/postgrest";
import { PG_DUPLICATE } from "../../../../src/utils/constants";
import { canonicalPhone } from "../../../../src/utils/phone";
import Toast, { escapeHtml } from "../../../../src/utils/toast";
import {
  emailError,
  Field,
  TextInput,
} from "../../../../src/components/UserFields";
import {
  Card,
  PageBody,
  PageHeader,
  primaryButton,
  secondaryButton,
  selectClass,
} from "../../../../src/components/ui";
import { ActivityIndicator } from "../../../../src/components/Icons";

export default function () {
  const [form, setForm] = useState({
    fullname: "",
    phone: "",
    email: "",
    state: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phoneTaken, setPhoneTaken] = useState(false);

  const errors = {
    fullname: !form.fullname.trim() ? "Name is required" : null,
    phone: phoneTaken
      ? "An agent with this phone number already exists"
      : !form.phone.trim()
      ? "Phone is required"
      : canonicalPhone(form.phone) === null
      ? "Enter a valid phone number, e.g. 0803 123 4567"
      : null,
    email: form.email.trim() ? emailError(form.email) : null,
    state: !form.state ? "Choose a state" : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (k: keyof typeof errors) =>
    (submitted || (k === "phone" && phoneTaken)) ? errors[k] : null;

  // The form used to call checkVisibility() where it meant checkValidity(), so a
  // blank form went straight to the database.
  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setSubmitted(true);
    if (!valid || saving) return;
    setSaving(true);
    const { data, error } = await new WithAuth(
      postgrest.from("agents").insert({
        fullname: form.fullname.trim(),
        phone: canonicalPhone(form.phone)!,
        email: form.email.trim() || null,
        state: form.state,
      }).select("id").single(),
    ).unwrap();
    setSaving(false);
    if (error) {
      if (error.code == PG_DUPLICATE) return setPhoneTaken(true);
      Toast.error(`Couldn't create agent: ${escapeHtml(error.message ?? "")}`);
      return;
    }
    Toast.success("Agent created");
    navigate(`/agents/profile/${(data as { id: string }).id}`);
  };

  return (
    <PageBody width="max-w-3xl">
      <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
        <PageHeader
          title="New agent"
          subtitle="Agents deliver orders and hold book stock."
          back={{ href: "/agents", label: "Agents" }}
        />
        <Card title="Details">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Full name" error={show("fullname")}>
                <TextInput
                  autoFocus
                  value={form.fullname}
                  invalid={!!show("fullname")}
                  onChange={(ev) =>
                    setForm({ ...form, fullname: ev.target.value })}
                />
              </Field>
            </div>
            <Field
              label="Phone"
              error={show("phone")}
              hint="Any format; it's saved as 0XXXXXXXXXX."
            >
              <TextInput
                type="tel"
                value={form.phone}
                invalid={!!show("phone")}
                onChange={(ev) => {
                  setPhoneTaken(false);
                  setForm({ ...form, phone: ev.target.value });
                }}
              />
            </Field>
            <Field label="Email (optional)" error={show("email")}>
              <TextInput
                type="email"
                value={form.email}
                invalid={!!show("email")}
                onChange={(ev) => setForm({ ...form, email: ev.target.value })}
              />
            </Field>
            <Field label="State" error={show("state")}>
              <StateComponent
                defaultValue={undefined}
                value={form.state}
                className={`${selectClass} w-full py-2 ${
                  show("state") ? "!border-red-500" : ""
                }`}
                onChange={(ev) =>
                  setForm({ ...form, state: ev.currentTarget.value })}
              />
            </Field>
          </div>
        </Card>
        <div className="flex justify-end gap-2">
          <a href="/agents" className={secondaryButton}>Cancel</a>
          <button type="submit" className={primaryButton} disabled={saving}>
            {saving && <ActivityIndicator active className="size-4" />}
            Create agent
          </button>
        </div>
      </form>
    </PageBody>
  );
}
