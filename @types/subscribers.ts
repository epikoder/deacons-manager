abstract class SubscriberProvider<T> {
    private subscribers: ((inner: T) => void)[] = [];

    subscribe(subscriber: (inner: T) => void) {
        this.subscribers.push(subscriber);
    }

    unsubscribe(subscriber: (inner: T) => void) {
        this.subscribers = this.subscribers.filter((sub) => sub !== subscriber);
    }

    clearSubscribers() {
        this.subscribers = [];
    }

    getSubscriberCount(): number {
        return this.subscribers.length;
    }

    protected notifySubscribers(inner: T) {
        this.subscribers.forEach((subscriber) => subscriber(inner));
    }
}

export { SubscriberProvider };
