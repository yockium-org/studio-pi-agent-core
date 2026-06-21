import assert from "node:assert/strict";
import test from "node:test";

import { validateAgainstSchema, validateToolParams } from "../src/guards/schema-guard.js";

const localeOptions = {
    locale: {
        supported: ["nl", "en"],
        defaultLocale: "nl",
        routing: "nl has no URL prefix; en uses /en.",
        updateRule: "Use the same locale that was read/reviewed.",
        correction: "Use explicit locale 'nl' or 'en'. Do not infer locale from chat language.",
    },
};

const readToolJson = (result: any) => JSON.parse(result.content[0].text);

test("validateAgainstSchema returns no issues for valid object input", () => {
    const issues = validateAgainstSchema(
        {
            type: "object",
            required: ["title", "locale"],
            properties: {
                title: { type: "string", minLength: 1 },
                locale: { anyOf: [{ const: "nl" }, { const: "en" }] },
                limit: { type: "number", minimum: 1, maximum: 10 },
            },
        },
        { title: "Draft", locale: "nl", limit: 5 },
        "params",
        localeOptions,
    );
    assert.deepEqual(issues, []);
});

test("validateToolParams returns structured feedback with adapter locale guidance", () => {
    const result = validateToolParams(
        "createDraft",
        {
            type: "object",
            required: ["locale", "title"],
            properties: {
                locale: { anyOf: [{ const: "nl" }, { const: "en" }] },
                title: { type: "string", minLength: 1 },
            },
        },
        { title: "Draft" },
        localeOptions,
    );
    assert.ok(result);
    const payload = readToolJson(result);
    assert.equal(payload.ok, false);
    assert.equal(payload.error, "schema_validation_failed");
    assert.equal(payload.tool, "createDraft");
    assert.deepEqual(payload.locale.supported, ["nl", "en"]);
    assert.deepEqual(payload.issues.map((issue: any) => issue.path), ["params.locale"]);
    assert.match(payload.issues[0].correction, /explicit locale/);
    assert.equal(result.details?.kind, "toolSchemaGuard");
});

test("validateAgainstSchema validates arrays, integer bounds, and nested paths", () => {
    const issues = validateAgainstSchema(
        {
            type: "object",
            properties: {
                items: {
                    type: "array",
                    minItems: 2,
                    items: {
                        type: "object",
                        required: ["id"],
                        properties: { id: { type: "integer", minimum: 1 } },
                    },
                },
            },
        },
        { items: [{ id: 0.5 }] },
    );
    assert.deepEqual(issues.map((issue) => issue.path), ["params.items", "params.items[0].id"]);
    const [minItemsIssue, integerIssue] = issues;
    assert.ok(minItemsIssue);
    assert.ok(integerIssue);
    assert.match(minItemsIssue.correction, /at least 2/);
    assert.match(integerIssue.correction, /integer/);
});
