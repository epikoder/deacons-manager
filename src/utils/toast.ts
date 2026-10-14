import Toastify, {} from "toastify-js";

/** Toast text is inserted as HTML; anything from the server goes through this first. */
export const escapeHtml = (s: string) =>
    String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Top centre: bottom-right sat over the primary button of every form and dialog, and
// with stopOnFocus a toast under the cursor never went away, so the next click on
// that button hit the toast instead.
const Toast = {
    success(text: string) {
        Toastify({
            text: `<p class="flex items-center gap-4">
            <span class="text-green-500 text-base">
             &check;
            </span>
            <span>
            ${text}
            </span>
            </p>`,
            duration: 2000,
            close: true,
            gravity: "top",
            position: "center",
            className: "toast border-green-500 border",
            style: {},
            stopOnFocus: true,
            escapeMarkup: false,
        }).showToast();
    },

    error(text?: string) {
        Toastify({
            text: `<p class="flex items-center gap-4">
            <span class="text-yellow-500 text-base">
             &#10071;
            </span>
            <span>
            ${text ?? "Something went wrong"}
            </span>
            </p>`,
            duration: 2000,
            close: true,
            gravity: "top",
            position: "center",
            className: "toast border-red-700 border",
            style: {},
            stopOnFocus: true,
            escapeMarkup: false,
        }).showToast();
    },
    waring(text: string) {
        Toastify({
            text: `<p class="flex items-center gap-4">
            <span class="text-yellow-500 text-base">
             &#9888;
            </span>
            <span>
            ${text}
            </span>
            </p>`,
            duration: 2000,
            close: true,
            gravity: "top",
            position: "center",
            className: "toast border-yellow-700 border",
            style: {},
            stopOnFocus: true,
            escapeMarkup: false,
        }).showToast();
    },
};

export default Toast;
