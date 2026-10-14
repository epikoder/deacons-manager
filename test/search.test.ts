import { describe, expect, test } from "bun:test";
import {
  isOrderPattern,
  orderPatternRange,
  parseSearchPrefix,
  searchClauses,
  suggestScopes,
} from "../src/services/orders.service/search";

describe("parseSearchPrefix", () => {
  test.each([
    ["order number: 1727", "order", "1727"],
    ["Order Number:1727", "order", "1727"],
    ["order no: 1727", "order", "1727"],
    ["order no.: 1727", "order", "1727"],
    ["order #: 1727", "order", "1727"],
    ["order: 1727", "order", "1727"],
    ["#1727", "order", "1727"],
    ["name: Ada Obi", "name", "Ada Obi"],
    ["customer name: Ada", "name", "Ada"],
    ["customer: Ada", "name", "Ada"],
    ["phone: 0803 123", "phone", "0803 123"],
    ["tel:0803", "phone", "0803"],
    ["order number: ", "order", ""],
  ])("%p", (input, scope, text) => {
    expect(parseSearchPrefix(input)).toEqual({ scope, text } as any);
  });

  test.each(["1727", "Ada Obi", "#", "order 1727", "ordering: x", "0803"])(
    "no prefix in %p",
    (input) => expect(parseSearchPrefix(input)).toBeNull(),
  );
});

describe("suggestScopes", () => {
  test("digits can be an order number or a phone", () => {
    expect(suggestScopes("0803123")).toEqual(["all", "order", "phone"]);
  });
  test("a short number is not offered as a phone", () => {
    expect(suggestScopes("17")).toEqual(["all", "order"]);
  });
  test("a name with a space is only a name", () => {
    expect(suggestScopes("Ada Obi")).toEqual(["all", "name"]);
  });
  test("an alphanumeric id", () => {
    expect(suggestScopes("E1")).toEqual(["all", "order", "name"]);
  });
  test("a 1xx pattern is offered as an order number only", () => {
    expect(suggestScopes("1xx")).toEqual(["all", "order"]);
  });
  test("nothing for empty text", () => {
    expect(suggestScopes("  ")).toEqual([]);
  });
});

describe("searchClauses", () => {
  test("order number is an exact, case-insensitive match", () => {
    expect(searchClauses({ scope: "order", text: " 1727 " })).toEqual([
      'id.ilike."1727"',
    ]);
  });
  test("order number never becomes a wildcard", () => {
    expect(searchClauses({ scope: "order", text: "17%_" })).toEqual([
      'id.eq."17%_"',
    ]);
  });
  test("name is a substring match", () => {
    expect(searchClauses({ scope: "name", text: "Ada Obi" })).toEqual([
      'fullname.ilike."*Ada Obi*"',
    ]);
  });
  test("phone uses the normalised digits", () => {
    expect(searchClauses({ scope: "phone", text: "+234 803 1" })).toEqual([
      'phone_digits.like."*8031*"',
    ]);
  });
  test("a scoped search with nothing usable matches nothing", () => {
    expect(searchClauses({ scope: "phone", text: "0" })).toEqual([]);
    expect(searchClauses({ scope: "order", text: "  " })).toEqual([]);
  });
  test("PostgREST grammar characters are stripped", () => {
    expect(searchClauses({ scope: "name", text: 'a,b(c)"d' })).toEqual([
      'fullname.ilike."*a b c d*"',
    ]);
  });
  test("all fields: phone, name and order number", () => {
    expect(searchClauses({ scope: "all", text: "1727" })).toEqual([
      'phone_digits.like."*1727*"',
      'fullname.ilike."*1727*"',
      'id.ilike."*1727*"',
    ]);
  });
  test("all fields: a short number still matches order numbers containing it", () => {
    expect(searchClauses({ scope: "all", text: "67" })).toEqual([
      'fullname.ilike."*67*"',
      'id.ilike."*67*"',
    ]);
    expect(searchClauses({ scope: "all", text: "6" })).toEqual([
      'id.ilike."*6*"',
    ]);
  });
  test("1xx is the range 100-199, with or without the chip", () => {
    expect(searchClauses({ scope: "order", text: "1xx" })).toEqual([
      'id.match."^1[0-9][0-9]$"',
    ]);
    expect(searchClauses({ scope: "all", text: "1XX" })).toContain(
      'id.match."^1[0-9][0-9]$"',
    );
  });
});

describe("order number patterns", () => {
  test.each([["1xx", true], ["17x", true], ["xx5", true], ["x", true], [
    "123",
    false,
  ], ["E1", false], ["1xa", false], ["box", false]])("%p", (t, yes) => {
    expect(isOrderPattern(t as string)).toBe(yes as boolean);
  });
  test("range text", () => {
    expect(orderPatternRange("1xx")).toBe("100–199");
    expect(orderPatternRange("17x")).toBe("170–179");
    expect(orderPatternRange("xx5")).toBe("3-digit numbers ending 5");
    expect(orderPatternRange("123")).toBeNull();
  });
});
