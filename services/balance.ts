import { Observer } from "../@types/observable";
import Carbon from "../utils/carbon";
import { postgrest, WithAuth } from "../utils/postgrest";

type DayEarning = {
  day: string;
  earning: number | null;
};

type MonthEarning = {
  month: string;
  earning: number | null;
};

type BalanceFilter = { id?: string; source_filter?: string[] };
export default class Balance extends Observer {
  constructor(filter: BalanceFilter) {
    super();
    this._filter = filter;
    this.fetchEarningForYear(new Date().getFullYear());
  }

  private _filter: BalanceFilter;
  private _inner: Required<IBalance> = { value: 0, total: 0 };

  get value(): number {
    return this._inner.value;
  }

  get totalEarning(): number {
    return this._inner.total;
  }

  public fetchEarningForYear(year: number) {
    new WithAuth(
      postgrest.rpc("get_earning_by_day", {
        month: new Carbon().getMonth() + 1,
        year: year,
        agent: this._filter.id ? this._filter.id : null,
        source_filter:
          (this._filter.source_filter?.length ?? 0) > 0
            ? this._filter.source_filter
            : null,
      }),
    )
      .unwrap()
      .then(({ data, error }) => {
        if (error) return console.log(error);
        this._inner.value = (data as DayEarning[])
          .map((v) => v.earning ?? 0)
          .sum();
        this.notifySubscribers();
      });

    new WithAuth(
      postgrest.rpc("get_earning_by_month", {
        year: year,
        agent: this._filter.id ? this._filter.id : null,
        source_filter:
          (this._filter.source_filter?.length ?? 0) > 0
            ? this._filter.source_filter
            : null,
      }),
    )
      .unwrap()
      .then(({ data, error }) => {
        if (error) return console.log(error);
        this._inner.total = (data as MonthEarning[])
          .map((v) => v.earning ?? 0)
          .sum();
        this.notifySubscribers();
      });
  }
}
