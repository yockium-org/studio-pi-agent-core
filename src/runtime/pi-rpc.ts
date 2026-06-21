export type PiRpcLaunchOptions = {
    sessionDir: string;
    systemPrompt: string;
    extensionPath: string;
    name: string;
    model?: string;
    extraArgs?: readonly string[];
    safety?: {
        builtinTools?: "disabled" | "enabled";
        contextFiles?: "disabled" | "enabled";
        promptTemplates?: "disabled" | "enabled";
        themes?: "disabled" | "enabled";
    };
};

const defaultSafety = {
    builtinTools: "disabled",
    contextFiles: "disabled",
    promptTemplates: "disabled",
    themes: "disabled",
} as const;

export const createSafePiRpcArgs = ({
    sessionDir,
    systemPrompt,
    extensionPath,
    name,
    model,
    extraArgs = [],
    safety = defaultSafety,
}: PiRpcLaunchOptions): string[] => {
    const resolvedSafety = { ...defaultSafety, ...safety };
    const args = ["--mode", "rpc", "--session-dir", sessionDir];

    if (resolvedSafety.builtinTools === "disabled") args.push("--no-builtin-tools");
    if (resolvedSafety.contextFiles === "disabled") args.push("--no-context-files");
    if (resolvedSafety.promptTemplates === "disabled") args.push("--no-prompt-templates");
    if (resolvedSafety.themes === "disabled") args.push("--no-themes");

    args.push(
        "--append-system-prompt",
        systemPrompt,
        "--extension",
        extensionPath,
        "--name",
        name,
    );

    if (model) args.push("--model", model);
    args.push(...extraArgs);

    return args;
};

export const extractPiMessageText = (message: unknown): string => {
    if (!message || typeof message !== "object") return "";

    const content = (message as { content?: unknown }).content;
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";

    return content
        .map((part) => {
            if (typeof part === "string") return part;
            if (!part || typeof part !== "object") return "";

            const maybeText = (part as { text?: unknown }).text;
            if (typeof maybeText === "string") return maybeText;

            const maybeContent = (part as { content?: unknown }).content;
            if (typeof maybeContent === "string") return maybeContent;

            return "";
        })
        .filter(Boolean)
        .join("");
};
