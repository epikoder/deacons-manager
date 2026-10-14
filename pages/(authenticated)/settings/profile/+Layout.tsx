import { Fragment, ReactNode } from "react";
import { Link } from "../../../../src/components/Link";

export default function ({ children }: { children: ReactNode }) {
    return (
        <Fragment>
            <div className="flex flex-col md:flex-row h-[calc(100vh-14px)]">
                <div className="md:w-52 flex flex-col border-r border-zinc-200 p-2 gap-1">
                    <Link href="/settings/profile" exact>
                        Info
                    </Link>
                    <Link href="/settings/profile/change-password">
                        Change Password
                    </Link>
                </div>
                <div className="h-full w-full overflow-y-auto px-6 py-6">
                    {children}
                </div>
            </div>
        </Fragment>
    );
}
