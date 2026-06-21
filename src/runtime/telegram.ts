export const escapeTelegramHtmlText = (value: string): string =>
    value
        .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

export const sanitizeTelegramCodeTags = (text: string): string =>
    text.replace(/<(code|pre)>([\s\S]*?)<\/\1>/gi, (_match, tag, content) => {
        const normalizedTag = String(tag).toLowerCase();

        return `<${normalizedTag}>${escapeTelegramHtmlText(content)}</${normalizedTag}>`;
    });

export const chunkTelegramMessage = (
    text: string,
    maxChunkLength = 3800,
): string[] => {
    if (maxChunkLength < 1 || !Number.isFinite(maxChunkLength)) {
        throw new Error("maxChunkLength must be a positive finite number");
    }

    const chunks = text.match(new RegExp(`[\\s\\S]{1,${Math.floor(maxChunkLength)}}`, "g"));
    return chunks ?? [""];
};
