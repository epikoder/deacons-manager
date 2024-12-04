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
      className={`rounded-md text-white px-8 py-1 text-sm ${disabled ? "bg-gray-300 cursor-none" : ""} ${className ?? ""}`}
      disabled={disabled}
    >
      {children ?? title}
    </button>
  );
}
