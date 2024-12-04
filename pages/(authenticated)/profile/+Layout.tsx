import { ReactNode } from "react";
import { Link } from "../../../components/Link";

export default function ({ children }: { children: ReactNode }) {
    return <div className="flex flex-col md:flex-row">
        <div className="md:w-52 flex flex-col">
            <Link href="/profile/change-password">
                Change Password
            </Link>
        </div>
        {children}
    </div>
}