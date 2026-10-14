import { ReactNode } from "react";
import { usePageContext } from "vike-react/usePageContext";

/**
 * Every users RPC is executable by admins only, so a staff account that reaches these
 * pages by URL would just see errors. Say so instead.
 */
export default function ({ children }: { children: ReactNode }) {
  const context = usePageContext();
  const isAdmin = context.config.user?.role === "admin";

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-6 py-6">
        {isAdmin ? children : (
          <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
            <h1 className="text-base font-semibold text-zinc-900">
              Admins only
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Ask an admin if you need an account added or changed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
