import { isValidPhoneNumber } from "libphonenumber-js";

export const emailValidator: Validator = (txt) => {
    const emailRegex: RegExp =
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(txt ?? "") ? null : "email is invalid";
};

export const phoneValidator: Validator = (
    phone?: NullString,
): NullString => {
    return isValidPhoneNumber(phone ?? "") ? null : "phone is invalid";
};
