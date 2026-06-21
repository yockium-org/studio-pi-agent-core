import { createLazyToolsetState, type ToolsetConfig, type ToolsetMode } from "../registry/toolsets.js";
import { validateToolParams, type SchemaGuardOptions, type SchemaLike } from "../guards/schema-guard.js";

export type PiExtensionHost<TToolName extends string = string> = {
    on(eventName: "session_start", handler: (...args: unknown[]) => void): void;
    registerTool(definition: Record<string, unknown>): void;
    setActiveTools(toolNames: readonly TToolName[]): void;
};

export type PiToolDefinition<TToolName extends string = string> = {
    name: TToolName;
    label?: string;
    description?: string;
    parameters?: SchemaLike;
    execute(toolCallId: string, params?: Record<string, unknown>, ...args: unknown[]): unknown | Promise<unknown>;
    [key: string]: unknown;
};

export type ToolFactoryContext<TToolName extends string = string, TToolsetName extends string = string> = {
    getActiveLazyToolsets: () => Set<TToolsetName>;
    getActiveToolNames: () => TToolName[];
    activateToolsets: (toolsets: readonly string[], mode?: ToolsetMode) => TToolsetName[];
};

export type SchemaGuardOptionsResolver<TToolName extends string = string, TToolsetName extends string = string> =
    | SchemaGuardOptions
    | ((args: {
          toolName: TToolName;
          tool: PiToolDefinition<TToolName>;
          adapter: EditorialAgentAdapter<TToolName, TToolsetName>;
      }) => SchemaGuardOptions | undefined);

export type EditorialAgentAdapter<TToolName extends string = string, TToolsetName extends string = string> = {
    id: string;
    label: string;
    tools: ToolsetConfig<TToolName, TToolsetName> & {
        createTools: (context: ToolFactoryContext<TToolName, TToolsetName>) => Record<string, PiToolDefinition<TToolName>>;
    };
    schemaGuard?: SchemaGuardOptionsResolver<TToolName, TToolsetName>;
    onSessionStart?: (args: { pi: PiExtensionHost<TToolName>; adapter: EditorialAgentAdapter<TToolName, TToolsetName> }) => void;
};

const resolveSchemaGuardOptions = <TToolName extends string, TToolsetName extends string>(
    adapter: EditorialAgentAdapter<TToolName, TToolsetName>,
    tool: PiToolDefinition<TToolName>,
): SchemaGuardOptions | undefined => {
    if (typeof adapter.schemaGuard === "function") return adapter.schemaGuard({ toolName: tool.name, tool, adapter });
    return adapter.schemaGuard;
};

export const createEditorialExtension = <TToolName extends string, TToolsetName extends string>(
    adapter: EditorialAgentAdapter<TToolName, TToolsetName>,
) => {
    return (pi: PiExtensionHost<TToolName>) => {
        const toolsetState = createLazyToolsetState<TToolName, TToolsetName>({
            baseToolNames: adapter.tools.baseToolNames,
            toolsets: adapter.tools.toolsets,
        });

        const activateToolsets = (toolsets: readonly string[], mode: ToolsetMode = "append") => {
            const activeToolsets = toolsetState.activateToolsets(toolsets, mode);
            pi.setActiveTools(toolsetState.getActiveToolNames());
            return activeToolsets;
        };

        const tools = adapter.tools.createTools({
            getActiveLazyToolsets: toolsetState.getActiveToolsets,
            getActiveToolNames: toolsetState.getActiveToolNames,
            activateToolsets,
        });

        const registerTool = (definition: PiToolDefinition<TToolName>) => {
            pi.registerTool({
                ...definition,
                async execute(toolCallId: string, params: Record<string, unknown> = {}, ...args: unknown[]) {
                    if (definition.parameters) {
                        const guardFeedback = validateToolParams(
                            definition.name,
                            definition.parameters,
                            params,
                            resolveSchemaGuardOptions(adapter, definition),
                        );
                        if (guardFeedback) return guardFeedback;
                    }
                    return definition.execute(toolCallId, params, ...args);
                },
            });
        };

        pi.on("session_start", () => {
            toolsetState.reset();
            pi.setActiveTools(adapter.tools.baseToolNames);
            adapter.onSessionStart?.({ pi, adapter });
        });

        for (const tool of Object.values(tools)) registerTool(tool);
    };
};
