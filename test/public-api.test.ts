import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as core from "../src/index.js";

const expectedRuntimeExports = [
    "buildTelegramAudioTranscriptPrompt",
    "callPayloadMcpTool",
    "chunkTelegramMessage",
    "createEditorialExtension",
    "createLazyToolsetState",
    "createPayloadMcpToolCaller",
    "createSafePiRpcArgs",
    "createTextResult",
    "downloadTelegramFile",
    "escapeTelegramHtmlText",
    "extractPiMessageText",
    "extractTelegramAudioAttachment",
    "formatPiSessionList",
    "getPiSessionName",
    "getToolNamesForToolsets",
    "isToolsetName",
    "listStoredPiSessions",
    "normalizeToolsets",
    "sanitizeTelegramCodeTags",
    "textFromMcpResult",
    "transcribeTelegramAudio",
    "validateAgainstSchema",
    "validateTelegramAudioLimits",
    "validateToolParams",
].sort();

test("public runtime API exports stay intentional", () => {
    assert.deepEqual(Object.keys(core).sort(), expectedRuntimeExports);

    for (const exportName of expectedRuntimeExports) {
        assert.equal(
            typeof core[exportName as keyof typeof core],
            "function",
            `${exportName} should be a function export`,
        );
    }
});

test("package metadata exposes only the package root", async () => {
    const packageJson = JSON.parse(
        await readFile(new URL("../../package.json", import.meta.url), "utf8"),
    );

    assert.deepEqual(packageJson.exports, {
        ".": {
            types: "./dist/src/index.d.ts",
            import: "./dist/src/index.js",
            default: "./dist/src/index.js",
        },
    });
    assert.deepEqual(packageJson.files, [
        "dist/src",
        "README.md",
        "CHANGELOG.md",
        "docs",
    ]);
});
