import { isValidPhoneNumber } from "libphonenumber-js";

export const emailValidator: Validator = (txt) => {
    const emailRegex: RegExp =
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(txt ?? "") ? null : "email is invalid";
};

export const phoneValidator: Validator = (
    phone?: NullString,
): NullString => {
    // Without a default country isValidPhoneNumber("08031234567") is false: only
    // +234... passed, so the format everyone actually types was rejected.
    return isValidPhoneNumber(phone ?? "", "NG") ? null : "phone is invalid";
};
