#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const run = (command, args, options = {}) =>
    new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: repoRoot,
            stdio: "inherit",
            shell: process.platform === "win32",
            ...options,
        });
        child.on("error", reject);
        child.on("exit", (code, signal) => {
            if (code === 0) resolve();
            else reject(new Error(`${command} ${args.join(" ")} failed with ${signal ?? `exit code ${code}`}`));
        });
    });

const tempRoot = await mkdtemp(join(tmpdir(), "studio-pi-agent-core-pack-"));
const packDir = join(tempRoot, "pack");
const consumerDir = join(tempRoot, "consumer");

try {
    await mkdir(packDir, { recursive: true });
    await mkdir(consumerDir, { recursive: true });
    await run("npm", ["pack", "--pack-destination", packDir]);

    const tarballs = (await readdir(packDir)).filter((entry) => entry.endsWith(".tgz"));
    assert.equal(tarballs.length, 1, `Expected exactly one packed tarball, got ${tarballs.length}`);
    const tarballPath = join(packDir, tarballs[0]);

    await writeFile(
        join(consumerDir, "package.json"),
        JSON.stringify({ private: true, type: "module" }, null, 2),
    );
    await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarballPath], { cwd: consumerDir });

    await writeFile(
        join(consumerDir, "smoke.mjs"),
        `import assert from "node:assert/strict";\n` +
            `import * as core from "@studio/pi-agent-core";\n\n` +
            `assert.equal(typeof core.createTextResult, "function");\n` +
            `assert.equal(typeof core.createEditorialExtension, "function");\n` +
            `assert.equal(typeof core.createSafePiRpcArgs, "function");\n` +
            `assert.equal(typeof core.extractTelegramAudioAttachment, "function");\n` +
            `assert.deepEqual(core.createTextResult("ok").content, [{ type: "text", text: "ok" }]);\n` +
            `assert(core.createSafePiRpcArgs({ extensionPath: "./extension.js" }).includes("--no-builtin-tools"));\n` +
            `try {\n` +
            `  await import("@studio/pi-agent-core/src/index.js");\n` +
            `  throw new Error("subpath import unexpectedly succeeded");\n` +
            `} catch (error) {\n` +
            `  assert.equal(error.code, "ERR_PACKAGE_PATH_NOT_EXPORTED");\n` +
            `}\n`,
    );
    await run("node", ["smoke.mjs"], { cwd: consumerDir });
} finally {
    await rm(tempRoot, { recursive: true, force: true });
}
