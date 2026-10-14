import { FormEvent, useRef, useState } from "react";
import { navigate } from "vike/client/router";
import { postgrest, WithAuth } from "../../../../src/utils/postgrest";
import { PG_DUPLICATE } from "../../../../src/utils/constants";
import { SourceSelector } from "../../../../src/components/Select";
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
} from "../../../../src/components/ui";
import { ActivityIndicator } from "../../../../src/components/Icons";

export default function () {
  const selectorRef = useRef<{ getSelectedItems: () => Set<string> }>(null);
  const [form, setForm] = useState({ fullname: "", phone: "", email: "" });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState(false);

  const errors = {
    fullname: !form.fullname.trim() ? "Name is required" : null,
    phone: !form.phone.trim()
      ? "Phone is required"
      : canonicalPhone(form.phone) === null
      ? "Enter a valid phone number, e.g. 0803 123 4567"
      : null,
    email: form.email.trim() ? emailError(form.email) : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (k: keyof typeof errors) => submitted ? errors[k] : null;

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setSubmitted(true);
    setDuplicate(false);
    if (!valid || saving) return;
    setSaving(true);
    const { data, error } = await new WithAuth(
      postgrest.from("affiliates").insert({
        fullname: form.fullname.trim(),
        phone: canonicalPhone(form.phone)!,
        email: form.email.trim() || null,
        source_list: [...(selectorRef.current?.getSelectedItems() ?? [])],
      }).select("id").single(),
    ).unwrap();
    setSaving(false);
    if (error) {
      // This used to say "Agent with Phone already exist".
      if (error.code == PG_DUPLICATE) return setDuplicate(true);
      Toast.error(
        `Couldn't create affiliate: ${escapeHtml(error.message ?? "")}`,
      );
      return;
    }
    Toast.success("Affiliate created");
    navigate(`/affiliates/profile/${(data as { id: string }).id}`);
  };

  return (
    <PageBody width="max-w-3xl">
      <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
        <PageHeader
          title="New affiliate"
          subtitle="Affiliates own one or more order sources and earn on their deliveries."
          back={{ href: "/affiliates", label: "Affiliates" }}
        />
        {duplicate && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            An affiliate with these details already exists.
          </div>
        )}
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
                onChange={(ev) => setForm({ ...form, phone: ev.target.value })}
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
          </div>
        </Card>
        <Card
          title="Order sources"
          description="The sites whose orders count for this affiliate. Greyed-out sources already belong to someone else."
        >
          <SourceSelector ref={selectorRef} />
        </Card>
        <div className="flex justify-end gap-2">
          <a href="/affiliates" className={secondaryButton}>Cancel</a>
          <button type="submit" className={primaryButton} disabled={saving}>
            {saving && <ActivityIndicator active className="size-4" />}
            Create affiliate
          </button>
        </div>
      </form>
    </PageBody>
  );
}
