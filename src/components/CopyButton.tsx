import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "./Icons";

/**
 * Copies `value` and says so with a small "Copied" label under the icon - no alert()
 * to dismiss between every phone number.
 */
export default function CopyButton(
  { value, label = "Copy", className }: {
    value?: string | null;
    label?: string;
    className?: string;
  },
) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!value) return null;

  const copy = async () => {
    let ok = true;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      ok = fallbackCopy(value);
    }
    setState(ok ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1500);
  };

  return (
    <span className={`relative inline-flex ${className ?? ""}`}>
      <button
        type="button"
        title={label}
        aria-label={label}
        className={`p-1 rounded-md transition-colors ${
          state === "copied"
            ? "text-green-600"
            : "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
        }`}
        onClick={(ev) => {
          ev.stopPropagation();
          copy();
        }}
      >
        {state === "copied"
          ? <CheckIcon className="size-3.5" strokeWidth={2.5} />
          : <CopyIcon className="size-3.5" />}
      </button>
      <span
        aria-live="polite"
        className={`pointer-events-none absolute z-10 left-1/2 top-full -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-px text-[10px] font-medium leading-4 transition-opacity duration-150 ${
          state === "idle" ? "opacity-0" : "opacity-100"
        } ${
          state === "failed"
            ? "bg-red-600 text-white"
            : "bg-zinc-800 text-white"
        }`}
      >
        {state === "failed" ? "Copy failed" : state === "copied" ? "Copied" : ""}
      </span>
    </span>
  );
}

/** navigator.clipboard is unavailable outside a secure context. */
function fallbackCopy(value: string) {
  const el = document.createElement("textarea");
  el.value = value;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  el.remove();
  return ok;
}
