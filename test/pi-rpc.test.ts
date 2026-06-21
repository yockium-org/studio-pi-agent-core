import assert from "node:assert/strict";
import test from "node:test";

import { createSafePiRpcArgs, extractPiMessageText } from "../src/index.js";

test("createSafePiRpcArgs disables risky pi inputs by default", () => {
    const args = createSafePiRpcArgs({
        sessionDir: "/sessions",
        systemPrompt: "System prompt",
        extensionPath: "/agent/editorial-extension.js",
        name: "telegram-123",
    });

    assert.deepEqual(args, [
        "--mode",
        "rpc",
        "--session-dir",
        "/sessions",
        "--no-builtin-tools",
        "--no-context-files",
        "--no-prompt-templates",
        "--no-themes",
        "--append-system-prompt",
        "System prompt",
        "--extension",
        "/agent/editorial-extension.js",
        "--name",
        "telegram-123",
    ]);
});

test("createSafePiRpcArgs can opt into model and explicitly reviewed extra args", () => {
    const args = createSafePiRpcArgs({
        sessionDir: "/sessions",
        systemPrompt: "Prompt",
        extensionPath: "/extension.js",
        name: "session-name",
        model: "openai/gpt-5.2",
        extraArgs: ["--some-future-safe-flag"],
    });

    assert.deepEqual(args.slice(-3), [
        "--model",
        "openai/gpt-5.2",
        "--some-future-safe-flag",
    ]);
    assert.equal(args.includes("--no-builtin-tools"), true);
});

test("extractPiMessageText joins text-like assistant content parts", () => {
    assert.equal(
        extractPiMessageText({
            content: [
                { type: "text", text: "Hello" },
                " ",
                { content: "world" },
                { type: "image", data: "ignored" },
            ],
        }),
        "Hello world",
    );
});

test("extractPiMessageText returns an empty string for unknown shapes", () => {
    assert.equal(extractPiMessageText(null), "");
    assert.equal(extractPiMessageText({ content: [{ noText: true }] }), "");
});
