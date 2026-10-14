import { ReactNode } from "react";
import { ChevronDoubleBackward, ChevronDoubleForward } from "./Icons";

export interface PaginationProp {
  onNavigate(page: number): void;
  total: number;
  perPage: number;
  page?: number;
  maxNav?: number;
  skipCount?: number;
}

export default function Pagination({
  onNavigate,
  total,
  maxNav = 8,
  page = 1,
  perPage,
  skipCount = 5,
}: PaginationProp) {
  if (!total) return;
  maxNav = maxNav < 2 ? 2 : maxNav;
  const pageCount = Math.floor(total / perPage) + (total % perPage > 0 ? 1 : 0);
  const mid = Math.floor(maxNav / 2);

  const showButton = (index: number): ReactNode => {
    const isStart = index === 0 || index === 1;
    const isEnd = index === pageCount;
    return isStart ||
      isEnd ||
      page === index ||
      (page > index ? page - mid <= index : page + mid >= index) ? (
      <NavigateButton
        key={index}
        onClick={() => onNavigate(index)}
        page={index}
        current={page}
      />
    ) : undefined;
  };

  const showDot = (index: number): ReactNode => {
    return page - mid - 2 == index || page + mid == index ? (
      <div
        key={`dot-${index}`}
        className="whitespace-nowrap px-1 text-zinc-400 select-none"
      >
        {"…"}
      </div>
    ) : undefined;
  };

  return (
    <div className="flex flex-wrap justify-center gap-1 items-center py-1">
      <PrevButton
        disabled={page == 1}
        onClick={() => onNavigate(page - skipCount <= 0 ? 1 : page - skipCount)}
      />
      {Array.from(Array(pageCount).keys()).map(
        (page) => showButton(page + 1) ?? showDot(page),
      )}
      <FowardButton
        disabled={page == pageCount}
        onClick={() =>
          onNavigate(
            page + skipCount > pageCount ? pageCount : page + skipCount,
          )
        }
      />
    </div>
  );
}

const navClass = (disabled?: boolean) =>
  `mx-2 inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-lg border text-sm transition-colors ${
    disabled
      ? "border-zinc-200 text-zinc-300 cursor-not-allowed"
      : "border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50"
  }`;

const PrevButton = ({
  onClick,
  disabled,
}: {
  onClick: VoidFunction;
  disabled?: boolean;
}) => (
  <button
    aria-label="Previous pages"
    className={navClass(disabled)}
    onClick={!disabled ? onClick : undefined}
  >
    <ChevronDoubleBackward className="size-4" />
  </button>
);

const FowardButton = ({
  onClick,
  disabled,
}: {
  onClick: VoidFunction;
  disabled?: boolean;
}) => (
  <button
    aria-label="Next pages"
    className={navClass(disabled)}
    onClick={!disabled ? onClick : undefined}
  >
    <ChevronDoubleForward className="size-4" />
  </button>
);

const NavigateButton = ({
  onClick,
  page,
  current,
}: {
  onClick: VoidFunction;
  current: number;
  page: number;
}) => (
  <button
    aria-current={page == current ? "page" : undefined}
    className={`h-8 min-w-8 px-2 rounded-lg text-xs font-medium tabular-nums transition-colors ${
      page == current
        ? "bg-zinc-900 text-white"
        : "text-zinc-600 hover:bg-zinc-100"
    }`}
    onClick={onClick}
  >
    {page}
  </button>
);
