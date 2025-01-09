import { ReactNode, useEffect, useState } from "react";
import { SubscriberProvider } from "../../@types/subscribers";

export default function Badge<T>(
    { children, subscriber }: {
        children: ReactNode;
        subscriber: SubscriberProvider<T>;
    },
) {
    const [showBadge, setShowBadge] = useState(false);

    useEffect(() => {
        subscriber.subscribe((_) => {
            setShowBadge(true);
        });
    }, []);

    return (
        <div
            className="relative w-full"
            onClick={() => setShowBadge(false)}
        >
            {showBadge && (
                <span className="rounded-full size-2 bg-red-500 animate-pulse absolute top-1 right-1">
                </span>
            )}
            {children}
        </div>
    );
}
