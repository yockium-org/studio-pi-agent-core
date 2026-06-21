import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
    formatPiSessionList,
    getPiSessionName,
    listStoredPiSessions,
} from "../src/index.js";

const createTempSessionDir = async () => mkdtemp(join(tmpdir(), "pi-session-index-"));

test("getPiSessionName returns the latest session_info name", async () => {
    const dir = await createTempSessionDir();
    const file = join(dir, "session.jsonl");

    await writeFile(
        file,
        [
            JSON.stringify({ type: "session_info", name: "Old name" }),
            JSON.stringify({ type: "message", content: "ignored" }),
            JSON.stringify({ type: "session_info", name: "New name" }),
        ].join("\n"),
    );

    assert.equal(await getPiSessionName(file), "New name");
});

test("listStoredPiSessions walks nested jsonl sessions and sorts by updatedAt desc", async () => {
    const dir = await createTempSessionDir();
    const nested = join(dir, "nested");
    await mkdir(nested);

    const older = join(dir, "older.jsonl");
    const newer = join(nested, "newer.jsonl");
    await writeFile(older, JSON.stringify({ type: "session_info", name: "Older" }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    await writeFile(newer, JSON.stringify({ type: "session_info", name: "Newer" }));
    await writeFile(join(dir, "not-a-session.txt"), "ignored");

    const sessions = await listStoredPiSessions({ sessionDir: dir, limit: 10 });

    assert.deepEqual(
        sessions.map((session) => session.label),
        ["Newer", "Older"],
    );
});

test("listStoredPiSessions handles missing directories and limits results", async () => {
    assert.deepEqual(
        await listStoredPiSessions({ sessionDir: "/definitely/missing/pi/session/dir" }),
        [],
    );

    const dir = await createTempSessionDir();
    await writeFile(join(dir, "a.jsonl"), "{}");
    await writeFile(join(dir, "b.jsonl"), "{}");

    assert.equal((await listStoredPiSessions({ sessionDir: dir, limit: 1 })).length, 1);
    assert.equal((await listStoredPiSessions({ sessionDir: dir, limit: 0 })).length, 0);
});

test("formatPiSessionList formats selections and empty state", () => {
    assert.equal(formatPiSessionList([]), "No saved pi sessions found.");
    assert.equal(
        formatPiSessionList([
            {
                file: "/sessions/a.jsonl",
                label: "Draft planning",
                updatedAt: "2026-06-21T10:30:00.000Z",
            },
        ]).includes("1. Draft planning"),
        true,
    );
});
