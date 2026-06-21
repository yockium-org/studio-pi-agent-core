import assert from "node:assert/strict";
import test from "node:test";

import { createEditorialExtension, createTextResult, type EditorialAgentAdapter } from "../src/index.js";

type ToolName = "listCapabilities" | "loadToolset" | "listThings" | "createDraft";
type ToolsetName = "discovery" | "drafting";

const createHarness = () => {
    const eventHandlers = new Map<string, (...args: unknown[]) => void>();
    const tools = new Map<string, any>();
    let activeTools: readonly string[] = [];
    const pi = {
        on(eventName: "session_start", handler: (...args: unknown[]) => void) {
            eventHandlers.set(eventName, handler);
        },
        registerTool(definition: Record<string, unknown>) {
            tools.set(String(definition.name), definition);
        },
        setActiveTools(toolNames: readonly ToolName[]) {
            activeTools = toolNames;
        },
    };
    return { eventHandlers, get activeTools() { return activeTools; }, pi, tools };
};

const readToolJson = (result: any) => JSON.parse(result.content[0].text);

const createAdapter = (): EditorialAgentAdapter<ToolName, ToolsetName> => ({
    id: "example",
    label: "Example adapter",
    schemaGuard: { locale: { supported: ["nl"], defaultLocale: "nl", routing: "Studio Selah currently uses nl only.", correction: "Use explicit locale 'nl'." } },
    tools: {
        baseToolNames: ["listCapabilities", "loadToolset"],
        toolsets: { discovery: ["listThings"], drafting: ["createDraft"] },
        createTools: (ctx) => ({
            listCapabilities: {
                name: "listCapabilities",
                parameters: { type: "object", properties: {} },
                execute: async () => createTextResult(JSON.stringify({ activeToolsets: [...ctx.getActiveLazyToolsets()] })),
            },
            loadToolset: {
                name: "loadToolset",
                parameters: {
                    type: "object",
                    required: ["toolsets"],
                    properties: {
                        toolsets: { type: "array", minItems: 1, items: { anyOf: [{ const: "discovery" }, { const: "drafting" }] } },
                        mode: { anyOf: [{ const: "append" }, { const: "replace" }] },
                    },
                },
                execute: async (_toolCallId, params = {}) => {
                    const activeToolsets = ctx.activateToolsets(
                        Array.isArray(params.toolsets) ? params.toolsets.map(String) : [],
                        params.mode === "replace" ? "replace" : "append",
                    );
                    return createTextResult(JSON.stringify({ activeToolsets, activeTools: ctx.getActiveToolNames() }));
                },
            },
            listThings: { name: "listThings", parameters: { type: "object", properties: {} }, execute: async () => createTextResult("[]") },
            createDraft: {
                name: "createDraft",
                parameters: { type: "object", required: ["locale", "title"], properties: { locale: { const: "nl" }, title: { type: "string", minLength: 1 } } },
                execute: async () => createTextResult(JSON.stringify({ ok: true })),
            },
        }),
    },
});

test("createEditorialExtension registers adapter tools and activates base tools on session start", () => {
    const harness = createHarness();
    createEditorialExtension(createAdapter())(harness.pi);
    assert.deepEqual([...harness.tools.keys()], ["listCapabilities", "loadToolset", "listThings", "createDraft"]);
    harness.eventHandlers.get("session_start")?.();
    assert.deepEqual(harness.activeTools, ["listCapabilities", "loadToolset"]);
});

test("load toolset tool can use extension context to update active tools", async () => {
    const harness = createHarness();
    createEditorialExtension(createAdapter())(harness.pi);
    harness.eventHandlers.get("session_start")?.();
    const result = await harness.tools.get("loadToolset").execute("call-1", { toolsets: ["discovery"] });
    const payload = readToolJson(result);
    assert.deepEqual(payload.activeToolsets, ["discovery"]);
    assert.deepEqual(harness.activeTools, ["listCapabilities", "loadToolset", "listThings"]);
});

test("registered tool execution is guarded before adapter execute runs", async () => {
    const harness = createHarness();
    createEditorialExtension(createAdapter())(harness.pi);
    const result = await harness.tools.get("createDraft").execute("call-2", { title: "Approved draft" });
    const payload = readToolJson(result);
    assert.equal(payload.ok, false);
    assert.equal(payload.error, "schema_validation_failed");
    assert.equal(payload.tool, "createDraft");
    assert.deepEqual(payload.locale.supported, ["nl"]);
    assert.deepEqual(payload.issues.map((issue: any) => issue.path), ["params.locale"]);
});
