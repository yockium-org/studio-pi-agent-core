import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export type PayloadMcpClientOptions = {
    url: string;
    apiKey?: string;
    apiKeyName?: string;
    clientName: string;
    clientVersion: string;
    headers?: Record<string, string>;
    requireApiKey?: boolean;
};

export const textFromMcpResult = (result: any): string => {
    if (!result?.content || !Array.isArray(result.content)) return JSON.stringify(result ?? null, null, 2);

    return result.content
        .map((entry: any) => (entry?.type === "text" ? (entry.text ?? "") : JSON.stringify(entry)))
        .filter(Boolean)
        .join("\n");
};

const createHeaders = (options: PayloadMcpClientOptions) => {
    const headers = { ...(options.headers ?? {}) };
    if (options.apiKey) headers.authorization = `Bearer ${options.apiKey}`;
    return headers;
};

export const callPayloadMcpTool = async (
    options: PayloadMcpClientOptions,
    name: string,
    args: Record<string, unknown> = {},
): Promise<string> => {
    if ((options.requireApiKey ?? true) && !options.apiKey) {
        throw new Error(`${options.apiKeyName ?? "Payload MCP API key"} is not configured`);
    }

    const client = new Client({ name: options.clientName, version: options.clientVersion });
    const transport = new StreamableHTTPClientTransport(new URL(options.url), {
        requestInit: { headers: createHeaders(options) },
    });

    try {
        await client.connect(transport);
        const result = await client.callTool({ name, arguments: args });
        return textFromMcpResult(result);
    } finally {
        await transport.close().catch(() => undefined);
    }
};

export const createPayloadMcpToolCaller = (options: PayloadMcpClientOptions) =>
    (name: string, args: Record<string, unknown> = {}) => callPayloadMcpTool(options, name, args);
