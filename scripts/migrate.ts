import postgres from "postgres";
import { Subjects } from "../components/Select";

let dburi = Bun.env.DATABASE_URL!;
if (!dburi) throw new Error("DATABASE_URL missing");

let options: postgres.Options<{}> = {};
const regex =
    /^(?<scheme>[^:]+):\/\/(?<user>[^:]+):(?<password>[^@]+)@(?<hostname>[^\/]+)\/(?<dbname>.+)$/;

const match = dburi.match(regex);

if (match && match.groups) {
    const { user, password, hostname, dbname } = match.groups;
    options = {
        username: user,
        password,
        hostname,
        database: dbname,
    };
}

const sql = postgres(options);
const { columns, command, count, ...agents } =
    await sql`SELECT id,books from agents`;

let subs = Object.values(Subjects).filter((v) => v.includes("SSCE"));

for (const agent of Object.values(agents) as postgres.Row[]) {
    for (const book of subs) {
        let old = book.replace("SSCE", "").trim();
        if (old in agent.books) {
            let count = agent.books[old];
            delete agent.books[old];
            agent.books[book] = count;
        }
    }
    await sql`UPDATE agents SET books = ${agent.books} WHERE id = ${agent.id}`;
}

sql.end();
