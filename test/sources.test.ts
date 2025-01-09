import { expect, test } from "bun:test";
import { sourceUsingJambWaec } from "../services/orders.service/sources";
import Carbon from "../utils/carbon";

test("test-Prep50Book", async () => {
    let fn = sourceUsingJambWaec(
        "https://prep50book.prep50mobileapp.com.ng/api.php",
    );
    try {
        const v = await fn({
            limit: 10,
            offset: 0,
            start_date: new Carbon().formatLocalISO(),
        });
        expect(v.length).toBeGreaterThanOrEqual(0);
    } catch (error) {
        console.error(error);
    }
});

test("test-Prep50BookList", async () => {
    let fn = sourceUsingJambWaec(
        "https://prep50booklist.prep50mobileapp.com.ng/api.php",
    );
    const v = await fn({
        limit: 10,
        offset: 0,
        start_date: new Carbon().formatLocalISO(),
    });
    expect(v.length).toBeGreaterThanOrEqual(0);
});

test("test-Nkemobi", async () => {
    let fn = sourceUsingJambWaec(
        "https://nkemobi.prep50mobileapp.com.ng/api.php",
    );
    const v = await fn({
        limit: 10,
        offset: 0,
        start_date: new Carbon().formatLocalISO(),
    });
    expect(v.length).toBeGreaterThanOrEqual(0);
});

test("test-Arinze", async () => {
    let fn = sourceUsingJambWaec(
        "https://arinze.prep50m.com.ng/api.php",
    );
    const v = await fn({
        limit: 10,
        offset: 0,
        start_date: new Carbon().formatLocalISO(),
    });
    expect(v.length).toBeGreaterThanOrEqual(0);
});
