import assert from "node:assert/strict";
import test from "node:test";

import {
    buildEditorialMediaUploadPayload,
    downloadTelegramImage,
    extractTelegramImageAttachment,
} from "../src/telegram/media.js";

const jsonResponse = (body: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
        ...init,
    });

test("extractTelegramImageAttachment picks the largest Telegram photo", () => {
    const attachment = extractTelegramImageAttachment({
        photo: [
            { file_id: "small", file_size: 10, width: 90, height: 90 },
            { file_id: "large", file_size: 100, width: 1280, height: 720 },
        ],
    });

    assert.deepEqual(attachment, {
        fileId: "large",
        fileSize: 100,
        height: 720,
        kind: "photo",
        width: 1280,
    });
});

test("extractTelegramImageAttachment accepts image documents only", () => {
    assert.equal(
        extractTelegramImageAttachment({
            document: { file_id: "pdf", mime_type: "application/pdf" },
        }),
        null,
    );

    assert.deepEqual(
        extractTelegramImageAttachment({
            document: {
                file_id: "image-doc",
                file_name: "hero.png",
                file_size: 123,
                mime_type: "image/png",
            },
        }),
        {
            fileId: "image-doc",
            fileName: "hero.png",
            fileSize: 123,
            kind: "document-image",
            mimeType: "image/png",
        },
    );
});

test("downloadTelegramImage downloads and converts file bytes to Payload upload shape", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
        const urlText = String(url);
        calls.push(urlText);

        if (urlText.endsWith("/getFile")) {
            assert.equal(init?.method, "POST");
            assert.equal((init?.headers as Record<string, string>)["content-type"], "application/json");
            return jsonResponse({ result: { file_path: "photos/hero.webp" } });
        }

        return new Response(Buffer.from("image-bytes"), {
            headers: { "content-type": "image/webp" },
        });
    };

    const image = await downloadTelegramImage({
        botToken: "token",
        fetchImpl,
        fileId: "file-1",
    });

    assert.deepEqual(calls, [
        "https://api.telegram.org/bottoken/getFile",
        "https://api.telegram.org/file/bottoken/photos/hero.webp",
    ]);
    assert.deepEqual(image, {
        filename: "hero.webp",
        filePath: "photos/hero.webp",
        imageBase64: Buffer.from("image-bytes").toString("base64"),
        mimeType: "image/webp",
        size: Buffer.byteLength("image-bytes"),
    });
});

test("buildEditorialMediaUploadPayload appends approved editorial fields", () => {
    const payload = buildEditorialMediaUploadPayload({
        alt: "Teacher guides a yoga class",
        approvalSummary: "Editor approved alt and hero placement.",
        image: {
            filename: "hero.jpg",
            filePath: "photos/hero.jpg",
            imageBase64: "abc",
            mimeType: "image/jpeg",
            size: 3,
        },
        usageSuggestion: "heroImage",
    });

    assert.equal(payload.alt, "Teacher guides a yoga class");
    assert.equal(payload.approvalSummary, "Editor approved alt and hero placement.");
    assert.equal(payload.usageSuggestion, "heroImage");
    assert.equal(payload.imageBase64, "abc");
});
