import { Fragment, ReactNode, useRef } from "react";
import { createRoot } from "react-dom/client";

export const showDialog = (
  dialog: ({ closeFn }: { closeFn: VoidFunction }) => ReactNode,
  useWidth = true,
) => {
  const container = document.createElement("div");

  const root = createRoot(container);
  root.render(
    <Dialog closeFn={(el) => el.remove()} useWidth={useWidth}>
      {dialog}
    </Dialog>,
  );

  document.body.append(container);
};

export const showAlertDialog = ({
  title,
  message,
  onCancel,
  onContinue,
  confirmLabel = "Continue",
  destructive = false,
}: {
  title: ReactNode;
  message: ReactNode;
  onContinue: VoidFunction;
  onCancel?: VoidFunction;
  confirmLabel?: string;
  /** Red confirm button, for actions like removing an account. */
  destructive?: boolean;
}) => {
  const container = document.createElement("div");
  const closeFn = (el: HTMLDivElement) => el.remove();

  const root = createRoot(container);
  root.render(
    <Dialog closeFn={closeFn}>
      {({ closeFn }) => (
        <Fragment>
          <div className={"px-5 pt-4 pb-2 font-semibold"}>{title}</div>
          <div className={"px-5 py-2 text-sm overflow-y-auto h-full max-h-[80vh]"}>{message}</div>
          <div className={"flex justify-end gap-2 px-5 pb-4 pt-3 text-sm"}>
            <button
              className={
                "px-4 py-1.5 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              }
              onClick={() => {
                onCancel && onCancel();
                closeFn();
              }}
            >
              Cancel
            </button>
            <button
              className={`px-4 py-1.5 rounded-lg text-white font-medium ${
                destructive
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
              onClick={async () => {
                try {
                  await onContinue();
                  closeFn();
                } catch (_) {
                  console.debug("Dialog",_);
                }
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </Fragment>
      )}
    </Dialog>,
  );
  document.body.append(container);
};

type CloseFn = (ev: HTMLDivElement) => void;
export default function Dialog({
  children,
  closeFn,
  useWidth = true,
}: {
  useWidth?: boolean;
  closeFn: CloseFn;
  children?:
    | (({ closeFn }: { closeFn: VoidFunction }) => ReactNode)
    | ReactNode;
}) {
  const __container_ref = useRef<HTMLDivElement>(null);
  const __ref = useRef<HTMLDivElement>(null);

  children =
    typeof children == "function"
      ? children({
          closeFn: () => {
            __container_ref.current?.parentElement?.remove();
          },
        })
      : children;

  return (
    <div
      ref={__container_ref}
      className={
        "fixed z-[99] inset-0 w-[100vw] h-[100vh] bg-zinc-900/30 backdrop-blur-[2px] flex flex-col justify-center items-center p-4"
      }
      onClick={(ev) => {
        ev.stopPropagation();
        closeFn(ev.currentTarget.parentElement! as HTMLDivElement);
      }}
    >
      <div
        className={`${
          useWidth ? "w-full max-w-sm min-w-64" : "w-fit"
        }  mx-auto`}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div
          ref={__ref}
          className={"rounded-xl shadow-xl ring-1 ring-black/5 bg-white bg-opacity-100 w-full"}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
