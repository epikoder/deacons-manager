import { ForwardedRef, forwardRef, InputHTMLAttributes, useState } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  resetSize?: boolean;
  validator?: Validator;
}

const Input = forwardRef(
  ({ resetSize, validator, className, ...inputProps }: InputProps, ref) => {
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
        className={`rounded-md border ${_isvalid() ? "border-gray-500" : "border-red-500"
          } px-2 focus-within:border-2 text-sm ${resetSize ? '' : 'w-full'}`}
      >
        <input
          ref={ref as ForwardedRef<HTMLInputElement>}
          placeholder=""
          {...inputProps}
          className={`outline-none hover:outline-none py-1 ${resetSize ? "" : "min-w-44"
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
