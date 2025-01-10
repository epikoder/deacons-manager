export enum Month {
    JANUARY = 0,
    FEBRUARY = 1,
    MARCH = 2,
    APRIL = 3,
    MAY = 4,
    JUNE = 5,
    JULY = 6,
    AUGUST = 7,
    SEPTEMBER = 8,
    OCTOBER = 9,
    NOVEMBER = 10,
    DECEMBER = 11,
}

const tenth = (v: number) => {
    return v >= 10 ? v : `0${v}`;
};

export default class Carbon extends Date {
    public static carbon() {
        return new Carbon();
    }

    public static fromDay(date: number) {
        return new Carbon(
            new Date().getFullYear(),
            new Date().getMonth(),
            date,
        );
    }

    public static fromMonth(month: number, day?: number) {
        return new Carbon(
            new Date().getFullYear(),
            month,
            day ?? 1,
        );
    }

    public static fromYear(year: number, month?: number, day?: number) {
        return new Carbon(
            year,
            month ?? 1,
            day ?? 1,
        );
    }

    public static lastMonthOfYear(year?: number) {
        return year == new Date().getFullYear()
            ? new Date().getMonth() + 1
            : 12;
    }

    addSecond(sec: number): Carbon {
        return new Carbon(this.getTime() + Carbon.SECOND * sec);
    }

    addMinute(min: number): Carbon {
        return new Carbon(this.getTime() + Carbon.MINUTE * min);
    }

    addHour(hour: number): Carbon {
        return new Carbon(this.getTime() + Carbon.HOUR * hour);
    }

    addDay(day: number): Carbon {
        return new Carbon(this.getTime() + Carbon.DAY * day);
    }

    diff(date: Carbon | Date) {
        return new Duration(date.valueOf() - this.valueOf());
    }

    absDiff(date: Carbon | Date) {
        return new Duration(Math.abs(date.valueOf() - this.valueOf()));
    }

    get string(): string {
        return `${
            this.getHours() > 12 ? this.getHours() % 12 : this.getHours()
        }:${
            this.getMinutes() >= 10
                ? this.getMinutes()
                : `0${this.getMinutes()}`
        }${this.getHours() > 12 ? "PM" : "AM"}, ${this.getFullYear()}-${
            tenth(this.getMonth() + 1)
        }-${tenth(this.getDate())}`;
    }

    format(): string {
        return `${this.getFullYear()}-${tenth(this.getMonth() + 1)}-${
            tenth(this.getDate())
        }`;
    }

    formatLocalISO(): string {
        const date = new Carbon(this.localISO());
        return `${date.getFullYear()}-${tenth(date.getMonth() + 1)}-${
            tenth(date.getDate())
        }`;
    }

    localISO(): string {
        const offset = this.getTimezoneOffset() * 60000;
        const localISOTime = new Date(this.valueOf() - offset).toISOString()
            .slice(
                0,
                -1,
            );
        return localISOTime;
    }

    get month(): string {
        switch (this.getMonth() as Month) {
            case Month.JANUARY:
                return "January";
            case Month.FEBRUARY:
                return "February";
            case Month.MARCH:
                return "March";
            case Month.APRIL:
                return "April";
            case Month.MAY:
                return "May";
            case Month.JUNE:
                return "June";
            case Month.JULY:
                return "July";
            case Month.AUGUST:
                return "August";
            case Month.SEPTEMBER:
                return "September";
            case Month.OCTOBER:
                return "October";
            case Month.NOVEMBER:
                return "November";
            default:
                return "December";
        }
    }

    public static monthString(month: number) {
        switch (month as Month) {
            case Month.JANUARY:
                return "January";
            case Month.FEBRUARY:
                return "February";
            case Month.MARCH:
                return "March";
            case Month.APRIL:
                return "April";
            case Month.MAY:
                return "May";
            case Month.JUNE:
                return "June";
            case Month.JULY:
                return "July";
            case Month.AUGUST:
                return "August";
            case Month.SEPTEMBER:
                return "September";
            case Month.OCTOBER:
                return "October";
            case Month.NOVEMBER:
                return "November";
            default:
                return "December";
        }
    }

    public static get SECOND(): number {
        return 1000;
    }
    public static get MINUTE(): number {
        return 60000;
    }
    public static get HOUR(): number {
        return 3600000;
    }
    public static get DAY(): number {
        return 86400000;
    }
}

class Duration extends Number {
    get seconds(): number {
        return this.valueOf() / Carbon.SECOND;
    }

    get millisecond(): number {
        return this.valueOf();
    }

    get minute(): number {
        return this.valueOf() / Carbon.MINUTE;
    }

    get hour(): number {
        return Math.floor(this.valueOf() / Carbon.HOUR);
    }

    get day(): number {
        return Math.floor(this.valueOf() / Carbon.DAY);
    }
}
