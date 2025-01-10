import { usePageContext } from "vike-react/usePageContext";
import Input from "../../../../src/components/Input";
import Button from "../../../../src/components/Button";
import { postgrest, WithAuth } from "../../../../src/utils/postgrest";
import { useRef, useState } from "react";
import { ActivityIndicator } from "../../../../src/components/Icons";

export default function () {
    const context = usePageContext();
    const ref = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);

    return (
        <div className="flex flex-col gap-3 text-sm py-4">
            <p>Add User</p>
            <Input
                ref={ref}
                sx="col-span-5 w-full"
                placeholder="fullname"
            />
            <Input
                ref={ref}
                sx="col-span-5 w-full"
                placeholder="email"
            />
            <Input
                ref={ref}
                sx="col-span-5 w-full"
                placeholder="password"
                type="password"
                autoComplete="new-password"
            />
            <Input
                ref={ref}
                sx="col-span-5 w-full"
                placeholder="confirm_password"
                type="password"
                autoComplete="new-password"
            />

            <Button className="bg-green-500">
                <span>Create</span>
                {loading && <ActivityIndicator active />}
            </Button>
        </div>
    );
}
