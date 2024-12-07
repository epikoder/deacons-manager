import { usePageContext } from "vike-react/usePageContext";
import Input from "../../../components/Input";

export default function () {
    const context = usePageContext();
    return (
        <div className="flex flex-col gap-3 text-sm">
            <div className="grid grid-cols-7 gap-2">
                <p className="col-span-2">FullName</p>
                <Input
                    sx="col-span-5 w-full"
                    value={context.config.user!.fullname}
                />
            </div>
            <div className="grid grid-cols-7 gap-2">
                <p className="col-span-2">Email</p>
                <Input
                    sx="col-span-5 w-full"
                    value={context.config.user!.email}
                    disabled
                />
            </div>
        </div>
    );
}
