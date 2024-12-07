import { Fragment, ReactNode, useState } from "react";
import { ChevronDown, ChevronUp } from "./Icons";

export default function Expanded({ children }: { children: ReactNode }) {
    const [is_expanded, set_is_expanded] = useState(false);
    return (
        <Fragment>
            <div id='accc'
                className={`${
                    is_expanded ? "h-fit" : "max-h-28"
                } overflow-hidden text-ellipsis inline`}
            >
                {children}
            </div>
            <button onClick={() => set_is_expanded(!is_expanded)} className="w-fit mx-auto text-sm">
                {is_expanded
                    ? (
                        <div className="flex gap-2 items-center">
                            <span className="underline">
                                Show less
                            </span>
                            <ChevronUp />
                        </div>
                    )
                    : (
                        <div className="flex gap-2 items-center">
                            <span className="underline">
                                Show more
                            </span>
                            <ChevronDown />
                        </div>
                    )}
            </button>
        </Fragment>
    );
}
