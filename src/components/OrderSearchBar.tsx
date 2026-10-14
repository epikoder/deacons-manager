import { useEffect, useId, useRef, useState } from "react";
import {
  OrderSearch,
  orderPatternRange,
  parseSearchPrefix,
  SCOPE_LABEL,
  SearchScope,
  suggestScopes,
} from "../services/orders.service/search";
import {
  ActivityIndicator,
  ChevronDown,
  ChevronUp,
  CloseIcon,
  SearchIcon,
} from "./Icons";

const OPTION_TEXT: Record<SearchScope, (t: string) => string> = {
  all: (t) => `Search all fields for “${t}”`,
  order: (t) => {
    const range = orderPatternRange(t);
    return range ? `Order numbers ${range}` : `Order number is ${t}`;
  },
  name: (t) => `Customer name contains “${t}”`,
  phone: (t) => `Phone contains ${t}`,
};

/**
 * The orders search box. Typing searches every field as before; the dropdown offers
 * to narrow it to one field, which then shows as a chip ("Order number:") and makes
 * the search exact. "order number: 1727", "#1727", "name: Ada" and "phone: 0803"
 * typed by hand turn into the same chip.
 *
 * `onSearch` is called with a delay in ms: 0 for a deliberate choice, a short
 * debounce while typing.
 */
export default function OrderSearchBar(
  { onSearch, loading }: {
    onSearch: (search: OrderSearch, delay: number) => void;
    loading?: boolean;
  },
) {
  const [scope, setScope] = useState<SearchScope>("all");
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Only offered while there is no chip yet; with one, the field is already chosen.
  const options = scope === "all" ? suggestScopes(text) : [];
  const showList = open && options.length > 1;

  useEffect(() => setActive(0), [text, scope]);

  const emit = (next: OrderSearch, delay: number) => onSearch(next, delay);

  const choose = (next: SearchScope) => {
    setScope(next);
    setOpen(false);
    emit({ scope: next, text }, 0);
    inputRef.current?.focus();
  };

  const clearScope = () => {
    setScope("all");
    emit({ scope: "all", text }, 0);
    setOpen(true);
    inputRef.current?.focus();
  };

  const clearAll = () => {
    setScope("all");
    setText("");
    setOpen(false);
    emit({ scope: "all", text: "" }, 0);
    inputRef.current?.focus();
  };

  const onChange = (value: string) => {
    // A typed prefix becomes the chip, and only the value stays in the box.
    const parsed = scope === "all" ? parseSearchPrefix(value) : null;
    if (parsed) {
      setScope(parsed.scope);
      setText(parsed.text);
      setOpen(false);
      emit(parsed, 300);
      return;
    }
    setText(value);
    setOpen(true);
    emit({ scope, text: value }, 300);
  };

  return (
    <div className="w-full max-w-md">
      <div className="relative">
        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white pl-3 pr-1.5 transition-shadow focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500/20">
          <SearchIcon className="size-4 shrink-0 text-zinc-400" />
          {scope !== "all" && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-green-50 py-0.5 pl-2 pr-0.5 text-xs font-medium text-green-800 ring-1 ring-inset ring-green-600/30">
              {SCOPE_LABEL[scope]}:
              <button
                type="button"
                aria-label={`Stop searching only ${SCOPE_LABEL[scope].toLowerCase()}`}
                className="rounded p-0.5 hover:bg-green-100"
                onClick={clearScope}
              >
                <CloseIcon className="size-3" />
              </button>
            </span>
          )}
          <input
            ref={inputRef}
            name="search"
            type="search"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList ? `${listId}-${active}` : undefined}
            value={text}
            autoComplete="off"
            placeholder={scope === "all"
              ? "Search name, phone or order number…"
              : scope === "order"
              ? "e.g. 1727"
              : scope === "phone"
              ? "Any part of the number"
              : "Any part of the name"}
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-zinc-400 [&::-webkit-search-cancel-button]:hidden"
            onChange={(ev) => onChange(ev.currentTarget.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(ev) => {
              if (ev.key === "ArrowDown" && showList) {
                ev.preventDefault();
                setActive((i) => (i + 1) % options.length);
              } else if (ev.key === "ArrowUp" && showList) {
                ev.preventDefault();
                setActive((i) => (i - 1 + options.length) % options.length);
              } else if (ev.key === "Enter") {
                ev.preventDefault();
                if (showList) choose(options[active]);
                else emit({ scope, text }, 0);
              } else if (ev.key === "Escape") {
                // A search input clears itself on Escape; the first press should
                // only close the list, the second clears (through clearAll, so the
                // chip and the results go too).
                ev.preventDefault();
                if (showList) setOpen(false);
                else clearAll();
              } else if (
                ev.key === "Backspace" && scope !== "all" &&
                ev.currentTarget.selectionStart === 0 &&
                ev.currentTarget.selectionEnd === 0
              ) {
                // Backspace at the start removes the chip, like a token field.
                ev.preventDefault();
                clearScope();
              }
            }}
          />
          {loading && text.trim()
            ? <ActivityIndicator active className="m-1 size-4 text-zinc-400" />
            : (text || scope !== "all") && (
              <button
                type="button"
                aria-label="Clear search"
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                onClick={clearAll}
              >
                <CloseIcon className="size-4" />
              </button>
            )}
        </div>

        {showList && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Search in"
            className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg"
          >
            {options.map((o, i) => (
              <li
                key={o}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown, not click: click fires after the input's blur has
                // already closed the list.
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  choose(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 ${
                  i === active ? "bg-zinc-100" : ""
                }`}
              >
                <span className="truncate text-zinc-800">
                  {OPTION_TEXT[o](text.trim())}
                </span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {i === active ? "Enter ↵" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const Code = ({ children }: { children: string }) => (
  <code className="rounded bg-zinc-100 px-1 py-px font-mono text-[11px] text-zinc-700">
    {children}
  </code>
);

const HELP_KEY = "orders_search_help_open";

/**
 * What the search box understands. Full width under the search row, one line by
 * default; opening it is remembered per browser.
 */
export function SearchHelp() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      setOpen(localStorage.getItem(HELP_KEY) === "1");
    } catch {
      // Storage blocked: stays collapsed, the toggle still works.
    }
  }, []);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(HELP_KEY, next ? "1" : "0");
    } catch {
      // As above.
    }
  };

  return (
    <div className="w-full text-xs leading-5 text-zinc-500">
      <div className="flex items-start gap-2">
        <div className={`min-w-0 flex-1 ${open ? "" : "truncate"}`}>
          {open
            ? (
              <div className="space-y-0.5">
                <p>
                  Searches customer name, phone and order number. Pick a field
                  from the list as you type, or type it:{" "}
                  <Code>order number: 1727</Code> (or <Code>#1727</Code>),{" "}
                  <Code>name: Ada</Code>, <Code>phone: 0803</Code>.
                </p>
                <p>
                  In an order number, <Code>x</Code> stands for any digit:{" "}
                  <Code>1xx</Code> finds #100–#199, <Code>17x</Code>{" "}
                  finds #170–#179. With the Order number field chosen, the number
                  must match exactly; without it, <Code>67</Code> also finds #767
                  and #1067.
                </p>
              </div>
            )
            : (
              <>
                Search name, phone or order number. Narrow it with{" "}
                <Code>order number: 1727</Code>, <Code>#1727</Code>,{" "}
                <Code>name: Ada</Code> or <Code>phone: 0803</Code>; use{" "}
                <Code>1xx</Code> for #100–#199.
              </>
            )}
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={toggle}
          className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
        >
          {open ? "Less" : "More"}
          {open
            ? <ChevronUp className="size-3.5" />
            : <ChevronDown className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}
