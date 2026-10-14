import { postgrest, WithAuth } from "../utils/postgrest";
import Toast, { escapeHtml } from "../utils/toast";

export type UserRole = "authenticated" | "admin";

/** One row of public.list_users(). */
export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  fname: string | null;
  lname: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  last_seen_at: string | null;
}

export interface UserInput {
  fname: string;
  lname: string;
  email: string;
  role: UserRole;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  authenticated: "Staff",
};

export const ROLE_HINT: Record<UserRole, string> = {
  admin: "Everything staff can do, plus users and book cost.",
  authenticated: "Orders, agents and affiliates.",
};

export const MIN_PASSWORD = 8;

export const displayName = (u: Pick<AppUser, "fname" | "lname" | "email">) =>
  [u.fname, u.lname].filter(Boolean).join(" ") || u.email.split("@")[0];

/**
 * Every call resolves to `{ ok, data }` and has already toasted on failure. The
 * database is the authority on the rules (duplicate email, last admin, own account),
 * so its message is the one worth showing.
 */
async function call<T>(
  query: PromiseLike<any>,
  failure: string,
): Promise<{ ok: boolean; data?: T }> {
  const { data, error } = await new WithAuth(query as any).unwrap();
  if (error) {
    console.error(failure, error);
    Toast.error(`${failure}: ${escapeHtml(error.message ?? "")}`);
    return { ok: false };
  }
  return { ok: true, data: data as T };
}

const UserService = {
  list() {
    return call<AppUser[]>(
      postgrest.rpc("list_users").select("*").order("created_at", {
        ascending: false,
      }),
      "Couldn't load users",
    );
  },

  async get(id: string) {
    const res = await call<AppUser>(
      postgrest.rpc("list_users").eq("id", id).select("*").maybeSingle(),
      "Couldn't load user",
    );
    return res.data ?? null;
  },

  create(input: UserInput & { password: string }) {
    return call<string>(
      postgrest.rpc("create_user", { ...input }),
      "Couldn't create user",
    );
  },

  update(id: string, input: UserInput) {
    return call<void>(
      postgrest.rpc("update_user", { user_id: id, ...input }),
      "Couldn't save changes",
    );
  },

  resetPassword(id: string, password: string) {
    return call<void>(
      postgrest.rpc("reset_user_password", { user_id: id, password }),
      "Couldn't reset password",
    );
  },

  remove(id: string) {
    return call<void>(
      postgrest.rpc("delete_user", { user_id: id }),
      "Couldn't remove user",
    );
  },

  /** Your own password. Resolves to a fresh token pair for this session. */
  changePassword(current_password: string, new_password: string) {
    return call<{ access_token: string; refresh_token: string }>(
      postgrest.rpc("change_password", { current_password, new_password }),
      "Couldn't change password",
    );
  },

  restore(id: string) {
    return call<void>(
      postgrest.rpc("restore_user", { user_id: id }),
      "Couldn't restore user",
    );
  },
};

export default UserService;
