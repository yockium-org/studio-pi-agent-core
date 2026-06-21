import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";

export type PiSessionSummary = {
    file: string;
    label: string;
    name?: string;
    updatedAt: string;
};

export type ListStoredPiSessionsOptions = {
    sessionDir: string;
    limit?: number;
};

export type FormatPiSessionListOptions = {
    emptyMessage?: string;
    heading?: string;
    replyInstruction?: string;
    locale?: string | string[];
};

const isJsonlSession = (file: string) => file.endsWith(".jsonl");

const walkSessionFiles = async (dir: string): Promise<string[]> => {
    let entries;

    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch {
        return [];
    }

    const files = await Promise.all(
        entries.map(async (entry) => {
            const path = join(dir, entry.name);

            if (entry.isDirectory()) return walkSessionFiles(path);
            return entry.isFile() && isJsonlSession(entry.name) ? [path] : [];
        }),
    );

    return files.flat();
};

export const getPiSessionName = async (file: string): Promise<string | undefined> => {
    try {
        const content = await readFile(file, "utf8");
        const lines = content.trim().split("\n").filter(Boolean).reverse();

        for (const line of lines) {
            const entry = JSON.parse(line) as Record<string, unknown>;

            if (
                entry.type === "session_info" &&
                typeof entry.name === "string"
            ) {
                return entry.name;
            }
        }
    } catch {
        return undefined;
    }

    return undefined;
};

export const listStoredPiSessions = async ({
    sessionDir,
    limit = 10,
}: ListStoredPiSessionsOptions): Promise<PiSessionSummary[]> => {
    const files = await walkSessionFiles(sessionDir);
    const summaries = await Promise.all(
        files.map(async (file): Promise<PiSessionSummary | null> => {
            try {
                const fileStat = await stat(file);
                const name = await getPiSessionName(file);
                const fallback = basename(file).replace(/\.jsonl$/, "");

                return {
                    file,
                    label: name ?? fallback,
                    name,
                    updatedAt: fileStat.mtime.toISOString(),
                };
            } catch {
                return null;
            }
        }),
    );

    return summaries
        .filter((summary): summary is PiSessionSummary => Boolean(summary))
        .sort(
            (left, right) =>
                new Date(right.updatedAt).getTime() -
                new Date(left.updatedAt).getTime(),
        )
        .slice(0, Math.max(0, Math.floor(limit)));
};

export const formatPiSessionList = (
    sessions: readonly PiSessionSummary[],
    {
        emptyMessage = "No saved pi sessions found.",
        heading = "Saved pi sessions:",
        replyInstruction = "Reply with /session <number> to switch.",
        locale = "en-GB",
    }: FormatPiSessionListOptions = {},
) => {
    if (sessions.length === 0) return emptyMessage;

    return [
        heading,
        ...sessions.map((session, index) => {
            const updated = new Date(session.updatedAt).toLocaleString(locale, {
                dateStyle: "short",
                timeStyle: "short",
            });

            return `${index + 1}. ${session.label} — ${updated}`;
        }),
        "",
        replyInstruction,
    ].join("\n");
};
