Array.prototype.unique = function () {
    return [...new Set(this)];
};
Array.prototype.sum = function () {
    let sum = 0;
    for (const v of this ?? []) {
        let n = Number(v);
        sum += isNaN(n) ? 0 : n;
    }
    return sum;
};

Array.prototype.isEmpty = function () {
    return (this ?? []).length == 0;
};

Map.prototype.toArray = function (): any[] {
    return [...this.values()];
};

Map.prototype.isEmpty = function (): boolean {
    return this.size === 0;
};

Map.prototype.json = function () {
    const r: Record<string, any> = {};
    [...this.entries()].forEach(([k, v]) => {
        if (k) {
            r[String(k)] = v;
        }
    });
    return r;
};

Number.prototype.asLocalCurrency = function (): string | undefined {
    if (this.valueOf() == undefined || this.valueOf() == null) return undefined;
    return "₦" + Intl.NumberFormat().format(this.valueOf());
};
