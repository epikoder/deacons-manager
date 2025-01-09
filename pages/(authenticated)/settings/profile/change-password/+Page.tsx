import { ChangeEvent, useRef, useState } from "react";
import Input from "../../../../../src/components/Input";
import { usePageContext } from "vike-react/usePageContext";
import { postgrest } from "../../../../../src/utils/postgrest";
import Button from "../../../../../src/components/Button";

export default function () {
    const [form, setFormState] = useState({
        password: "",
        new_password: "",
        confirm_password: "",
    });
    const ref = useRef<HTMLFormElement>(null);
    const [message, setMessage] = useState<string | null>(null);
    const context = usePageContext();

    const onSubmit = async () => {
        const isValid = ref.current?.checkValidity();
        if (!isValid) return;

       
    };

    const _setFormState = (ev: ChangeEvent<HTMLInputElement>) =>
        setFormState({ ...form, [ev.target.name]: ev.target.value });

    return (
        <div className="max-w-screen-sm">
            <form
                className="flex flex-col gap-4"
                onSubmit={(ev) => {
                    ev.preventDefault();
                    onSubmit();
                }}
            >
                <Input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    placeholder="current password"
                    onChange={_setFormState}
                />
                <Input
                    type="password"
                    name="new_password"
                    autoComplete="new-password"
                    placeholder="new password"
                    onChange={_setFormState}
                />
                <Input
                    type="password"
                    name="confirm_password"
                    autoComplete="new-password"
                    placeholder="confirm password"
                    onChange={_setFormState}
                />
                <Button className="bg-green-500">
                    Change Password
                </Button>
            </form>
        </div>
    );
}
