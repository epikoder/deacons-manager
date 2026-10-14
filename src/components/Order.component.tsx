import {
  createContext,
  forwardRef,
  Fragment,
  ReactNode as ReactElement,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import Order, { OrderItem } from "../services/orders.service/order";
import { useRipple } from "../hooks/useRipple";
import { showAlertDialog } from "./Dialog";

import {
  SelectAgent,
  SelectDeliveryStatus,
  SelectOrderItem,
  Subjects,
  SubjectSelect,
} from "./Select";
import { useObserver } from "../../@types/observable";

import { Agent } from "../services/agents.service";

import Input from "./Input";
import OrderService from "../services/orders.service/orders.service";
import {
  ArchiveIcon,
  InfoIcon,
  PenIcon,
  PhoneIcon,
  RestoreIcon,
} from "./Icons";
import CopyButton from "./CopyButton";
import Toast from "../utils/toast";
import StateComponent from "./State.component";

const context = createContext<Order | undefined>(undefined);

/** Re-run the list on screen so the order leaves a view it no longer matches. */
const refreshList = () => OrderService.instance.refresh();

export const OrderComponent = forwardRef(({ order }: { order: Order }, ref) => {
  useObserver(order);

  return (
    <context.Provider value={order}>
      <div
        className={`rounded-xl border bg-white shadow-sm w-full flex flex-col ${
          order.isArchived
            ? "border-dashed border-zinc-300"
            : "border-zinc-200"
        }`}
        onClick={() => console.log(order)}
      >
        <div className="flex justify-between items-center gap-3 px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs rounded-full px-2.5 py-0.5 text-white bg-zinc-800 font-medium truncate">
              {order.source}
            </span>
            <span className="inline-flex items-center text-xs text-zinc-500 tabular-nums">
              #{order.orderNumber}
              <CopyButton value={order.orderNumber} label="Copy order number" />
            </span>
          </div>
          <div id="tags" className="flex gap-1.5 items-center shrink-0">
            {order.isArchived && (
              <Tag className="bg-zinc-100 text-zinc-600 ring-zinc-300">
                Archived
              </Tag>
            )}
            {order.deliveryStatus == "delivered" && (
              <Tag className="bg-green-50 text-green-700 ring-green-600/30">
                Delivered
              </Tag>
            )}
            {order.deliveryStatus != "delivered" && order.isAssignedToAgent && (
              <Tag className="bg-amber-50 text-amber-700 ring-amber-600/30">
                Assigned
              </Tag>
            )}
            {!order.isAssignedToAgent && order.isComfirmed && (
              <Tag className="bg-blue-50 text-blue-700 ring-blue-600/30">
                Confirmed
              </Tag>
            )}
            {order.isNewOrder && (
              <Tag className="bg-red-50 text-red-700 ring-red-600/30">New</Tag>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row justify-between gap-x-12 gap-y-4 px-4 pb-4">
          <div className="flex flex-col gap-2 text-sm min-w-0 sm:flex-1">
            <ShowOrderItem />
            <ShowAmount />
            {order.books && Object.keys(order.books).length > 0 && (
              <div className="flex gap-3 items-start">
                <span className="text-zinc-500 whitespace-nowrap">Books</span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(order.books).map(([name, count]) => (
                    <span
                      key={name}
                      className="inline-flex gap-1 items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs"
                    >
                      <span className="font-semibold tabular-nums">
                        {count}×
                      </span>
                      <span>{name}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Agent</span>
              <span
                className={order.agentName ? "font-medium" : "text-zinc-400"}
              >
                {order.agentName ?? "Not yet assigned"}
              </span>
              {(order.isComfirmed && order.canMutate && !order.isArchived) && (
                <ActionAssignAgent>
                  <PenIcon className="size-3 text-green-600" />
                </ActionAssignAgent>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {order.deliveryStatus === "delivered" && (
                <div>
                  <span className="text-zinc-500">Delivery charge</span>{" "}
                  <span className="font-medium tabular-nums">
                    {order.deliveryCost
                      ? order.deliveryCost.asLocalCurrency()
                      : "--"}
                  </span>
                </div>
              )}
              <div>
                <span className="text-zinc-500">Office charge</span>{" "}
                <span className="font-medium tabular-nums">
                  {order.officeCharge
                    ? order.officeCharge.asLocalCurrency()
                    : "--"}
                </span>
              </div>
            </div>
          </div>
          <div className="text-sm sm:text-right flex flex-col sm:items-end gap-1 min-w-0 sm:max-w-[45%]">
            <div className="flex items-center sm:justify-end gap-1 font-semibold text-zinc-900">
              <span className="truncate">
                {order.customerName || "No name"}
              </span>
              <CopyButton value={order.customerName} label="Copy name" />
            </div>
            <div className="flex items-center sm:justify-end gap-1">
              <a
                className="flex gap-1.5 w-fit items-center text-blue-600 hover:underline tabular-nums"
                href={`tel:${order.phone}`}
              >
                <PhoneIcon className="size-3" />
                <span>{order.phone}</span>
              </a>
              <CopyButton value={order.phone} label="Copy phone number" />
            </div>
            <div
              className={order.email
                ? "text-zinc-700 break-all"
                : "text-zinc-400"}
            >
              {order.email || "No email"}
            </div>
            <ShowAddress />
            <div className="text-xs text-zinc-400 mt-1">{order.date}</div>
          </div>
        </div>
        {order.deliveryStatus === "delivered" && order.deliveredOn && (
          <div className="px-4 py-3 flex flex-wrap gap-x-8 gap-y-1 border-t border-zinc-100 bg-zinc-50/60 text-sm rounded-b-xl">
            <div>
              <span className="text-zinc-500">Affiliate earning</span>{" "}
              <span className="font-semibold tabular-nums">
                {order.affiliateEarning.asLocalCurrency()}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Agent earning</span>{" "}
              <span className="font-semibold tabular-nums">
                {order.agentEarning.asLocalCurrency()}
              </span>
            </div>
            <div className="text-xs text-zinc-500 self-center">
              Delivered {order.deliveredOn.string}
            </div>
          </div>
        )}
        {order.isArchived && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-zinc-100">
            <span className="text-xs text-zinc-500">
              Hidden from order lists and charts.
            </span>
            <div className="flex-1" />
            <ActionUnarchive />
          </div>
        )}
        {order.canMutate && !order.isArchived && (
          <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-zinc-100">
            {!order.isComfirmed && <ActionDelete />}
            <ActionArchive />
            <div className="flex-1" />
            <ActionUpdateBooks />
            {!order.isComfirmed && <ActionConfirm />}
            {order.isComfirmed && !order.isAssignedToAgent && (
              <ActionAssignAgent />
            )}
            {order.isAssignedToAgent && <ActionUpdateDeliveryStatus />}
          </div>
        )}
      </div>
    </context.Provider>
  );
});

const Tag = (
  { children, className }: { children: ReactElement; className: string },
) => (
  <span
    className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md ring-1 ring-inset ${className}`}
  >
    {children}
  </span>
);

const _base =
  "cursor-pointer inline-flex items-center gap-1.5 text-center text-xs font-medium rounded-lg px-3 py-1.5 transition-colors";
const _class = `${_base} text-white`;
const _outline = `${_base} border bg-white`;

const ActionUpdateBooks = () => {
  const ref = useRipple<HTMLButtonElement>();
  const multiSelectRef = useRef<{ getItems: () => BookConfig }>();

  const getDefault = (order: Order): BookConfig => {
    if (!order.books || order.books.length == 0) {
      return {
        [Subjects.english]: 1,
        [Subjects.mathematics]: 1,
      };
    }
    return { ...order.books };
  };

  return (
    <context.Consumer>
      {(order) => (
        <button
          ref={ref}
          className={`${_class} bg-blue-600 hover:bg-blue-700`}
          onClick={() => {
            showAlertDialog({
              title: "Subject Combination",
              message: (
                <div className="flex flex-col gap-3">
                  <div>{order!.orderItem}</div>
                  <div>
                    {order!.orderAmount.asLocalCurrency()}
                  </div>
                  <SubjectSelect
                    ref={multiSelectRef}
                    showDelivered={order!.deliveryStatus == "delivered"}
                    defaultValue={getDefault(order!)}
                  />
                </div>
              ),
              onContinue: async () => {
                const subs = multiSelectRef.current?.getItems();
                if (!subs) return;
                await order!.updateBookConfiguration(subs);
                Toast.success("Books updated");
              },
            });
          }}
        >
          Update Books
        </button>
      )}
    </context.Consumer>
  );
};

const ActionDelete = () => {
  const ref = useRipple<HTMLButtonElement>();
  return (
    <context.Consumer>
      {(order) => (
        <button
          ref={ref}
          className={`${_outline} border-red-200 text-red-600 hover:bg-red-50`}
          onClick={() =>
            showAlertDialog({
              title: "Delete Order",
              message: (
                <div className="flex flex-col gap-3">
                  <div>{order!.orderItem}</div>
                  <div>
                    {order!.orderAmount.asLocalCurrency()}
                  </div>
                  <div>{order!.address}</div>
                  <div>{order!.state}</div>
                </div>
              ),
              onContinue: async () => {
                await OrderService.instance.deleteOrder(order!);
                refreshList();
              },
            })}
        >
          Delete
        </button>
      )}
    </context.Consumer>
  );
};

const ActionArchive = () => {
  const ref = useRipple<HTMLButtonElement>();
  return (
    <context.Consumer>
      {(order) => (
        <button
          ref={ref}
          className={`${_outline} border-zinc-300 text-zinc-700 hover:bg-zinc-50`}
          title="Hide this order (e.g. a duplicate) without deleting it"
          onClick={() =>
            showAlertDialog({
              title: "Archive order?",
              message: (
                <div className="flex flex-col gap-2">
                  <div>
                    <span className="font-medium">{order!.customerName}</span>
                    {" · "}
                    {order!.phone}
                  </div>
                  <div>
                    {order!.orderItem} · {order!.orderAmount.asLocalCurrency()}
                  </div>
                  <div className="text-zinc-500">
                    It is hidden from the order lists and charts but kept on
                    record. Find it again under the <b>Archived</b> filter.
                  </div>
                </div>
              ),
              onContinue: async () => {
                await order!.archive();
                Toast.success("Order archived");
                refreshList();
              },
            })}
        >
          <ArchiveIcon className="size-3.5" />
          Archive
        </button>
      )}
    </context.Consumer>
  );
};

const ActionUnarchive = () => {
  const ref = useRipple<HTMLButtonElement>();
  return (
    <context.Consumer>
      {(order) => (
        <button
          ref={ref}
          className={`${_outline} border-zinc-300 text-zinc-700 hover:bg-zinc-50`}
          onClick={async () => {
            try {
              await order!.unarchive();
            } catch {
              return; // save() has already said why
            }
            Toast.success("Order restored");
            refreshList();
          }}
        >
          <RestoreIcon className="size-3.5" />
          Restore
        </button>
      )}
    </context.Consumer>
  );
};

const ActionConfirm = () => {
  const ref = useRipple<HTMLButtonElement>();
  return (
    <context.Consumer>
      {(order) => (
        <button
          ref={ref}
          className={`${_class} bg-green-600 hover:bg-green-700`}
          onClick={() =>
            showAlertDialog({
              title: "Confirm Order",
              message: (
                <div className="flex flex-col gap-3">
                  <div>{order!.orderItem}</div>
                  <div>
                    {order!.orderAmount.asLocalCurrency()}
                  </div>
                  <div>{order!.address}</div>
                  <div>{order!.state}</div>
                </div>
              ),
              onContinue: async () => {
                await order!.confirmOrder();
                Toast.success("Order confirmed");
                refreshList();
              },
            })}
        >
          Confirm
        </button>
      )}
    </context.Consumer>
  );
};

const ActionAssignAgent = ({ children }: { children?: ReactElement }) => {
  const selectorRef = useRef<{ getSelected: () => Agent | undefined }>();
  const ref = useRipple<HTMLButtonElement>();
  return (
    <context.Consumer>
      {(order) => (
        <button
          ref={ref}
          className={children
            ? "p-1 rounded hover:bg-zinc-100"
            : `${_class} bg-green-600 hover:bg-green-700`}
          onClick={() => {
            showAlertDialog({
              title: "Assign Agent",
              message: (
                <div className="min-h-72">
                  <SelectAgent defaultValue={order!.agent} ref={selectorRef} />
                </div>
              ),
              onContinue: async () => {
                const agent = selectorRef.current?.getSelected();
                if (!agent) {
                  Toast.error("Please select an Agent to continue");
                  throw new Error("Agent not selected");
                }
                await order!.assignAgent(agent);
                Toast.success(`Assigned to ${agent.name}`);
                // Assigning also confirms, so the order leaves UnConfirmed/UnAssigned.
                refreshList();
              },
            });
          }}
        >
          {children ?? "Assign agent"}
        </button>
      )}
    </context.Consumer>
  );
};

const ActionUpdateDeliveryStatus = () => {
  const ref = useRef<{ onContinue: () => Promise<void> }>();

  return (
    <context.Consumer>
      {(order) => (
        <button
          className={`${_class} bg-amber-700 hover:bg-amber-800`}
          onClick={() => {
            showAlertDialog({
              title: "Update delivery status",
              message: <__UpdateDeliveryStatus ref={ref} order={order!} />,
              onContinue: async () => {
                await ref.current?.onContinue();
                refreshList();
              },
            });
          }}
        >
          Update Delivery Status
        </button>
      )}
    </context.Consumer>
  );
};

const __UpdateDeliveryStatus = forwardRef(
  ({ order }: { order: Order }, ref) => {
    const [status, setStatus] = useState(order.deliveryStatus);
    const [amount, setChargeAmount] = useState(order.deliveryCost ?? 0);
    const [books, setBooks] = useState<BookConfig>({});

    const multiSelectRef = useRef<{ getItems: () => BookConfig }>();
    useImperativeHandle(ref, () => ({
      onContinue: async () => {
        if (!status || (status == "delivered" && amount <= 0)) {
          Toast.error("Please enter delivery charge");
          throw new Error();
        }

        const max = getMax(order.agent!);

        for (const [name, count] of Object.entries(books)) {
          if ((max[name] ?? 0) < count) {
            Toast.error(`Not enough ${name}`);
            throw new Error();
          }
        }

        if (!order!.isConfigValidForPaidAmount(books, amount)) {
          Toast.error(`Books exceed order amount`);
          throw new Error();
        }

        if (status == "delivered" && Object.keys(books).length == 0) {
          Toast.error(`No book selected`);
          throw new Error();
        }
        
        if (books) {
          await order!.setBookConfiguration(books);
        }
        await order!.updateDelivery(status, amount);
      },
    }));

    const getDefault = (order: Order): BookConfig => {
      if (!order.books || order.books.length == 0) {
        return {
          [Subjects.english]: 1,
          [Subjects.mathematics]: 1,
        };
      }
      return { ...order.books };
    };

    const getMax = (agent: Agent) => {
      return agent.books;
    };

    const [isValid, setIsValid] = useState(true);

    const _compute = (books: BookConfig) => {
      setBooks(multiSelectRef.current?.getItems() ?? {});
      for (const k of Object.keys(books)) {
        if (order.agent!.books[k] < books[k] || !order.agent!.books[k]) {
          return setIsValid(false);
        }
      }
      setIsValid(true);
    };

    return (
      <div className="flex flex-col gap-3 justify-center items-center w-full">
        <SelectDeliveryStatus
          defaultValue={status}
          onChange={(s) => setStatus(s)}
        />
        {status == "delivered" && (
          <div className="space-y-1 w-full">
            <Input
              resetSize
              type="number"
              placeholder="delivery charge"
              defaultValue={amount}
              onBlur={(ev) => {
                if (
                  isNaN(parseInt(ev.currentTarget.value)) ||
                  parseInt(ev.currentTarget.value) < 0
                ) {
                  ev.currentTarget.value = "0";
                }
                setChargeAmount(parseInt(ev.currentTarget.value));
              }}
            />
            <div className="text-xs flex gap-2 items-center">
              <InfoIcon className="size-4" /> Delivery Charge
            </div>
          </div>
        )}

        {(status === "delivered" && order.agent) && (
          <Fragment>
            <div className="flex flex-col gap-2 p-2 text-sm">
              <div className="font-semibold">
                Books agent is currently holding
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {Object.entries(order.agent.books).filter(([_, count]) =>
                  count > 0
                )
                  .sort((
                    [a],
                    [b],
                  ) => a.charCodeAt(0) - b.charCodeAt(0)).map((
                    [name, count],
                  ) => (
                    <div key={name} className="text-xs">
                      {name} : {count}
                    </div>
                  ))}
              </div>
              {Object.values(order.agent.books).filter((v) =>
                v > 0
              )
                .isEmpty() && <div className="text-center">-- no books --</div>}
            </div>
            <SubjectSelect
              ref={multiSelectRef}
              defaultValue={getDefault(order!)}
              showDelivered={status === "delivered"}
              max={getMax(order.agent)}
              onChange={_compute}
            />
            {!isValid && (
              <div className="flex gap-3 items-center">
                <InfoIcon className="size-4 text-red-500" />
                <span className="text-xs font-semibold text-red-500">
                  Agent is missing one / more book
                </span>
              </div>
            )}

            {!order.isConfigValidForPaidAmount(books, amount) && (
              <div className="flex gap-3 items-center">
                <InfoIcon className="size-4 text-red-500" />
                <span className="text-xs font-semibold text-red-500">
                  Cost has exceeded paid amount
                </span>
              </div>
            )}
            <div className="flex gap-3 items-center">
              <InfoIcon className="size-4" />
              <span className="text-xs font-semibold">
                This action is irreversible.
              </span>
            </div>
          </Fragment>
        )}
      </div>
    );
  },
);

const ActionUpdateOfficeCharge = (
  { children }: { children?: ReactElement },
) => {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <context.Consumer>
      {(order) => (
        <button
          className={`${_class} ${children ? "" : "text-white bg-teal-700"}`}
          onClick={() => {
            showAlertDialog({
              title: "Update delivery status",
              message: (
                <div>
                  <Input
                    ref={ref}
                    defaultValue={order!.officeCharge}
                    resetSize
                    type="number"
                    className="w-full"
                    placeholder="delivery charge"
                  />
                </div>
              ),
              onContinue: () => {
                const amount = parseInt(ref.current!.value);
                if (isNaN(amount)) {
                  throw new Error();
                }
                order!.updateOfficeCharge(amount);
              },
            });
          }}
        >
          {children ?? "Office charge"}
        </button>
      )}
    </context.Consumer>
  );
};

const ShowOrderItem = () => {
  const ref = useRef<{ getItem: () => OrderItem | undefined }>();

  return (
    <context.Consumer>
      {(order) => (
        <div className="flex gap-2 items-center">
          <span className="font-semibold text-zinc-900">{order!.orderItem}</span>
          {order?.canMutate && !order.isArchived && (
            <button
              onClick={() => {
                showAlertDialog({
                  title: "Order Category",
                  message: (
                    <div className="py-8 px-4">
                      <SelectOrderItem
                        ref={ref}
                        defaultValue={order?.orderItem}
                      />
                    </div>
                  ),
                  onContinue: async () => {
                    const item = ref.current?.getItem();
                    if (!item) throw new Error();
                    await order?.updateOrderItem(item);
                  },
                });
              }}
            >
              <PenIcon className="size-3 text-green-600" />
            </button>
          )}
        </div>
      )}
    </context.Consumer>
  );
};

const ShowAmount = () => {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <context.Consumer>
      {(order) => (
        <Fragment>
          <div className="flex gap-2 items-center">
            <div>
              <span className="text-zinc-500">Paid</span>{" "}
              <span className="font-medium tabular-nums">
                {order!.orderAmount.asLocalCurrency()}
              </span>
            </div>
            {order?.canMutate && !order.isArchived && (
              <button
                onClick={() => {
                  showAlertDialog({
                    title: "Order Amount",
                    message: (
                      <div className="py-8 px-4">
                        <Input
                          ref={ref}
                          type="number"
                          defaultValue={order?.orderAmount}
                        />
                      </div>
                    ),
                    onContinue: async () => {
                      const amount = parseInt(ref.current?.value ?? "");
                      if (isNaN(amount)) throw new Error();

                      await order?.updateAmount(amount);
                    },
                  });
                }}
              >
                <PenIcon className="size-3 text-green-600" />
              </button>
            )}
          </div>
          <div>
            <span className="text-zinc-500">Cost</span>{" "}
            <span className="font-medium tabular-nums">
              {order!.actualCost.asLocalCurrency()}
            </span>
          </div>
          {order!.actualCost > order!.orderAmount && (
            <div className="flex items-center gap-1 text-red-600 text-xs">
              <InfoIcon className="size-3" />
              <span className="font-semibold">
                {order!.actualCost.asLocalCurrency()}
              </span>
              &nbsp;
              <span>
                Cost has exceeded paid amount.
              </span>
            </div>
          )}
        </Fragment>
      )}
    </context.Consumer>
  );
};

const ShowAddress = () => {
  const stateRef = useRef<{ getSelection(): string }>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <context.Consumer>
      {(order) => (
        <Fragment>
          <div className="flex gap-2 items-center sm:justify-end">
            {order?.canMutate && !order.isArchived && (
              <button
                onClick={() => {
                  showAlertDialog({
                    title: "State / Address",
                    message: (
                      <div className="py-8 px-4 flex flex-col gap-3">
                        <StateComponent
                          defaultValue={order.state}
                          ref={stateRef}
                        />
                        <Input
                          ref={inputRef}
                          defaultValue={order?.address}
                        />
                      </div>
                    ),
                    onContinue: async () => {
                      await order?.updateAddress({
                        state: stateRef.current!.getSelection(),
                        address: inputRef.current!.value,
                      });
                    },
                  });
                }}
              >
                <PenIcon className="size-3 text-green-600" />
              </button>
            )}
            <div className="font-medium text-zinc-900">{order!.state}</div>
          </div>
          <div className="text-zinc-600">{order!.address}</div>
        </Fragment>
      )}
    </context.Consumer>
  );
};
