export type TelegramAudioAttachmentKind = "audio" | "document-audio" | "voice";

export type TelegramAudioAttachment = {
    durationSeconds?: number;
    fileId: string;
    fileName?: string;
    fileSize?: number;
    fileUniqueId?: string;
    kind: TelegramAudioAttachmentKind;
    mimeType?: string;
};

export type DownloadedTelegramFile = {
    data: Buffer;
    filePath: string;
    mimeType: string;
    size: number;
};

export type AudioTranscriptionResult = {
    durationSeconds?: number;
    language?: string;
    provider?: string;
    text: string;
};

export type AudioTranscriber = {
    transcribe(input: {
        data: Buffer;
        fileName?: string;
        languageHint?: string;
        mimeType: string;
    }): Promise<AudioTranscriptionResult>;
};

export type TelegramAudioLimits = {
    allowedMimeTypes?: readonly string[];
    maxBytes?: number;
    maxDurationSeconds?: number;
};

export type TelegramFileDownloadOptions = {
    botToken: string;
    fetchImpl?: typeof fetch;
    fileId: string;
};

export type TranscribeTelegramAudioOptions = {
    attachment: TelegramAudioAttachment;
    download: (attachment: TelegramAudioAttachment) => Promise<DownloadedTelegramFile>;
    languageHint?: string;
    limits?: TelegramAudioLimits;
    transcriber: AudioTranscriber;
};

export type TelegramAudioTranscriptPromptOptions = {
    attachment: TelegramAudioAttachment;
    caption?: string;
    instruction?: string;
    transcript: AudioTranscriptionResult;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
    value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;

const asString = (value: unknown): string | undefined =>
    typeof value === "string" && value.length > 0 ? value : undefined;

const asNumber = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;

const normalizeMimeType = (mimeType: string | undefined) =>
    mimeType?.trim().toLowerCase();

const isAllowedMimeType = (
    mimeType: string | undefined,
    allowedMimeTypes: readonly string[],
) => {
    const normalizedMimeType = normalizeMimeType(mimeType);
    if (!normalizedMimeType) return true;

    return allowedMimeTypes.some((allowed) => {
        const normalizedAllowed = normalizeMimeType(allowed);
        if (!normalizedAllowed) return false;
        if (normalizedAllowed.endsWith("/*")) {
            return normalizedMimeType.startsWith(normalizedAllowed.slice(0, -1));
        }
        return normalizedMimeType === normalizedAllowed;
    });
};

const extractAttachment = (
    kind: TelegramAudioAttachmentKind,
    value: Record<string, unknown>,
): TelegramAudioAttachment | null => {
    const fileId = asString(value.file_id);
    if (!fileId) return null;

    return {
        ...(asNumber(value.duration) !== undefined
            ? { durationSeconds: asNumber(value.duration) }
            : {}),
        fileId,
        ...(asString(value.file_name) ? { fileName: asString(value.file_name) } : {}),
        ...(asNumber(value.file_size) !== undefined ? { fileSize: asNumber(value.file_size) } : {}),
        ...(asString(value.file_unique_id)
            ? { fileUniqueId: asString(value.file_unique_id) }
            : {}),
        kind,
        ...(asString(value.mime_type) ? { mimeType: asString(value.mime_type) } : {}),
    };
};

export const extractTelegramAudioAttachment = (
    message: unknown,
): TelegramAudioAttachment | null => {
    const record = asRecord(message);
    if (!record) return null;

    const voice = asRecord(record.voice);
    if (voice) return extractAttachment("voice", voice);

    const audio = asRecord(record.audio);
    if (audio) return extractAttachment("audio", audio);

    const document = asRecord(record.document);
    const documentMimeType = asString(document?.mime_type);
    if (document && documentMimeType?.toLowerCase().startsWith("audio/")) {
        return extractAttachment("document-audio", document);
    }

    return null;
};

export const validateTelegramAudioLimits = (
    attachment: TelegramAudioAttachment,
    limits: TelegramAudioLimits = {},
    downloadedFile?: Pick<DownloadedTelegramFile, "mimeType" | "size">,
): string[] => {
    const issues: string[] = [];
    const size = downloadedFile?.size ?? attachment.fileSize;
    const mimeType = downloadedFile?.mimeType ?? attachment.mimeType;

    if (
        typeof limits.maxBytes === "number" &&
        typeof size === "number" &&
        size > limits.maxBytes
    ) {
        issues.push(`Audio file is too large (${size} bytes > ${limits.maxBytes} bytes).`);
    }

    if (
        typeof limits.maxDurationSeconds === "number" &&
        typeof attachment.durationSeconds === "number" &&
        attachment.durationSeconds > limits.maxDurationSeconds
    ) {
        issues.push(
            `Audio duration is too long (${attachment.durationSeconds}s > ${limits.maxDurationSeconds}s).`,
        );
    }

    if (
        limits.allowedMimeTypes &&
        limits.allowedMimeTypes.length > 0 &&
        !isAllowedMimeType(mimeType, limits.allowedMimeTypes)
    ) {
        issues.push(`Audio MIME type is not allowed (${mimeType ?? "unknown"}).`);
    }

    return issues;
};

const createLimitError = (issues: readonly string[]) =>
    new Error(`Telegram audio transcription limits failed:\n- ${issues.join("\n- ")}`);

export const downloadTelegramFile = async ({
    botToken,
    fetchImpl = fetch,
    fileId,
}: TelegramFileDownloadOptions): Promise<DownloadedTelegramFile> => {
    if (!botToken) throw new Error("Telegram bot token is required to download audio");

    const metadataResponse = await fetchImpl(
        `https://api.telegram.org/bot${botToken}/getFile`,
        {
            body: JSON.stringify({ file_id: fileId }),
            headers: { "content-type": "application/json" },
            method: "POST",
        },
    );

    if (!metadataResponse.ok) {
        throw new Error(
            `Telegram getFile failed: ${metadataResponse.status} ${await metadataResponse.text()}`,
        );
    }

    const metadata = (await metadataResponse.json()) as {
        result?: { file_path?: string; file_size?: number };
    };
    const filePath = metadata.result?.file_path;
    if (!filePath) throw new Error("Telegram did not return a file_path");

    const fileResponse = await fetchImpl(
        `https://api.telegram.org/file/bot${botToken}/${filePath}`,
    );

    if (!fileResponse.ok) {
        throw new Error(
            `Telegram file download failed: ${fileResponse.status} ${await fileResponse.text()}`,
        );
    }

    const data = Buffer.from(await fileResponse.arrayBuffer());
    const mimeType = fileResponse.headers.get("content-type") || "application/octet-stream";

    return {
        data,
        filePath,
        mimeType,
        size: data.length,
    };
};

export const transcribeTelegramAudio = async ({
    attachment,
    download,
    languageHint,
    limits,
    transcriber,
}: TranscribeTelegramAudioOptions): Promise<AudioTranscriptionResult> => {
    const preDownloadIssues = validateTelegramAudioLimits(attachment, limits);
    if (preDownloadIssues.length > 0) throw createLimitError(preDownloadIssues);

    const downloadedFile = await download(attachment);
    const postDownloadIssues = validateTelegramAudioLimits(
        attachment,
        limits,
        downloadedFile,
    );
    if (postDownloadIssues.length > 0) throw createLimitError(postDownloadIssues);

    return transcriber.transcribe({
        data: downloadedFile.data,
        fileName: attachment.fileName ?? downloadedFile.filePath.split("/").pop(),
        languageHint,
        mimeType: downloadedFile.mimeType || attachment.mimeType || "application/octet-stream",
    });
};

export const buildTelegramAudioTranscriptPrompt = ({
    attachment,
    caption,
    instruction =
        "Treat this transcript as the user's message. If the transcript is ambiguous, ask a clarifying question before taking action.",
    transcript,
}: TelegramAudioTranscriptPromptOptions) =>
    [
        "Stakeholder sent a Telegram audio message.",
        "",
        `Audio kind: ${attachment.kind}`,
        attachment.durationSeconds !== undefined
            ? `Duration: ${attachment.durationSeconds}s`
            : undefined,
        attachment.mimeType ? `MIME type: ${attachment.mimeType}` : undefined,
        attachment.fileName ? `File name: ${attachment.fileName}` : undefined,
        transcript.language ? `Detected language: ${transcript.language}` : undefined,
        transcript.provider ? `Transcription provider: ${transcript.provider}` : undefined,
        "",
        "Transcript:",
        transcript.text.trim(),
        caption?.trim() ? "" : undefined,
        caption?.trim() ? "Caption/text sent with the audio:" : undefined,
        caption?.trim() || undefined,
        "",
        instruction,
    ]
        .filter((line): line is string => typeof line === "string")
        .join("\n");
