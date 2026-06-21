export type ToolResultDetails = Record<string, unknown>;

export type TextToolResult = {
    content: Array<{ type: "text"; text: string }>;
    details?: ToolResultDetails;
};

export const createTextResult = (
    text: string,
    details: ToolResultDetails | undefined = undefined,
): TextToolResult => ({
    content: [{ type: "text", text }],
    ...(details ? { details } : {}),
});
