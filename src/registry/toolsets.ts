export type ToolsetMode = "append" | "replace";

export type ToolsetRegistry<TToolName extends string = string, TToolsetName extends string = string> = Record<TToolsetName, readonly TToolName[]>;

export type ToolsetConfig<TToolName extends string = string, TToolsetName extends string = string> = {
    baseToolNames: readonly TToolName[];
    toolsets: ToolsetRegistry<TToolName, TToolsetName>;
};

export const isToolsetName = <TToolName extends string, TToolsetName extends string>(
    toolsets: ToolsetRegistry<TToolName, TToolsetName>,
    value: string,
): value is TToolsetName => Object.prototype.hasOwnProperty.call(toolsets, value);

export const getToolNamesForToolsets = <TToolName extends string, TToolsetName extends string>(
    config: ToolsetConfig<TToolName, TToolsetName>,
    selectedToolsets: Iterable<TToolsetName>,
): TToolName[] => {
    const selected = new Set<TToolName>(config.baseToolNames);

    for (const toolset of selectedToolsets) {
        for (const toolName of config.toolsets[toolset]) selected.add(toolName);
    }

    return [...selected];
};

export const normalizeToolsets = <TToolName extends string, TToolsetName extends string>(
    config: ToolsetConfig<TToolName, TToolsetName>,
    requestedToolsets: readonly string[],
): TToolsetName[] =>
    requestedToolsets.filter((toolset): toolset is TToolsetName => isToolsetName(config.toolsets, toolset));

export type LazyToolsetState<TToolName extends string = string, TToolsetName extends string = string> = {
    getActiveToolsets: () => Set<TToolsetName>;
    getActiveToolNames: () => TToolName[];
    activateToolsets: (requestedToolsets: readonly string[], mode?: ToolsetMode) => TToolsetName[];
    reset: () => void;
};

export const createLazyToolsetState = <TToolName extends string, TToolsetName extends string>(
    config: ToolsetConfig<TToolName, TToolsetName>,
): LazyToolsetState<TToolName, TToolsetName> => {
    let activeToolsets = new Set<TToolsetName>();

    return {
        getActiveToolsets: () => new Set(activeToolsets),
        getActiveToolNames: () => getToolNamesForToolsets(config, activeToolsets),
        activateToolsets: (requestedToolsets, mode = "append") => {
            const normalizedToolsets = normalizeToolsets(config, requestedToolsets);

            if (mode === "replace") activeToolsets = new Set(normalizedToolsets);
            else for (const toolset of normalizedToolsets) activeToolsets.add(toolset);

            return [...activeToolsets];
        },
        reset: () => {
            activeToolsets = new Set<TToolsetName>();
        },
    };
};
