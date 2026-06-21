import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as core from "../src/index.js";

const expectedFunctionExports = [
    "buildTelegramAudioTranscriptPrompt",
    "callPayloadMcpTool",
    "chunkTelegramMessage",
    "consultSpecialists",
    "createConsultSpecialistsTool",
    "createEditorialExtension",
    "createEditorialSpecialistPolicy",
    "createEditorialSpecialistRegistry",
    "createEditorialSpecialistRouter",
    "createEditorialSpecialistSkills",
    "createKeywordSpecialistRouter",
    "createLazyToolsetState",
    "createPayloadMcpToolCaller",
    "createSafePiRpcArgs",
    "createSpecialistRegistry",
    "createTextResult",
    "defineSpecialistSkill",
    "downloadTelegramFile",
    "escapeTelegramHtmlText",
    "extractPiMessageText",
    "extractTelegramAudioAttachment",
    "formatPiSessionList",
    "getEditorialSpecialistPrompt",
    "getPiSessionName",
    "getToolNamesForToolsets",
    "isSpecialistAllowedByPolicy",
    "isToolsetName",
    "listStoredPiSessions",
    "normalizeToolsets",
    "routeSpecialists",
    "sanitizeTelegramCodeTags",
    "textFromMcpResult",
    "transcribeTelegramAudio",
    "validateAgainstSchema",
    "validateTelegramAudioLimits",
    "validateToolParams",
].sort();

const expectedValueExports = [
    "deniedEditorialSpecialistCapabilities",
    "editorialSpecialistCapabilities",
    "editorialSpecialistIds",
    "safeEditorialSpecialistCapabilities",
].sort();

const expectedRuntimeExports = [...expectedFunctionExports, ...expectedValueExports].sort();

test("public runtime API exports stay intentional", () => {
    assert.deepEqual(Object.keys(core).sort(), expectedRuntimeExports);

    for (const exportName of expectedFunctionExports) {
        assert.equal(
            typeof core[exportName as keyof typeof core],
            "function",
            `${exportName} should be a function export`,
        );
    }

    for (const exportName of expectedValueExports) {
        assert(Array.isArray(core[exportName as keyof typeof core]), `${exportName} should be an array export`);
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
