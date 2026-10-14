import { useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import UserService, {
  AppUser,
  displayName,
} from "../../../src/services/users.service";
import {
  Avatar,
  formatDate,
  primaryButton,
  RemovedBadge,
  RoleBadge,
} from "../../../src/components/UserFields";
import { SearchIcon } from "../../../src/components/Icons";

type View = "active" | "removed";

export default function () {
  const me = usePageContext().config.user as User & { id?: string };
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<View>("active");
  const [query, setQuery] = useState("");

  useEffect(() => {
    UserService.list().then(({ ok, data }) => {
      setFailed(!ok);
      setUsers(data ?? []);
    });
  }, []);

  const counts = useMemo(() => ({
    active: users?.filter((u) => !u.deleted_at).length ?? 0,
    removed: users?.filter((u) => u.deleted_at).length ?? 0,
  }), [users]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? [])
      .filter((u) => (view === "removed") === !!u.deleted_at)
      .filter((u) =>
        !q ||
        displayName(u).toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      )
      // Admins first, then by name.
      .sort((a, b) =>
        (a.role === "admin" ? 0 : 1) - (b.role === "admin" ? 0 : 1) ||
        displayName(a).localeCompare(displayName(b))
      );
  }, [users, view, query]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Users</h1>
          <p className="text-sm text-zinc-500">
            People who can sign in to this dashboard.
          </p>
        </div>
        <a href="/users/create" className={primaryButton}>
          New user
        </a>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
          />
        </div>
        <div
          role="tablist"
          className="inline-flex w-fit rounded-lg border border-zinc-300 bg-white p-0.5 text-sm"
        >
          {(["active", "removed"] as View[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 font-medium capitalize transition-colors ${
                view === v
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {v}{" "}
              <span
                className={`tabular-nums ${
                  view === v ? "text-zinc-300" : "text-zinc-400"
                }`}
              >
                {users ? counts[v] : ""}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_96px_150px_110px] gap-4 border-b border-zinc-100 bg-zinc-50/60 px-5 py-2.5 text-xs font-medium text-zinc-500">
          <span>User</span>
          <span>Role</span>
          <span>Last signed in</span>
          <span>Added</span>
        </div>
        {!users && (
          <div className="divide-y divide-zinc-100">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-4">
                <span className="size-8 animate-pulse rounded-full bg-zinc-100" />
                <span className="h-4 w-48 animate-pulse rounded bg-zinc-100" />
              </div>
            ))}
          </div>
        )}
        {users && shown.length === 0 && (
          <div className="px-5 py-14 text-center text-sm text-zinc-500">
            {failed
              ? "Users couldn't be loaded."
              : query
              ? `No ${view} users match “${query}”.`
              : view === "removed"
              ? "No one has been removed."
              : "No users yet."}
          </div>
        )}
        <ul className="divide-y divide-zinc-100">
          {shown.map((u) => (
            <li key={u.id}>
              <a
                href={`/users/${u.id}`}
                className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_96px_150px_110px] items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors hover:bg-zinc-50"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar user={u} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium text-zinc-900">
                        {displayName(u)}
                      </span>
                      {u.id === me?.id && (
                        <span className="text-[11px] font-medium text-zinc-400">
                          You
                        </span>
                      )}
                      {u.deleted_at && <RemovedBadge />}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">
                      {u.email}
                    </span>
                  </span>
                </span>
                <span className="pl-11 sm:pl-0">
                  <RoleBadge role={u.role} />
                </span>
                <span className="hidden sm:block text-xs text-zinc-600">
                  {u.last_seen_at ? formatDate(u.last_seen_at, true) : "Never"}
                </span>
                <span className="hidden sm:block text-xs text-zinc-600">
                  {formatDate(u.created_at)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
