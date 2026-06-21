import assert from "node:assert/strict";
import test from "node:test";

import { createTextResult } from "../src/responses/result.js";

test("createTextResult returns Pi-compatible text content", () => {
    assert.deepEqual(createTextResult("hello"), { content: [{ type: "text", text: "hello" }] });
});

test("createTextResult includes details only when provided", () => {
    assert.deepEqual(createTextResult("ok", { kind: "example" }), {
        content: [{ type: "text", text: "ok" }],
        details: { kind: "example" },
    });
});
