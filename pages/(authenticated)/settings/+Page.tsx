import { usePageContext } from "vike-react/usePageContext";
import Input from "../../../components/Input";
import Logo from "../../../components/Logo";

export default function () {
    const context = usePageContext();
    return (
        <div className="flex flex-col gap-3 text-sm place-items-center py-12">
            <Logo url="#" />
            <p>
                Deacon's Publishers
            </p>
            <p>
                v1.2.2
            </p>
        </div>
    );
}
