import { Fragment, ReactNode } from "react";
import { Link } from "../../../components/Link";

export default function ({ children }: { children: ReactNode }) {
    return (
        <Fragment>
            <div className="p-3 border-b-2 text-sm h-12">
                <a href="/profile">
                    Profile
                </a>
            </div>
            <div className="flex flex-col md:flex-row h-[calc(100vh-14px)]">
                <div className="md:w-52 flex flex-col border-r-2 p-2">
                    <Link href="/profile/change-password">
                        Change Password
                    </Link>
                </div>
                <div className="h-full w-full overflow-scroll px-4 py-8">
                    {children}
                </div>
            </div>
        </Fragment>
    );
}
