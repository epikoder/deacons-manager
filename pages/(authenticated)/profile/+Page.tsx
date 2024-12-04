import { usePageContext } from "vike-react/usePageContext"

export default function () {
    const context = usePageContext()
    return <div className="flex flex-col md:flex-row">
        <div>
            {context.config.user!.fullname}
        </div>

    </div>
}