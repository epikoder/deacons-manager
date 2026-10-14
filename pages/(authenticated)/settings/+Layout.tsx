import { Fragment, ReactNode } from "react";
import { Link } from "../../../src/components/Link";
import { usePageContext } from "vike-react/usePageContext";

export default function ({ children }: { children: ReactNode }) {
    const context = usePageContext();
    return (
        <Fragment>
            <div className="px-6 py-3 border-b border-zinc-200 bg-white text-sm font-medium h-12">
                <a href="/settings">
                    Settings
                </a>
            </div>
            <div className="flex flex-col md:flex-row h-[calc(100vh-14px)]">
                <div className="md:w-52 flex flex-col border-r border-zinc-200 bg-white p-2 gap-1">
                    <Link href="/settings/profile">
                        Profile
                    </Link>
                    {context.config.user!.role === "admin" &&
                        (
                            <Link href="/settings/book-cost">
                                Book Cost
                            </Link>
                        )}
                    <Link href="/settings/sources">
                        Sources
                    </Link>
                </div>
                <div className="h-full w-full overflow-y-auto">
                    {children}
                </div>
            </div>
        </Fragment>
    );
}
