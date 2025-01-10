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
        className="whitespace-nowrap cursor-not-allowed"
      >
        {". . ."}
      </div>
    ) : undefined;
  };

  return (
    <div className="flex justify-center gap-1 items-center py-1">
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

const PrevButton = ({
  onClick,
  disabled,
}: {
  onClick: VoidFunction;
  disabled?: boolean;
}) => (
  <button
    className={`mx-3 py-1 px-2 text-sm rounded-sm first:rounded-l-md first:border-l-0 last:rounded-r-md last:border-r-0 hover:bg-opacity-75 ${
      disabled ? "bg-slate-300 text-white cursor-not-allowed" : "bg-slate-300"
    } min-w-8`}
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
    className={`mx-3 py-1 px-2 text-xs rounded-sm first:rounded-l-md first:border-l-0 last:rounded-r-md last:border-r-0 hover:bg-opacity-75 ${
      disabled ? "bg-slate-300 text-white cursor-not-allowed" : "bg-slate-300"
    } min-w-8`}
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
    className={`py-1 px-2 text-xs rounded-sm first:rounded-l-md first:border-l-0 last:rounded-r-md last:border-r-0 hover:bg-opacity-75 ${
      page == current ? "bg-slate-500 text-white" : "bg-slate-300"
    } min-w-8`}
    onClick={onClick}
  >
    {page}
  </button>
);
