import { useEffect, useState } from "react";

abstract class Observer {
    private subscribers: VoidFunction[] = [];

    subscribe(subscriber: VoidFunction) {
        this.subscribers.push(subscriber);
    }

    unsubscribe(subscriber: VoidFunction) {
        this.subscribers = this.subscribers.filter((sub) => sub !== subscriber);
    }

    clearSubscribers() {
        this.subscribers = [];
    }

    getSubscriberCount(): number {
        return this.subscribers.length;
    }

    protected notifySubscribers() {
        this.subscribers.forEach((subscriber) => subscriber());
    }
}

const useObserver = (observable: Observer) => {
    const [_, setState] = useState(0);
    useEffect(() => {
        // Unsubscribe on unmount: list rows remount on every refresh, and each mount
        // used to leave one more listener behind on the model.
        const onChange = () => setState((prev) => prev + 1);
        observable.subscribe(onChange);
        const timer = setTimeout(onChange, 200);
        return () => {
            observable.unsubscribe(onChange);
            clearTimeout(timer);
        };
    }, [observable]);
};
export { Observer, useObserver };
