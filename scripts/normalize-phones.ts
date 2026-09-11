/**
 * One-off backfill: rewrite existing phone numbers into canonical form.
 *
 *   bun run scripts/normalize-phones.ts                    # dry run (default)
 *   bun run scripts/normalize-phones.ts --apply
 *   bun run scripts/normalize-phones.ts --table agents --apply --merge-agents
 *
 * Canonical form is 0XXXXXXXXXX for Nigeria and E.164 (+...) for anywhere else, which
 * is what the normalize_phone trigger writes for every row created from now on. This
 * only exists to bring the rows that predate that trigger into line.
 *
 * Deliberately runtime agnostic - process.env, no bun-only APIs - so it runs under bun
 * on the server and under `node --experimental-strip-types` locally. A script that
 * rewrites production data should be runnable wherever it can be tested.
 *
 * Validation is libphonenumber-js/max (Google's metadata, full numbering plan), not a
 * prefix list: new NCC ranges must not require a code change. Anything it rejects is
 * left exactly as it is and reported - a malformed number turned into a plausible wrong
 * one is worse than an obviously unhandled one.
 */
import postgres from "postgres";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { writeFileSync } from "node:fs";

type TableName = "orders" | "agents" | "affiliates";

type Row = { pk: string; phone: string | null; created_at?: string };

type Outcome =
    | { kind: "unchanged" }
    | { kind: "normalised"; value: string; discarded?: string }
    | { kind: "rejected"; reason: string };

const TABLES: Record<TableName, { pk: string; unique: boolean }> = {
    orders: { pk: "_id", unique: false },
    agents: { pk: "id", unique: true },
    affiliates: { pk: "id", unique: false },
};

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const valueOf = (f: string) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : undefined;
};

if (has("-h") || has("--help")) {
    console.log(
        [
            "usage: normalize-phones.ts [--table orders|agents|affiliates] [--apply] [--merge-agents]",
            "",
            "  --table         default: orders",
            "  --apply         write changes (default is a dry run that writes nothing)",
            "  --merge-agents  merge agents whose numbers collide once normalised",
        ].join("\n"),
    );
    process.exit(0);
}

const table = (valueOf("--table") ?? "orders") as TableName;
const apply = has("--apply");
const mergeAgents = has("--merge-agents");

if (!(table in TABLES)) {
    console.error(`error: unknown table '${table}'`);
    process.exit(2);
}

const url = process.env.DATABASE_URL;
if (!url) {
    console.error("error: DATABASE_URL is not set");
    process.exit(2);
}

/**
 * Canonicalise one stored value.
 *
 * Multi-number fields ("0803 123 4567 / 0812 345 6789") should not exist, but where they
 * do the first entry is taken and the rest reported. If that first entry does not
 * validate the whole value is left alone rather than falling through to the second -
 * silently adopting a different number is the one failure mode worth ruling out.
 */
function canonicalise(raw: string | null): Outcome {
    if (raw === null || raw.trim() === "") return { kind: "unchanged" };

    const parts = raw.split(/[,/;]/).map((p) => p.trim()).filter(Boolean);
    const first = parts[0] ?? raw.trim();
    const discarded = parts.length > 1 ? parts.slice(1).join(" / ") : undefined;

    const parsed = parsePhoneNumberFromString(first, "NG");
    if (!parsed || !parsed.isValid()) {
        return { kind: "rejected", reason: parts.length > 1 ? "first of several did not validate" : "not a valid number" };
    }
    const value = parsed.country === "NG" ? `0${parsed.nationalNumber}` : parsed.number;
    return value === raw ? { kind: "unchanged" } : { kind: "normalised", value, discarded };
}

const sql = postgres(url, { onnotice: () => {} });

async function main() {
    const { pk, unique } = TABLES[table];
    const rows = (await sql`
        SELECT ${sql(pk)}::text AS pk, phone, created_at
        FROM ${sql(table)}
        ORDER BY created_at NULLS LAST
    `) as unknown as Row[];

    const changes: { pk: string; before: string | null; after: string; discarded?: string }[] = [];
    const rejected: { pk: string; phone: string; reason: string }[] = [];

    for (const r of rows) {
        const out = canonicalise(r.phone);
        if (out.kind === "normalised") {
            changes.push({ pk: r.pk, before: r.phone, after: out.value, discarded: out.discarded });
        } else if (out.kind === "rejected") {
            rejected.push({ pk: r.pk, phone: r.phone!, reason: out.reason });
        }
    }

    // A unique phone column turns two spellings of one number into a constraint violation
    // the moment they converge. Find that before writing, not halfway through.
    const collisions = new Map<string, string[]>();
    if (unique) {
        const finalValue = new Map<string, string>();
        for (const r of rows) if (r.phone) finalValue.set(r.pk, r.phone);
        for (const c of changes) finalValue.set(c.pk, c.after);
        const byValue = new Map<string, string[]>();
        for (const [k, v] of finalValue) byValue.set(v, [...(byValue.get(v) ?? []), k]);
        for (const [v, pks] of byValue) if (pks.length > 1) collisions.set(v, pks);
    }

    console.log(`table          : ${table}`);
    console.log(`rows           : ${rows.length}`);
    console.log(`already canonical: ${rows.length - changes.length - rejected.length}`);
    console.log(`to normalise   : ${changes.length}`);
    console.log(`rejected       : ${rejected.length}`);
    if (unique) console.log(`collisions     : ${collisions.size}`);

    if (changes.length) {
        console.log("\nsample of changes:");
        for (const c of changes.slice(0, 10)) {
            console.log(`  ${c.before} -> ${c.after}${c.discarded ? `   [discarded: ${c.discarded}]` : ""}`);
        }
    }
    if (rejected.length) {
        console.log("\nleft untouched (fix by hand):");
        for (const r of rejected.slice(0, 10)) console.log(`  ${JSON.stringify(r.phone)}  (${r.reason})`);
        if (rejected.length > 10) console.log(`  ... and ${rejected.length - 10} more`);
    }
    if (collisions.size) {
        console.log("\ncollisions after normalising:");
        for (const [v, pks] of collisions) {
            // Format in SQL: created_at is a bare timestamp, so letting JS parse it and
            // call toISOString() shifts it by the local UTC offset and can show the
            // wrong day to whoever is deciding which record survives.
            const names = await sql`
                SELECT id::text, fullname, to_char(created_at, 'YYYY-MM-DD') AS created
                FROM ${sql(table)} WHERE id::text = ANY(${pks})`;
            const counts = await sql`SELECT agent_id::text AS id, count(*)::int AS n FROM orders WHERE agent_id::text = ANY(${pks}) GROUP BY 1`;
            const nOf = (id: string) => (counts as any[]).find((c) => c.id === id)?.n ?? 0;
            console.log(`  ${v}`);
            for (const n of names as any[]) {
                console.log(`    ${n.id}  ${n.fullname}  created ${n.created ?? "unknown"}  ${nOf(n.id)} orders`);
            }
        }
        if (table === "agents" && !mergeAgents) {
            console.log("\n  pass --merge-agents to merge these into the earliest record.");
        }
    }

    if (!apply) {
        console.log("\ndry run - nothing written. Re-run with --apply.");
        await sql.end();
        return;
    }

    if (collisions.size && !(table === "agents" && mergeAgents)) {
        console.error("\nerror: refusing to apply with unresolved collisions on a unique column.");
        await sql.end();
        process.exit(1);
    }

    // Reversible without a schema column: every before/after is on disk first.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backup = `phone-backfill-${table}-${stamp}.json`;
    writeFileSync(backup, JSON.stringify({ table, pk, changes, rejected }, null, 2));
    console.log(`\nbackup written: ${backup}`);

    if (table === "agents" && mergeAgents && collisions.size) {
        await mergeDuplicateAgents(collisions);
    }

    let done = 0;
    for (const c of changes) {
        // Skip rows removed by a merge.
        const still = await sql`SELECT 1 FROM ${sql(table)} WHERE ${sql(pk)}::text = ${c.pk}`;
        if (!still.length) continue;
        await sql`UPDATE ${sql(table)} SET phone = ${c.after} WHERE ${sql(pk)}::text = ${c.pk}`;
        done++;
    }
    console.log(`updated ${done} row(s).`);
    await sql.end();
}

/**
 * Two rows with the same number are the same member of staff entered twice.
 *
 * orders.agent_id is a foreign key and an agent carries stock and history, so the
 * duplicate cannot simply be deleted: orders move first, books are summed (each row held
 * real stock, and get_books_with_agent aggregates it), transactions concatenate. The
 * survivor is the earliest record.
 */
async function mergeDuplicateAgents(collisions: Map<string, string[]>) {
    for (const [phone, pks] of collisions) {
        await sql.begin(async (tx) => {
            const rows = await tx`
                SELECT id::text, fullname, email, state, books, transactions, created_at
                FROM agents WHERE id::text = ANY(${pks}) ORDER BY created_at NULLS LAST
            `;
            const [survivor, ...dupes] = rows as any[];
            if (!survivor || !dupes.length) return;

            const books: Record<string, number> = { ...(survivor.books ?? {}) };
            let transactions: any[] = [...(survivor.transactions ?? [])];

            for (const d of dupes) {
                for (const [k, v] of Object.entries(d.books ?? {})) {
                    books[k] = (books[k] ?? 0) + Number(v ?? 0);
                }
                transactions = transactions.concat(d.transactions ?? []);
                await tx`UPDATE orders SET agent_id = ${survivor.id}::uuid WHERE agent_id = ${d.id}::uuid`;
            }

            await tx`
                UPDATE agents SET
                    books = ${tx.json(books)},
                    transactions = ${transactions as any},
                    fullname = coalesce(nullif(btrim(${survivor.fullname}), ''), ${dupes[0].fullname}),
                    email = coalesce(nullif(btrim(coalesce(${survivor.email}, '')), ''), ${dupes[0].email}),
                    state = coalesce(nullif(btrim(${survivor.state}), ''), ${dupes[0].state}),
                    phone = ${phone}
                WHERE id = ${survivor.id}::uuid
            `;
            await tx`DELETE FROM agents WHERE id::text = ANY(${dupes.map((d: any) => d.id)})`;
            console.log(`  merged ${dupes.length} duplicate(s) into ${survivor.id} (${phone})`);
        });
    }
}

main().catch(async (e) => {
    console.error("failed:", e instanceof Error ? e.message : e);
    await sql.end();
    process.exit(1);
});
