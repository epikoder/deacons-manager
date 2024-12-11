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
import { useObserver } from "../@types/observable";

import { Agent } from "../services/agents.service";

import Input from "./Input";
import OrderService from "../services/orders.service/orders.service";
import { CopyIcon, InfoIcon, PenIcon, PhoneIcon } from "./Icons";
import Toast from "../utils/toast";
import StateComponent from "./State.component";

const context = createContext<Order | undefined>(undefined);
export const OrderComponent = forwardRef(({ order }: { order: Order }, ref) => {
  useObserver(order);

  return (
    <context.Provider value={order}>
      <div
        className="rounded-lg shadow-md pt-3 w-full flex flex-col gap-2"
        onClick={() => console.log(order)}
      >
        <div className="flex justify-between items-center px-3">
          <div className="text-[10px] rounded-full px-3 py-px text-white bg-zinc-700">
            {order.source}
          </div>
          <div id="tags" className="flex gap-2 items-center">
            {order.deliveryStatus == "delivered" && (
              <div className="bg-green-500 text-[8px] text-white px-2 py-px rounded-lg">
                DELIVERED
              </div>
            )}
            {order.isNewOrder && (
              <div className="bg-red-500 text-[8px] rotate-45 text-white px-2 py-px rounded-t-full">
                NEW
              </div>
            )}
          </div>
        </div>
        <div className="text-sm px-3">
          <ShowOrderItem />
          <ShowAmount />
        </div>
        <div className="flex justify-between gap-12 items-center px-3">
          <div className="flex flex-col gap-3">
            {order.books && (
              <div className="flex gap-3 items-start text-sm">
                <span className="whitespace-nowrap">
                  Books:
                </span>
                <div className="text-sm flex flex-wrap gap-x-4 gap-y-2">
                  {Object.entries(order.books).map(([name, count]) => (
                    <div key={name} className="flex gap-1 items-end">
                      <span>{count}</span>
                      <span className="font-bold text-xs">X</span>
                      <span className="">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="text-sm space-x-2">
              <span>{"Agent: "}</span>
              <span className="font-semibold">
                {order.agentName ?? "-- not yet assigned --"}
              </span>
              {(order.isComfirmed && order.canMutate) && (
                <span>
                  <ActionAssignAgent>
                    <PenIcon className="size-3 text-green-500" />
                  </ActionAssignAgent>
                </span>
              )}
            </div>
            {order.deliveryStatus === "delivered" && (
              <div className="text-sm">
                <span>{"Delivery Charge: "}</span>
                <span className="font-semibold">
                  {order.deliveryCost
                    ? order.deliveryCost.asLocalCurrency()
                    : "--"}
                </span>
              </div>
            )}
            <div className="text-sm space-x-2">
              <span>{"Office Charge: "}</span>
              <span className="font-semibold">
                {order.officeCharge
                  ? order.officeCharge.asLocalCurrency()
                  : "--"}
              </span>
            </div>
          </div>
          <div className="text-sm text-right flex flex-col items-end gap-1">
            <div className="font-semibold">{order.customerName}</div>
            <div className="flex items-center gap-3">
              <a
                className="flex gap-2 w-fit items-center"
                href={`tel:${order.phone}`}
              >
                <PhoneIcon className="size-3 text-blue-500" />
                <div>{order.phone}</div>
              </a>
              <button
                className="px-1"
                onClick={() => {
                  navigator.clipboard.writeText(order.phone);
                  alert("copied!!");
                }}
              >
                <CopyIcon className="size-4" />
              </button>
            </div>
            <div className="font-bold">{order.email ?? "-- no email --"}</div>
            <ShowAddress />
            <div className="text-xs">{order.date}</div>
          </div>
        </div>
        {order.deliveryStatus === "delivered" && order.deliveredOn && (
          <div className="px-4 py-2 space-y-2 border-t text-sm">
            <div>
              <span>Affiliate earning:</span>{" "}
              <span className="font-semibold">
                {order.affiliateEarning.asLocalCurrency()}
              </span>
            </div>
            <div>
              <span>Agent earning:</span>{" "}
              <span className="font-semibold">
                {order.agentEarning.asLocalCurrency()}
              </span>
            </div>
            <div className="text-xs font-semibold">
              <span>
                {"Delivered: "}
              </span>{" "}
              {order.deliveredOn.string}
            </div>
          </div>
        )}
        {order.canMutate && (
          <div className="flex justify-evenly">
            {!order.isComfirmed && <ActionDelete />}
            {!order.isComfirmed && <ActionConfirm />}
            <ActionUpdateBooks />
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

const _class =
  "cursor-pointer flex-1 text-center text-sm hover:bg-opacity-75 py-1 first:rounded-bl-lg last:rounded-br-lg";

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
          className={`${_class} text-white bg-blue-500`}
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
          className={`${_class} text-white bg-red-500`}
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
                OrderService.instance.deleteOrder(order!);
              },
            })}
        >
          Delete
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
          className={`${_class} text-white bg-green-500`}
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
                Toast.success("Success");
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
          className={`${_class} ${children ? "" : "text-white bg-green-500"}`}
          onClick={() => {
            showAlertDialog({
              title: "Assign Agent",
              message: (
                <div className="min-h-72">
                  <SelectAgent defaultValue={order!.agent} ref={selectorRef} />
                </div>
              ),
              onContinue: () => {
                const agent = selectorRef.current?.getSelected();
                if (!agent) {
                  Toast.error("Please select an Agent to continue");
                  throw new Error("Agent not selected");
                }
                order!.assignAgent(agent);
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
  const ref = useRef<{ onContinue: VoidFunction }>();

  return (
    <context.Consumer>
      {(order) => (
        <button
          className={`${_class} text-white bg-amber-800`}
          onClick={() => {
            showAlertDialog({
              title: "Update delivery status",
              message: <__UpdateDeliveryStatus ref={ref} order={order!} />,
              onContinue: () => ref.current?.onContinue(),
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
        order!.updateDelivery(status, amount);
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
        <div className="flex gap-3 items-center">
          <span>{order!.orderItem}</span>
          {order?.canMutate && (
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
                  onContinue: () => {
                    const item = ref.current?.getItem();
                    if (!item) throw new Error();
                    order?.updateOrderItem(item);
                  },
                });
              }}
            >
              <PenIcon className="size-3 text-green-500" />
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
          <div className="flex gap-3 items-center">
            <div>
              <span className="font-semibold">
                Paid:
              </span>
              &nbsp;
              <span>
                {order!.orderAmount.asLocalCurrency()}
              </span>
            </div>
            {order?.canMutate && (
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
                    onContinue: () => {
                      const amount = parseInt(ref.current?.value ?? "");
                      if (isNaN(amount)) throw new Error();

                      order?.updateAmount(amount);
                    },
                  });
                }}
              >
                <PenIcon className="size-3 text-green-500" />
              </button>
            )}
          </div>
          <div className="mt-4">
            <span className="font-semibold">
              Cost:
            </span>
            &nbsp;
            <span>
              {order!.actualCost.asLocalCurrency()}
            </span>
          </div>
          {order!.actualCost > order!.orderAmount && (
            <div className="flex items-center gap-1 py-3 text-red-500 text-xs">
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
          <div className="flex gap-3 items-center">
            {order?.canMutate && (
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
                    onContinue: () => {
                      order?.updateAddress({
                        state: stateRef.current!.getSelection(),
                        address: inputRef.current!.value,
                      });
                    },
                  });
                }}
              >
                <PenIcon className="size-3 text-green-500" />
              </button>
            )}
            <div className="font-bold">{order!.state}</div>
          </div>
          <div>{order!.address}</div>
        </Fragment>
      )}
    </context.Consumer>
  );
};
