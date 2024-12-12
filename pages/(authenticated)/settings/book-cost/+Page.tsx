import { usePageContext } from "vike-react/usePageContext";
import Input from "../../../../components/Input";
import Button from "../../../../components/Button";

export default function () {
    const context = usePageContext();
    return (
        <div className="flex flex-col gap-3 text-sm py-4">
            <p>Book cost</p>
            <Input
                sx="col-span-5 w-full"
                defaultValue={context.config.bookCost}
            />
            <Button className="bg-green-500">
                Update
            </Button>
        </div>
    );
}
