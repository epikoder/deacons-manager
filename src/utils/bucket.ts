export default class Bucket<T> {
    constructor(fn: (_: T) => string) {
        this._getID = fn;
    }
    private _getID: (_: T) => string;
    private _items: T[] = [];

    get items() {
        return [...this._items];
    }

    getItem(predicate: (v: T) => boolean): T | undefined {
        return this.items.find(predicate);
    }

    add(item: T) {
        const index = this._items.findIndex((v) =>
            this._getID(v) == this._getID(item)
        );
        if (index != -1) {
            return;
        }
        this._items.unshift(item);
    }

    update(item: T) {
        const index = this._items.findIndex((v) =>
            this._getID(v) == this._getID(item)
        );
        if (index == -1) {
            return;
        }
        this._items[index] = item;
    }

    remove(item: T) {
        const index = this._items.findIndex((v) =>
            this._getID(v) == this._getID(item)
        );
        if (index != -1) {
            this._items = this._items.slice(0, index).concat(
                this._items.slice(index + 1),
            );
        }
    }

    clear() {
        this._items = [];
    }
}
