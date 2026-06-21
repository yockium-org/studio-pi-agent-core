import assert from "node:assert/strict";
import test from "node:test";

import {
    buildTelegramAudioTranscriptPrompt,
    extractTelegramAudioAttachment,
    transcribeTelegramAudio,
    validateTelegramAudioLimits,
    type AudioTranscriber,
    type DownloadedTelegramFile,
    type TelegramAudioAttachment,
} from "../src/index.js";

test("extractTelegramAudioAttachment detects voice messages", () => {
    assert.deepEqual(
        extractTelegramAudioAttachment({
            voice: {
                duration: 12,
                file_id: "voice-file",
                file_size: 1234,
                file_unique_id: "voice-unique",
                mime_type: "audio/ogg",
            },
        }),
        {
            durationSeconds: 12,
            fileId: "voice-file",
            fileSize: 1234,
            fileUniqueId: "voice-unique",
            kind: "voice",
            mimeType: "audio/ogg",
        },
    );
});

test("extractTelegramAudioAttachment detects audio files and audio documents", () => {
    assert.equal(
        extractTelegramAudioAttachment({ audio: { file_id: "audio-file" } })?.kind,
        "audio",
    );
    assert.deepEqual(
        extractTelegramAudioAttachment({
            document: {
                file_id: "document-file",
                file_name: "memo.mp3",
                mime_type: "audio/mpeg",
            },
        }),
        {
            fileId: "document-file",
            fileName: "memo.mp3",
            kind: "document-audio",
            mimeType: "audio/mpeg",
        },
    );
});

test("extractTelegramAudioAttachment ignores non-audio messages", () => {
    assert.equal(extractTelegramAudioAttachment({ text: "hello" }), null);
    assert.equal(
        extractTelegramAudioAttachment({
            document: { file_id: "doc-file", mime_type: "application/pdf" },
        }),
        null,
    );
});

test("validateTelegramAudioLimits enforces size, duration, and MIME policy", () => {
    const attachment: TelegramAudioAttachment = {
        durationSeconds: 61,
        fileId: "file",
        fileSize: 11,
        kind: "voice",
        mimeType: "application/octet-stream",
    };

    assert.deepEqual(validateTelegramAudioLimits(attachment, {}), []);
    assert.deepEqual(validateTelegramAudioLimits(attachment, { maxBytes: 10 }), [
        "Audio file is too large (11 bytes > 10 bytes).",
    ]);
    assert.deepEqual(validateTelegramAudioLimits(attachment, { maxDurationSeconds: 60 }), [
        "Audio duration is too long (61s > 60s).",
    ]);
    assert.deepEqual(validateTelegramAudioLimits(attachment, { allowedMimeTypes: ["audio/*"] }), [
        "Audio MIME type is not allowed (application/octet-stream).",
    ]);
});

test("transcribeTelegramAudio validates limits, downloads, and calls injected transcriber", async () => {
    const attachment: TelegramAudioAttachment = {
        durationSeconds: 30,
        fileId: "file",
        kind: "voice",
        mimeType: "audio/ogg",
    };
    const downloadedFile: DownloadedTelegramFile = {
        data: Buffer.from("audio"),
        filePath: "voice.ogg",
        mimeType: "audio/ogg",
        size: 5,
    };
    const transcriber: AudioTranscriber = {
        async transcribe(input) {
            assert.equal(input.mimeType, "audio/ogg");
            assert.equal(input.fileName, "voice.ogg");
            assert.equal(input.languageHint, "nl");
            assert.equal(input.data.toString("utf8"), "audio");
            return { provider: "mock", text: "Hallo wereld" };
        },
    };

    assert.deepEqual(
        await transcribeTelegramAudio({
            attachment,
            download: async () => downloadedFile,
            languageHint: "nl",
            limits: { allowedMimeTypes: ["audio/*"], maxBytes: 10, maxDurationSeconds: 60 },
            transcriber,
        }),
        { provider: "mock", text: "Hallo wereld" },
    );
});

test("transcribeTelegramAudio rejects limit failures before download", async () => {
    let downloaded = false;

    await assert.rejects(
        () =>
            transcribeTelegramAudio({
                attachment: { durationSeconds: 120, fileId: "file", kind: "voice" },
                download: async () => {
                    downloaded = true;
                    throw new Error("should not download");
                },
                limits: { maxDurationSeconds: 60 },
                transcriber: { transcribe: async () => ({ text: "" }) },
            }),
        /Audio duration is too long/,
    );
    assert.equal(downloaded, false);
});

test("buildTelegramAudioTranscriptPrompt includes transcript, caption, and metadata", () => {
    const prompt = buildTelegramAudioTranscriptPrompt({
        attachment: {
            durationSeconds: 12,
            fileId: "file",
            fileName: "voice.ogg",
            kind: "voice",
            mimeType: "audio/ogg",
        },
        caption: "Maak hier een artikelidee van",
        transcript: { language: "nl", provider: "mock", text: "Ik heb een idee." },
    });

    assert.match(prompt, /Telegram audio message/);
    assert.match(prompt, /Duration: 12s/);
    assert.match(prompt, /Transcript:\nIk heb een idee\./);
    assert.match(prompt, /Caption\/text sent with the audio:\nMaak hier een artikelidee van/);
});
