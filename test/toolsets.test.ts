import assert from "node:assert/strict";
import test from "node:test";

import { createLazyToolsetState, getToolNamesForToolsets, isToolsetName, normalizeToolsets } from "../src/registry/toolsets.js";

const config = {
    baseToolNames: ["listCapabilities", "loadToolset"] as const,
    toolsets: {
        discovery: ["listArticles", "listTopics"],
        drafting: ["createDraft", "listArticles"],
    },
};

test("getToolNamesForToolsets returns base tools plus selected toolsets without duplicates", () => {
    assert.deepEqual(getToolNamesForToolsets(config, ["discovery", "drafting"]), [
        "listCapabilities",
        "loadToolset",
        "listArticles",
        "listTopics",
        "createDraft",
    ]);
});

test("normalizeToolsets filters unknown toolsets", () => {
    assert.equal(isToolsetName(config.toolsets, "discovery"), true);
    assert.equal(isToolsetName(config.toolsets, "unknown"), false);
    assert.deepEqual(normalizeToolsets(config, ["unknown", "drafting"]), ["drafting"]);
});

test("createLazyToolsetState appends, replaces, and resets active toolsets", () => {
    const state = createLazyToolsetState(config);
    assert.deepEqual(state.getActiveToolNames(), ["listCapabilities", "loadToolset"]);
    assert.deepEqual(state.activateToolsets(["discovery"]), ["discovery"]);
    assert.deepEqual(state.activateToolsets(["drafting"]), ["discovery", "drafting"]);
    assert.deepEqual(state.getActiveToolNames(), ["listCapabilities", "loadToolset", "listArticles", "listTopics", "createDraft"]);
    assert.deepEqual(state.activateToolsets(["drafting"], "replace"), ["drafting"]);
    assert.deepEqual(state.getActiveToolNames(), ["listCapabilities", "loadToolset", "createDraft", "listArticles"]);
    state.reset();
    assert.deepEqual(state.getActiveToolsets(), new Set());
    assert.deepEqual(state.getActiveToolNames(), ["listCapabilities", "loadToolset"]);
});
