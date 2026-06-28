import { downloadTelegramFile, type DownloadedTelegramFile } from "./audio.js";

export type TelegramImageAttachmentKind = "document-image" | "photo";

export type TelegramImageAttachment = {
    fileId: string;
    fileName?: string;
    fileSize?: number;
    fileUniqueId?: string;
    height?: number;
    kind: TelegramImageAttachmentKind;
    mimeType?: string;
    width?: number;
};

export type DownloadTelegramImageOptions = {
    botToken: string;
    fallbackMimeType?: string;
    fetchImpl?: typeof fetch;
    fileId: string;
};

export type DownloadedTelegramImage = {
    filename: string;
    filePath: string;
    imageBase64: string;
    mimeType: string;
    size: number;
};

export type EditorialMediaUploadPayload = DownloadedTelegramImage & {
    alt: string;
    approvalSummary?: string;
    credits?: string;
    description?: string;
    title?: string;
    usageSuggestion?: string;
};

export type BuildEditorialMediaUploadPayloadOptions = {
    alt: string;
    approvalSummary?: string;
    credits?: string;
    description?: string;
    image: DownloadedTelegramImage;
    title?: string;
    usageSuggestion?: string;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
    value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;

const asString = (value: unknown): string | undefined =>
    typeof value === "string" && value.length > 0 ? value : undefined;

const asNumber = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;

const extractImageAttachment = (
    kind: TelegramImageAttachmentKind,
    value: Record<string, unknown>,
): TelegramImageAttachment | null => {
    const fileId = asString(value.file_id);
    if (!fileId) return null;

    return {
        fileId,
        ...(asString(value.file_name) ? { fileName: asString(value.file_name) } : {}),
        ...(asNumber(value.file_size) !== undefined ? { fileSize: asNumber(value.file_size) } : {}),
        ...(asString(value.file_unique_id)
            ? { fileUniqueId: asString(value.file_unique_id) }
            : {}),
        ...(asNumber(value.height) !== undefined ? { height: asNumber(value.height) } : {}),
        kind,
        ...(asString(value.mime_type) ? { mimeType: asString(value.mime_type) } : {}),
        ...(asNumber(value.width) !== undefined ? { width: asNumber(value.width) } : {}),
    };
};

export const extractTelegramImageAttachment = (
    message: unknown,
): TelegramImageAttachment | null => {
    const record = asRecord(message);
    if (!record) return null;

    const photos = Array.isArray(record.photo)
        ? record.photo.map(asRecord).filter((photo): photo is Record<string, unknown> => Boolean(photo))
        : [];
    if (photos.length > 0) {
        const [largest] = [...photos].sort(
            (a, b) => (asNumber(b.file_size) ?? 0) - (asNumber(a.file_size) ?? 0),
        );
        if (largest) return extractImageAttachment("photo", largest);
    }

    const document = asRecord(record.document);
    const documentMimeType = asString(document?.mime_type);
    if (document && documentMimeType?.toLowerCase().startsWith("image/")) {
        return extractImageAttachment("document-image", document);
    }

    return null;
};

const filenameFromDownloadedFile = (
    downloadedFile: Pick<DownloadedTelegramFile, "filePath">,
    fallbackExtension: string,
) => downloadedFile.filePath.split("/").pop() || `telegram-image.${fallbackExtension}`;

const extensionFromFilePath = (filePath: string) =>
    filePath.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";

export const downloadTelegramImage = async ({
    botToken,
    fallbackMimeType = "image/jpeg",
    fetchImpl,
    fileId,
}: DownloadTelegramImageOptions): Promise<DownloadedTelegramImage> => {
    if (!botToken) throw new Error("Telegram bot token is required to download media");

    const downloadedFile = await downloadTelegramFile({ botToken, fetchImpl, fileId });
    const fallbackExtension = extensionFromFilePath(downloadedFile.filePath);
    const mimeType = downloadedFile.mimeType.startsWith("image/")
        ? downloadedFile.mimeType
        : fallbackMimeType;

    return {
        filename: filenameFromDownloadedFile(downloadedFile, fallbackExtension),
        filePath: downloadedFile.filePath,
        imageBase64: downloadedFile.data.toString("base64"),
        mimeType,
        size: downloadedFile.size,
    };
};

export const buildEditorialMediaUploadPayload = ({
    alt,
    approvalSummary,
    credits,
    description,
    image,
    title,
    usageSuggestion,
}: BuildEditorialMediaUploadPayloadOptions): EditorialMediaUploadPayload => ({
    ...image,
    alt,
    ...(approvalSummary ? { approvalSummary } : {}),
    ...(credits ? { credits } : {}),
    ...(description ? { description } : {}),
    ...(title ? { title } : {}),
    ...(usageSuggestion ? { usageSuggestion } : {}),
});
