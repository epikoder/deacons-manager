import {
  ForwardedRef,
  forwardRef,
  HTMLAttributes,
  InputHTMLAttributes,
  useState,
} from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  resetSize?: boolean;
  validator?: Validator;
  sx?: HTMLAttributes<HTMLDivElement>["className"];
}

const Input = forwardRef(
  ({ resetSize, validator, className, sx, ...inputProps }: InputProps, ref) => {
    const [txt, setTxt] = useState(inputProps.defaultValue);
    const _isvalid = () => {
      if (txt == undefined) return true;
      const required = inputProps.required;
      if (validator) {
        return validator(txt as NullString) == null;
      }
      return required ? (String(txt).length > 0 ? true : false) : true;
    };

    return (
      <div
        className={`rounded-lg border bg-white ${
          inputProps.disabled
            ? "border-zinc-200 bg-zinc-50"
            : _isvalid()
            ? "border-zinc-300 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500/20"
            : "border-red-500 focus-within:ring-2 focus-within:ring-red-500/20"
        } px-2.5 transition-shadow text-sm ${resetSize ? "" : "w-full"} ${
          sx ?? ""
        }`}
      >
        <input
          ref={ref as ForwardedRef<HTMLInputElement>}
          placeholder=""
          {...inputProps}
          className={`outline-none hover:outline-none bg-transparent py-1.5 ${
            resetSize ? "" : "min-w-32"
          } w-full ${className}`}
          onBlur={(ev) => {
            inputProps.onBlur && inputProps.onBlur(ev);
            setTxt(ev.currentTarget.value);
          }}
          onChange={(ev) => {
            inputProps.onChange && inputProps.onChange(ev);
            setTxt(ev.currentTarget.value);
          }}
        />
      </div>
    );
  },
);

export default Input;
