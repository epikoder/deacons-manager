import { ButtonHTMLAttributes, cloneElement, ReactNode } from "react";
import { useRipple } from "../hooks/useRipple";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  title?: string;
  children?: ReactNode;
}

export default function Button({
  title,
  children,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const ref = useRipple<HTMLButtonElement>();

  return (
    <button
      ref={ref}
      {...props}
      className={`rounded-lg text-white px-5 py-1.5 text-sm font-medium shadow-sm transition-opacity hover:opacity-90 ${disabled ? "!bg-zinc-300 cursor-not-allowed" : ""} ${className ?? ""}`}
      disabled={disabled}
    >
      {children ?? title}
    </button>
  );
}
