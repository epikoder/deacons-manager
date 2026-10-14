import { normalizePhoneQuery } from "../../utils/phone";

/** Where an order search looks. "all" is the original behaviour. */
export type SearchScope = "all" | "order" | "name" | "phone";

export interface OrderSearch {
  scope: SearchScope;
  text: string;
}

export const SCOPE_LABEL: Record<SearchScope, string> = {
  all: "All fields",
  order: "Order number",
  name: "Customer name",
  phone: "Phone",
};

// Typed shortcuts, checked longest first so "order number:" wins over "order:".
// "#1727" needs no colon: it is how order numbers are written on the cards.
const PREFIXES: [RegExp, SearchScope][] = [
  [/^\s*order\s*(?:number|no\.?|num|#)\s*:\s*/i, "order"],
  [/^\s*order\s*:\s*/i, "order"],
  [/^\s*#(?=\S)/, "order"],
  [/^\s*(?:customer\s*)?name\s*:\s*/i, "name"],
  [/^\s*customer\s*:\s*/i, "name"],
  [/^\s*(?:phone|tel|mobile)\s*:\s*/i, "phone"],
];

/**
 * Pull a scope prefix off what was typed: "order number: 1727" -> order / "1727".
 * Returns null when there is no prefix, so the text stays an all-fields search.
 */
export function parseSearchPrefix(input: string): OrderSearch | null {
  for (const [re, scope] of PREFIXES) {
    const m = input.match(re);
    if (m) return { scope, text: input.slice(m[0].length) };
  }
  return null;
}

/**
 * "1xx" style order-number patterns: digits, with x standing for any one digit.
 * Plain digits are not a pattern.
 */
export const isOrderPattern = (text: string) =>
  /^[0-9xX]+$/.test(text.trim()) && /[xX]/.test(text);

/** The range a pattern covers, for display: "1xx" -> "100–199". */
export function orderPatternRange(text: string): string | null {
  const t = text.trim();
  if (!isOrderPattern(t)) return null;
  const low = t.replace(/[xX]/g, "0");
  const high = t.replace(/[xX]/g, "9");
  // A leading x ("x5") is not a contiguous range; describe it instead.
  return /^[xX]/.test(t)
    ? `${t.length}-digit numbers ending ${t.replace(/^[xX]+/, "")}`
    : `${low}–${high}`;
}

const patternRegex = (text: string) =>
  `^${text.trim().replace(/[xX]/g, "[0-9]")}$`;

/** Which narrowing options make sense for this text, in display order. */
export function suggestScopes(text: string): SearchScope[] {
  const t = text.trim();
  if (!t) return [];
  const out: SearchScope[] = ["all"];
  if (/^[A-Za-z0-9-]+$/.test(t)) out.push("order");
  // "1xx" has letters but is an order-number pattern, not a name.
  if (/\p{L}/u.test(t) && !isOrderPattern(t)) out.push("name");
  if (/^[+\d\s().-]+$/.test(t) && normalizePhoneQuery(t).length >= 3) {
    out.push("phone");
  }
  return out;
}

// Part of PostgREST's or() grammar; in a value they make a malformed filter, not an
// empty result. Values are double-quoted too, so spaces and full stops are safe.
const clean = (s: string) =>
  s.replace(/[(),"\\*]/g, " ").replace(/\s+/g, " ").trim();

/**
 * The PostgREST or() clauses for a search. An empty array means "nothing can match"
 * (a phone search with no digits, say): the caller must return no rows, not every row.
 */
export function searchClauses({ scope, text: raw }: OrderSearch): string[] {
  const text = clean(raw);
  const digits = normalizePhoneQuery(raw);
  switch (scope) {
    case "order":
      if (!text) return [];
      // "1xx": x is any digit, so 100-199. A regex rather than LIKE's _, which
      // would also match letters ("1AB").
      if (isOrderPattern(text)) return [`id.match."${patternRegex(text)}"`];
      // Otherwise exact, ignoring case ("e1" finds "E1"). ilike with no wildcard is
      // an exact match; the character check keeps % and _ from acting as wildcards.
      return /^[A-Za-z0-9-]+$/.test(text)
        ? [`id.ilike."${text}"`]
        : [`id.eq."${text}"`];
    case "name":
      return text ? [`fullname.ilike."*${text}*"`] : [];
    case "phone":
      return digits ? [`phone_digits.like."*${digits}*"`] : [];
    case "all": {
      const clauses: string[] = [];
      // Three digits is where a phone match stops being every row in the table.
      if (digits.length >= 3) clauses.push(`phone_digits.like."*${digits}*"`);
      if (text.length >= 2) clauses.push(`fullname.ilike."*${text}*"`);
      // Order numbers contain the text at any length: "67" finds #67, #767 and
      // #1067. (Under three characters this used to be exact-only, so a short
      // search found nothing unless that exact order existed.) A "1xx" pattern
      // means the range, as it does with the Order number chip.
      if (isOrderPattern(text)) {
        clauses.push(`id.match."${patternRegex(text)}"`);
      } else if (text.length >= 1) {
        clauses.push(`id.ilike."*${text}*"`);
      }
      return clauses;
    }
  }
}
