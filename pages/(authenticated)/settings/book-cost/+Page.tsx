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

    const updateBookCost = async () => {
        if (!isNaN(parseInt(ref.current?.value ?? ""))) {
            setLoading(true);
            await new WithAuth(
                postgrest.from("configs").upsert({
                    name: "book_cost",
                    value: parseInt(ref.current!.value),
                    type: "number",
                }),
            ).unwrap();
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-3 text-sm py-4">
            <p>Book cost</p>
            <Input
                ref={ref}
                sx="col-span-5 w-full"
                defaultValue={context.config.bookCost}
            />
            <Button className="bg-green-500" onClick={updateBookCost}>
                <span>Update</span>
                {loading && <ActivityIndicator active />}
            </Button>
        </div>
    );
}
