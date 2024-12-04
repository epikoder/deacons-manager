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
        observable.subscribe(() => {
            setState((prev) => prev += 1);
        });
        setTimeout(() => setState((prev) => prev + 1), 200);
    }, []);
};
export { Observer, useObserver };
