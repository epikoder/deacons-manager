export { canonicalPhone, isValidNigerianPhone, normalizePhoneQuery };

import { parsePhoneNumberFromString } from "libphonenumber-js/max";

/**
 * Reduce whatever the admin typed to the digits stored in orders.phone_digits.
 *
 * That column holds the last ten digits of the number, which is the one thing every
 * way of writing it has in common, so a single search box matches regardless of
 * format: 0906722, 906722, +234906722..., 234906722... all become 906722.
 */
const normalizePhoneQuery = (input: string): string => {
  let d = (input ?? "").replace(/\D/g, "");
  if (d.startsWith("234")) {
    d = d.slice(3);
  } else if (d.startsWith("0")) {
    d = d.replace(/^0+/, "");
  }
  return d;
};

/**
 * Canonical storage form: 0XXXXXXXXXX for Nigeria, E.164 for anywhere else.
 *
 * Mirrors public.normalize_phone() in the database, but validates against the real
 * numbering plan rather than only reshaping - so a form can refuse a bad number
 * instead of storing something that merely looks plausible.
 *
 * Returns null when the number is not valid; callers should surface that rather than
 * guess a correction.
 */
const canonicalPhone = (input?: string | null): string | null => {
  if (!input || input.trim() === "") return null;
  const parsed = parsePhoneNumberFromString(input.trim(), "NG");
  if (!parsed || !parsed.isValid()) return null;
  return parsed.country === "NG" ? `0${parsed.nationalNumber}` : parsed.number;
};

const isValidNigerianPhone = (input?: string | null): boolean =>
  canonicalPhone(input) !== null;
