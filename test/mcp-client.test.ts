import assert from "node:assert/strict";
import test from "node:test";

import { callPayloadMcpTool, textFromMcpResult } from "../src/mcp/payload-mcp-client.js";

test("textFromMcpResult joins text entries and stringifies non-text content", () => {
    assert.equal(
        textFromMcpResult({ content: [{ type: "text", text: "one" }, { type: "image", data: "abc" }, { type: "text", text: "two" }] }),
        'one\n{"type":"image","data":"abc"}\ntwo',
    );
});

test("textFromMcpResult stringifies unknown result shapes", () => {
    assert.equal(textFromMcpResult({ ok: true }), JSON.stringify({ ok: true }, null, 2));
});

test("callPayloadMcpTool fails fast when API key is required but absent", async () => {
    await assert.rejects(
        () =>
            callPayloadMcpTool(
                { url: "http://127.0.0.1:1/api/mcp", clientName: "test-client", clientVersion: "0.0.0", apiKeyName: "TEST_MCP_API_KEY" },
                "listThings",
            ),
        /TEST_MCP_API_KEY is not configured/,
    );
});
