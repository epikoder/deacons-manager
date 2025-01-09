import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import Input from "../../../../src/components/Input";
import { emailValidator } from "../../../../src/utils/validators";
import Button from "../../../../src/components/Button";
import { postgrest, WithAuth } from "../../../../src/utils/postgrest";
import { PG_DUPLICATE } from "../../../../src/utils/constants";
import AgentService from "../../../../src/services/agents.service";
import { navigate } from "vike/client/router";
import { SourceSelector } from "../../../../src/components/Select";
import { useOrders } from "../../../../src/services/orders.service/hook";

export default function () {
    useOrders();
    const selectorRef = useRef<{ getSelectedItems: () => Set<string> }>(null);
    const [message, setMessage] = useState<[NullString, boolean]>([
        null,
        false,
    ]);
    const [form, setForm] = useState<Omit<IAffiliate, "balance" | "id">>({
        fullname: "",
        phone: "",
        email: "",
        source_list: [],
    });

    const onSubmit = async (ev: FormEvent) => {
        const isValid = ev.currentTarget.checkVisibility();
        ev.preventDefault();
        if (!isValid) return;

        form.source_list = [
            ...selectorRef.current?.getSelectedItems().values() ?? [],
        ];
        const { error } = await new WithAuth(
            postgrest.from("affiliates").insert(form),
        ).unwrap();
        if (error) {
            if (error.code == PG_DUPLICATE) {
                setMessage(["Agent with Phone already exist", false]);
            }
            return;
        }
        setMessage(["Created successfully, please wait...", true]);
        AgentService.instance.fetch();
        setTimeout(() => navigate("/affiliates"), 500);
    };

    const _onFormChange = (
        ev: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => setForm({ ...form, [ev.currentTarget.name]: ev.currentTarget.value });

    return (
        <form
            onSubmit={onSubmit}
            className="flex flex-col gap-3 max-w-md mx-auto px-3 py-16"
        >
            <div className="text-center py-4">
                Create New Affiliate
            </div>
            {message[0] && (
                <div
                    className={`${
                        message[1] ? "text-blue-500" : "text-red-500"
                    } text-xs text-center`}
                >
                    {message[0]}
                </div>
            )}
            <Input
                name="fullname"
                placeholder="Fullanme"
                onChange={_onFormChange}
                required
            />
            <Input
                name="phone"
                placeholder="Phone"
                onChange={_onFormChange}
                required
            />
            <Input
                name="email"
                placeholder="Email (optional)"
                onChange={_onFormChange}
                validator={emailValidator}
            />

            <SourceSelector ref={selectorRef} />

            <Button className="bg-green-500">
                Create Affiliate
            </Button>
        </form>
    );
}
