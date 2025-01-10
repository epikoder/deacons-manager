import { Fragment, ReactNode } from "react";
import { Link } from "../../../src/components/Link";
import { usePageContext } from "vike-react/usePageContext";

export default function ({ children }: { children: ReactNode }) {
    const context = usePageContext();
    return (
        <Fragment>
            <div className="p-3 border-b-2 text-sm h-12">
                <a href="/settings">
                    Settings
                </a>
            </div>
            <div className="flex flex-col md:flex-row h-[calc(100vh-14px)]">
                <div className="md:w-52 flex flex-col border-r-2 p-2 gap-2">
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
                <div className="h-full w-full overflow-scroll px-4 p-0">
                    {children}
                </div>
            </div>
        </Fragment>
    );
}
