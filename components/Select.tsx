import {
  Component,
  createRef,
  forwardRef,
  Fragment,
  ReactNode,
  SelectHTMLAttributes,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import Input from "./Input";
import AgentService, { Agent, useAgent } from "../services/agents.service";
import { OrderItem } from "../services/orders.service/order";
import { postgrest, WithAuth } from "../utils/postgrest";
import OrderService from "../services/orders.service/orders.service";

interface MultiSelectProp<T>
  extends Omit<React.HTMLAttributes<HTMLInputElement>, "value" | "multiple"> {
  name: string;
  label?: string;
  disabled?: boolean;
  items: T[];
  defaultValues?: string[];
  helperText?: string;
  render?: (v: T) => ReactNode;
}

export type MultiSelectItem = ID & Disabled & { [k: string]: any };
export const MultiSelect = forwardRef(
  (
    {
      name,
      items,
      render,
      label,
      helperText,
      disabled,
      defaultValues,
    }: MultiSelectProp<MultiSelectItem>,
    ref,
  ) => {
    useImperativeHandle(ref, () => ({
      getSelectedItems: () => state,
    }));
    const [state, setState] = useState<Set<string>>(new Set(defaultValues));
    const _isSelected = (v: MultiSelectItem) => state.has(v.getID());

    const onTap = (v: MultiSelectItem) => {
      const newSet = new Set(state);
      if (newSet.has(v.getID())) {
        newSet.delete(v.getID());
      } else {
        newSet.add(v.getID());
      }
      setState(newSet);
    };

    return (
      <div>
        <div className={"font-[500] flex items-center gap-4"}>
          {label && <span>{label}</span>}
          {helperText && (
            <em className={"text-xs text-zinc-500 flex items-center gap-1"}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="size-4"
              >
                <path
                  fill-rule="evenodd"
                  d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
                  clip-rule="evenodd"
                />
              </svg>
              <span>{helperText}</span>
            </em>
          )}
        </div>
        <div className={"flex flex-wrap gap-3"}>
          {items.map((v) => (
            <div
              key={v.getID()}
              className={`w-fit px-2 py-1 rounded-full text-sm cursor-pointer hover:bg-zinc-300 aria-disabled:bg-zinc-600 aria-disabled:hover:bg-zinc-600 aria-disabled:text-white aria-disabled:cursor-not-allowed ${
                _isSelected(v)
                  ? "border-2 border-green-500"
                  : "border border-gray-400"
              }`}
              id={name + "." + v.getID()}
              onClick={disabled || v.disabled ? undefined : () => onTap(v)}
              aria-disabled={disabled || v.disabled}
            >
              {render ? render(v) : String(v)}
            </div>
          ))}
          {items.length == 0 && (
            <div className={"whitespace-nowrap text-sm"}>
              - - No items available - -
            </div>
          )}
        </div>
      </div>
    );
  },
);

export enum Subjects {
  furhterMaths = "Further Mathematics",
  mathematics = "Mathematics SSCE",
  mathematicsUTME = "Mathematics UTME",

  english = "English SSCE",
  englishUTME = "English UTME",
  literature = "Literature SSCE",
  literatureUTME = "Literature UTME",

  physics = "Physics SSCE",
  physicsUTME = "Physics UTME",
  chemistry = "Chemistry SSCE",
  chemistryUTME = "Chemistry UTME",
  biology = "Biology SSCE",
  biologyUTME = "Biology UTME",
  agriculture = "Agriculture",
  geography = "Geography",

  commerce = "Commerce SSCE",
  commerceUTME = "Commerce UTME",
  economics = "Economics SSCE",
  economicsUTME = "Economics UTME",
  government = "Government SSCE",
  governmentUTME = "Government UTME",
  crs = "CRS SSCE",
  crsUTME = "CRS UTME",
  civic = "Civic Education and Trade subjects",
  accounting = "Financial Accounting",
}

export const SubjectSelect = forwardRef(
  (
    {
      defaultValue,
      onChange,
    }: {
      defaultValue?: BookConfig;
      showDelivered?: boolean;
      max?: { [k: string]: number };
      onChange?: (_: BookConfig) => void;
    },
    ref,
  ) => {
    useImperativeHandle(ref, () => ({
      getItems: () => state,
    }));
    const [state, setState] = useState<BookConfig>(
      defaultValue ?? {},
    );
    const _isSelected = (v: Subjects) => state[v] != undefined;

    const onTap = (v: Subjects) => {
      const exists = state[v] != undefined;
      if (exists) {
        delete state[v];
        setState({ ...state });
      } else {
        state[v] = 1;
        setState({ ...state });
      }
    };

    const items = Object.values(Subjects);

    useEffect(() => {
      onChange && onChange(state);
    }, [state]);

    return (
      <div className="flex flex-col gap-2">
        <div className={"flex flex-wrap gap-3"}>
          <p className="w-full font-semibold">
            General subjects
          </p>
          {items.filter((v) => !v.includes("UTME") && !v.includes("SSCE")).map((
            v,
          ) => (
            <div
              key={v}
              className={`w-fit px-2 py-px rounded-full text-xs cursor-pointer hover:bg-zinc-300 aria-disabled:bg-zinc-600 aria-disabled:hover:bg-zinc-600 aria-disabled:text-white aria-disabled:cursor-not-allowed ${
                _isSelected(v)
                  ? "border border-green-500"
                  : "border border-gray-400"
              }`}
              id={v}
              onClick={() => onTap(v)}
            >
              <div>{v}</div>
            </div>
          ))}
          <p className="w-full font-semibold">
            SSCE
          </p>
          {items.filter((v) => v.includes("SSCE")).map((v) => (
            <div
              key={v}
              className={`w-fit px-2 py-px rounded-full text-xs cursor-pointer hover:bg-zinc-300 aria-disabled:bg-zinc-600 aria-disabled:hover:bg-zinc-600 aria-disabled:text-white aria-disabled:cursor-not-allowed ${
                _isSelected(v)
                  ? "border border-green-500"
                  : "border border-gray-400"
              }`}
              id={v}
              onClick={() => onTap(v)}
            >
              <div>{v}</div>
            </div>
          ))}
          <p className="w-full font-semibold">
            UTME
          </p>
          {items.filter((v) => v.includes("UTME")).map((v) => (
            <div
              key={v}
              className={`w-fit px-2 py-px rounded-full text-xs cursor-pointer hover:bg-zinc-300 aria-disabled:bg-zinc-600 aria-disabled:hover:bg-zinc-600 aria-disabled:text-white aria-disabled:cursor-not-allowed ${
                _isSelected(v)
                  ? "border border-green-500"
                  : "border border-gray-400"
              }`}
              id={v}
              onClick={() => onTap(v)}
            >
              <div>{v}</div>
            </div>
          ))}
          {items.length == 0 && (
            <div className={"whitespace-nowrap text-sm"}>
              - - No items available - -
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-4 font-semibold">
            <div className="col-span-3">Subject</div>
            <div>Book Count</div>
          </div>

          {Object.entries(state).sort(([a], [b]) =>
            a.charCodeAt(0) - b.charCodeAt(0)
          )
            .sort(([a], [b]) =>
              (a.includes("SSCE") ? 1 : a.includes("UTME") ? 2 : 0) -
              (b.includes("SSCE") ? 1 : b.includes("UTME") ? 2 : 0)
            ).map(([name, count], index) => (
              <div key={name} className="grid grid-cols-4 gap-2">
                <div className="col-span-3">{name}</div>
                <Input
                  type="number"
                  defaultValue={count}
                  placeholder="min of 1"
                  resetSize
                  onBlur={(ev) => {
                    if (
                      isNaN(parseInt(ev.currentTarget.value)) ||
                      parseInt(ev.currentTarget.value) < 1
                    ) {
                      ev.currentTarget.value = "0";
                    }
                    state[name] = parseInt(ev.currentTarget.value);
                    setState({ ...state });
                  }}
                />
              </div>
            ))}
        </div>
      </div>
    );
  },
);

export interface SelectorAttibutes<T> {
  options: T[];
  defaultValue?: T;
  placeholder?: string;
  isLoading?: boolean;
  toString(v: T): string;
  render?: (_: T) => ReactNode;
  onOptionSelected(v: T): void;
}

export interface SelectorState {
  visible: boolean;
  value: string;
  is_focused: boolean;
}

export class Selector<T> extends Component<
  SelectorAttibutes<T>,
  SelectorState
> {
  public state: SelectorState = {
    visible: false,
    value: "",
    is_focused: false,
  };

  private styleVisible = { display: "block" };
  private styleHidden = { display: "none" };
  private clickHandler = (e: Event) => this.onClickOutside(e);
  private ref = createRef<HTMLInputElement>();
  private _ref = createRef<HTMLDivElement>();

  constructor(props: SelectorAttibutes<T>) {
    super(props);
    this.checkMatch = this.checkMatch.bind(this);
    this.closeTooltip = this.closeTooltip.bind(this);
    this.onClickOutside = this.onClickOutside.bind(this);
    this.onFocusHandler = this.onFocusHandler.bind(this);
    this.filterOptions = this.filterOptions.bind(this);
    this.applyFilter = this.applyFilter.bind(this);
    this.getMatcher = this.getMatcher.bind(this);
    this.selectOption = this.selectOption.bind(this);
    this.explicitSelection = this.explicitSelection.bind(this);
    this.enableFilter = this.enableFilter.bind(this);
  }

  public componentDidMount(): void {
    if (this.props.defaultValue) {
      this.setState(() => ({
        value: this.props.toString(this.props.defaultValue!),
      }));
    }
  }

  private onClickOutside(e: Event): void {
    !this._ref.current?.contains(e.target as Node) && this.closeTooltip();
  }

  private closeTooltip(opt?: T): void {
    this.setState(() => ({ visible: false }));
    globalThis.removeEventListener("click", this.clickHandler);
    if (opt) this.checkMatch(opt);
  }

  private checkMatch(opt: T): void {
    const match = this.props.options.find((v) => this.getMatcher(opt, v));
    if (!match) return;
    this.selectOption(match);
  }

  private getMatcher(opt: T, compare: T): boolean {
    return (
      this.props
        .toString(opt)
        .match(
          new RegExp(
            `^${
              this.props
                .toString(compare)
                .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            }$`,
            "i",
          ),
        ) != null
    );
  }

  private onFocusHandler(e: React.FocusEvent<HTMLInputElement>): void {
    (e.target as HTMLInputElement).select();
    this.setState(() => ({ visible: true, is_focused: true }));
    globalThis.addEventListener("click", this.clickHandler);
  }

  private filterOptions(e: React.FormEvent<HTMLInputElement>): void {
    const { value } = e.target as HTMLInputElement;
    this.setState(() => ({ value }));
  }

  private applyFilter(opt: T): boolean {
    return (
      this.props.toString(opt).match(new RegExp(this.state.value, "i")) != null
    );
  }

  private selectOption(opt: T): void {
    this.props.onOptionSelected(opt);
  }

  private explicitSelection(opt: T): void {
    this.setState(() => ({ value: this.props.toString(opt) }));
    this.closeTooltip(opt);
  }

  private enableFilter(e: React.KeyboardEvent<HTMLInputElement>) {
    const el = e.target as HTMLInputElement;
    this.setState({ is_focused: false });
  }

  private loader = (
    <div className={"flex justify-center"}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-6 h-6 animate-spin"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
        />
      </svg>
    </div>
  );

  public render() {
    return this.props.isLoading
      ? (
        this.loader
      )
      : (
        <div ref={this._ref} data-selector-container>
          <div data-selector-display>
            <input
              onFocus={this.onFocusHandler}
              onInput={this.filterOptions}
              value={this.state.value}
              placeholder={this.props.placeholder}
              className={"min-w-sm w-full border rounded p-1"}
              ref={this.ref}
              onKeyUp={this.enableFilter}
            />
          </div>
          <div
            data-selector-tooltip
            style={{
              ...(this.state.visible ? this.styleVisible : this.styleHidden),
              width: this.ref.current
                ? `${this.ref.current!.getBoundingClientRect().width}px`
                : "",
            }}
            className={"absolute max-h-[60vh] overflow-y-scroll border rounded p-2 bg-white"}
          >
            {this.props.options
              .filter(
                (opt) =>
                  this.state.is_focused ||
                  !this.state.value ||
                  this.applyFilter(opt),
              )
              .map((opt) => (
                <div
                  key={this.props.toString(opt)}
                  data-selector-option
                  onClick={() => this.explicitSelection(opt)}
                  className={"px-1"}
                >
                  <span>
                    {this.props.render
                      ? this.props.render(opt)
                      : this.props.toString(opt)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      );
  }
}

export const SelectAgent = forwardRef(
  ({ defaultValue }: { defaultValue?: Agent }, ref) => {
    const agents = useAgent();
    const [agent, setAgent] = useState<Agent>();
    useImperativeHandle(ref, () => ({
      getSelected() {
        return agent;
      },
    }));

    return (
      <Fragment>
        <Selector
          onOptionSelected={(agent) => setAgent(agent)}
          options={agents}
          defaultValue={defaultValue}
          toString={(v: Agent) => `${v.name} - ${v.state}`}
          // selected={controller.value}
          render={(v: Agent) => (
            <div className="cursor-pointer py-2 px-1 rounded-md hover:bg-zinc-100">
              {`${v.name} - ${v.state}`}
            </div>
          )}
          placeholder="Search agent"
        />
        {agent && (
          <div className="flex gap-3 items-start text-sm py-12 px-4">
            <span className="whitespace-nowrap">
              Books:
            </span>
            <div className="text-sm flex flex-wrap gap-x-4 gap-y-2">
              {Object.entries(agent.books).filter(([_, c]) => c > 0).map((
                [name, count],
              ) => (
                <div key={name} className="flex gap-1 items-end">
                  <span>{count}</span>
                  <span className="font-bold text-xs">X</span>
                  <span className="">{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Fragment>
    );
  },
);

export const SelectOrderItem = forwardRef(
  ({ defaultValue }: { defaultValue?: OrderItem }, ref) => {
    const [item, setItem] = useState<OrderItem>();
    useImperativeHandle(ref, () => ({
      getItem() {
        return item;
      },
    }));

    return (
      <select
        defaultValue={defaultValue}
        className="outline outline-zinc-400 focus:outline-zinc-600 rounded-md py-1"
        onChange={(ev) => setItem(ev.currentTarget.value as OrderItem)}
      >
        {Object.values(OrderItem).map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    );
  },
);

export const SelectDeliveryStatus = forwardRef(
  (
    {
      defaultValue,
      onChange,
    }: {
      defaultValue?: DeliveryStatus;
      onChange?: (_: DeliveryStatus) => void;
    },
    ref,
  ) => {
    const [item, setItem] = useState<DeliveryStatus>();
    useImperativeHandle(ref, () => ({
      getItem() {
        return item;
      },
    }));

    return (
      <select
        defaultValue={defaultValue}
        className="outline outline-zinc-400 focus:outline-zinc-600 rounded-md py-1 w-full"
        onChange={(ev) => {
          const status = ev.currentTarget.value as DeliveryStatus;
          setItem(status);
          onChange && onChange(status);
        }}
      >
        {Object.values(
          ["pending", "delivered"] satisfies DeliveryStatus[],
        ).map(
          (v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ),
        )}
      </select>
    );
  },
);

export const SelectMonth = (
  { defaultValue, onChange }: Pick<
    SelectHTMLAttributes<HTMLSelectElement>,
    "defaultValue" | "onChange"
  >,
) => (
  <select
    defaultValue={defaultValue}
    onChange={onChange}
    className="outline-none"
  >
    <option value={0}>
      January
    </option>
    <option value={1}>
      Feb
    </option>
    <option value={2}>
      March
    </option>
    <option value={3}>
      April
    </option>
    <option value={4}>
      May
    </option>
    <option value={5}>
      June
    </option>
    <option value={6}>
      July
    </option>
    <option value={7}>
      August
    </option>
    <option value={8}>
      September
    </option>
    <option value={9}>
      October
    </option>
    <option value={10}>
      November
    </option>
    <option value={11}>
      December
    </option>
  </select>
);

export const SourceSelector = forwardRef(({}, ref) => {
  const [sourceList, setSourceList] = useState<MultiSelectItem[]>([]);
  useEffect(() => {
    new WithAuth(postgrest.from("affiliates").select("source_list")).unwrap()
      .then(({ data, error }) => {
        if (error) return console.log(error);
        const sources = data.map((v) => v.source_list).flat().unique().map(
          (v) => v.toLowerCase(),
        );
        setSourceList(OrderService.instance.sourceList.map((v) => ({
          getID() {
            return v;
          },
          disabled: sources.includes(v.toLowerCase()),
        })));
      });
  }, []);

  return (
    <MultiSelect
      ref={ref}
      name="source"
      render={(v) => <span className="text-xs">{v.getID()}</span>}
      items={sourceList}
    />
  );
});
