import type { PiToolDefinition } from "../extension/editorial-extension.js";
import { createTextResult } from "../responses/result.js";
import {
    consultSpecialists,
    type SpecialistConsultRequest,
    type SpecialistConsultResult,
    type SpecialistPolicy,
    type SpecialistRunner,
} from "./specialists.js";
import {
    createEditorialSpecialistPolicy,
    createEditorialSpecialistRegistry,
    type EditorialSpecialistCapability,
    type EditorialSpecialistId,
} from "./editorial-presets.js";

const editorialWorkflowPhaseValues = ["discover", "plan", "draft", "review", "polish", "prepareMutation"] as const;

export type EditorialWorkflowPhase = (typeof editorialWorkflowPhaseValues)[number];

export const editorialWorkflowPhases: readonly EditorialWorkflowPhase[] = Object.freeze([...editorialWorkflowPhaseValues]);

const editorialWorkflowIntentValues = ["article", "page", "contentUpdate", "publishPreparation"] as const;

export type EditorialWorkflowIntent = (typeof editorialWorkflowIntentValues)[number];

export const editorialWorkflowIntents: readonly EditorialWorkflowIntent[] = Object.freeze([...editorialWorkflowIntentValues]);

export type EditorialWorkflowPhasePreset = Readonly<{
    phase: EditorialWorkflowPhase;
    label: string;
    description: string;
    objective: string;
    recommendedSpecialistIds: readonly EditorialSpecialistId[];
    mainAgentInstructions: readonly string[];
    outputSections: readonly string[];
    defaultMaxHelpers: number;
}>;

export type EditorialWorkflowPlan = Readonly<{
    intent: EditorialWorkflowIntent;
    phases: readonly EditorialWorkflowPhasePreset[];
}>;

export type EditorialWorkflowConsultRequestOptions = {
    phase: EditorialWorkflowPhase;
    task: string;
    context?: string;
    intent?: EditorialWorkflowIntent;
    maxHelpers?: number;
    includeSafetyForUnsafeIntent?: boolean;
    additionalUnsafeIntentPatterns?: readonly RegExp[];
};

export type EditorialWorkflowConsultSummary = Readonly<{
    phase: EditorialWorkflowPhase;
    intent: EditorialWorkflowIntent;
    label: string;
    objective: string;
    recommendedSpecialistIds: readonly EditorialSpecialistId[];
    mainAgentInstructions: readonly string[];
    outputSections: readonly string[];
}>;

export type EditorialWorkflowPhaseConsultResult<TOutput = unknown> = SpecialistConsultResult<
    EditorialSpecialistId,
    EditorialSpecialistCapability,
    TOutput
> & {
    workflow: EditorialWorkflowConsultSummary;
};

export type ConsultEditorialWorkflowPhaseOptions<TOutput = unknown> = EditorialWorkflowConsultRequestOptions & {
    runner: SpecialistRunner<EditorialSpecialistId, EditorialSpecialistCapability, TOutput>;
    policy?: SpecialistPolicy<EditorialSpecialistCapability>;
    allowParallel?: boolean;
};

export type ConsultEditorialWorkflowPhaseToolOptions<
    TToolName extends string = "consultEditorialWorkflowPhase",
    TOutput = unknown,
> = {
    name?: TToolName;
    label?: string;
    description?: string;
    runner: SpecialistRunner<EditorialSpecialistId, EditorialSpecialistCapability, TOutput>;
    policy?: SpecialistPolicy<EditorialSpecialistCapability>;
    allowParallel?: boolean;
    defaultIntent?: EditorialWorkflowIntent;
    additionalUnsafeIntentPatterns?: readonly RegExp[];
};

const baseArticleWorkflowPhases = [
    {
        phase: "discover",
        label: "Discover editorial context",
        description: "Collect content, route, locale, entity, and CMS structure constraints before planning.",
        objective: "Know what exists, where it belongs, and which project constraints must shape the work.",
        recommendedSpecialistIds: ["cms-structure-reviewer", "entity-optimizer"],
        mainAgentInstructions: [
            "Use read-only CMS tools to identify the target document, route, locale, topic, author, and related entities before changing direction.",
            "Ask the editor for missing target/context when the CMS target is ambiguous.",
            "Do not draft or mutate content during discovery.",
        ],
        outputSections: ["target/context", "entity constraints", "CMS structure constraints", "open questions"],
        defaultMaxHelpers: 2,
    },
    {
        phase: "plan",
        label: "Plan the editorial work",
        description: "Use specialist constraints before writing so the draft is not generic.",
        objective: "Produce a concrete outline and constraints for the draft before generating text.",
        recommendedSpecialistIds: ["entity-optimizer", "geo-content-optimizer", "cms-structure-reviewer"],
        mainAgentInstructions: [
            "Consult specialists before writing when the editor asks to create, rewrite, or substantially improve content.",
            "Turn specialist feedback into an outline, angle, entity facts, answerability goals, and CMS block/route plan.",
            "Do not invent unsupported facts; mark missing proof/source material as a planning gap.",
        ],
        outputSections: ["outline", "entity facts", "answerability goals", "CMS/block plan", "missing inputs"],
        defaultMaxHelpers: 3,
    },
    {
        phase: "draft",
        label: "Draft with constraints",
        description: "Write the content using entity and answerability constraints from planning.",
        objective: "Create a coherent draft in one voice while preserving specialist constraints.",
        recommendedSpecialistIds: ["entity-optimizer", "geo-content-optimizer"],
        mainAgentInstructions: [
            "Keep the main agent responsible for the final voice and structure; specialists provide constraints, not disconnected text chunks.",
            "Use direct answers, clear headings, and explicit entity references while drafting.",
            "If the draft requires facts the project has not supplied, leave placeholders or ask for source material instead of fabricating details.",
        ],
        outputSections: ["draft", "assumptions", "missing proof", "follow-up questions"],
        defaultMaxHelpers: 2,
    },
    {
        phase: "review",
        label: "Review the draft",
        description: "Audit the draft before it is shown as ready or prepared for mutation/publish.",
        objective: "Catch content quality, GEO, and safety issues before the editor approves changes.",
        recommendedSpecialistIds: ["content-quality-auditor", "geo-content-optimizer", "safety-reviewer"],
        mainAgentInstructions: [
            "Run review after drafting or substantial edits before claiming the content is ready.",
            "Separate blocking issues from optional improvements.",
            "Summarize specialist feedback into actionable fixes instead of dumping raw helper output.",
        ],
        outputSections: ["verdict", "blocking issues", "recommended fixes", "optional polish"],
        defaultMaxHelpers: 3,
    },
    {
        phase: "polish",
        label: "Polish the final text",
        description: "Tighten wording, clarity, scannability, and answerability without changing the approved plan.",
        objective: "Improve the final surface quality while avoiding scope creep.",
        recommendedSpecialistIds: ["content-quality-auditor", "geo-content-optimizer"],
        mainAgentInstructions: [
            "Polish after review fixes are understood; do not introduce new unsupported claims.",
            "Prefer concise wording, clearer headings, stronger summaries, and more citable direct answers.",
            "Keep project voice and CMS constraints intact.",
        ],
        outputSections: ["polished changes", "remaining caveats", "ready-for-approval note"],
        defaultMaxHelpers: 2,
    },
    {
        phase: "prepareMutation",
        label: "Prepare CMS mutation",
        description: "Preflight draft/update/publish changes before any CMS write or publish action.",
        objective: "Block unsafe or invalid mutations before apply/publish and produce an approval-ready summary.",
        recommendedSpecialistIds: ["cms-structure-reviewer", "content-quality-auditor", "safety-reviewer"],
        mainAgentInstructions: [
            "Use this phase before any write, update, media, or publish tool is called.",
            "Check target identity, route/locale, required fields, relations, content quality, approval requirements, and readback expectations.",
            "Return a summary, risks, and blockers; do not apply the mutation in this phase.",
        ],
        outputSections: ["target", "proposed change summary", "blockers", "risks", "approval requirements"],
        defaultMaxHelpers: 3,
    },
] as const satisfies readonly EditorialWorkflowPhasePreset[];

const intentPhaseOverrides: Partial<
    Record<EditorialWorkflowIntent, Partial<Record<EditorialWorkflowPhase, Partial<EditorialWorkflowPhasePreset>>>>
> = {
    page: {
        plan: {
            description: "Plan page content, route intent, block structure, entity clarity, and answerability before drafting.",
            outputSections: ["page goal", "route/entity constraints", "block plan", "answerability goals", "missing inputs"],
        },
    },
    contentUpdate: {
        discover: {
            description: "Locate the existing content and diagnose whether the issue is content, structure, relation, or policy related.",
            recommendedSpecialistIds: ["cms-structure-reviewer", "content-quality-auditor"],
            outputSections: ["target/content state", "diagnosis", "CMS constraints", "open questions"],
        },
        plan: {
            objective: "Create a bounded repair plan before rewriting existing content.",
            recommendedSpecialistIds: ["content-quality-auditor", "cms-structure-reviewer", "entity-optimizer"],
            outputSections: ["repair plan", "content gaps", "CMS constraints", "approval needs"],
        },
    },
    publishPreparation: {
        discover: {
            recommendedSpecialistIds: ["cms-structure-reviewer", "content-quality-auditor", "safety-reviewer"],
            defaultMaxHelpers: 3,
        },
        plan: {
            objective: "Identify publish blockers, approval requirements, and required fixes before a publish prepare/apply flow.",
            recommendedSpecialistIds: ["content-quality-auditor", "cms-structure-reviewer", "safety-reviewer"],
            outputSections: ["publish blockers", "required fixes", "approval requirements", "readback checks"],
            defaultMaxHelpers: 3,
        },
        review: {
            objective: "Decide whether content is ready to enter a prepared publish workflow.",
            recommendedSpecialistIds: ["content-quality-auditor", "geo-content-optimizer", "cms-structure-reviewer", "safety-reviewer"],
            outputSections: ["ship/fix/block verdict", "publish blockers", "GEO/content risks", "approval requirements"],
            defaultMaxHelpers: 4,
        },
    },
};

const unsafeEditorialActionPattern = /\b(delete|deleted|deleting|bypass|approval|approve|approved|shell|filesystem|file system|runtime)\b/iu;
const publishBypassPattern = /\bpublish(?:ing)?\b.*\b(now|without|bypass|approval|approve|approved)\b|\b(now|without|bypass|approval|approve|approved)\b.*\bpublish(?:ing)?\b/iu;

const testUnsafePattern = (pattern: RegExp, text: string): boolean => {
    pattern.lastIndex = 0;
    const matched = pattern.test(text);
    pattern.lastIndex = 0;
    return matched;
};

export const hasUnsafeEditorialWorkflowIntent = (text: string, additionalPatterns: readonly RegExp[] = []): boolean =>
    testUnsafePattern(unsafeEditorialActionPattern, text) ||
    testUnsafePattern(publishBypassPattern, text) ||
    additionalPatterns.some((pattern) => testUnsafePattern(pattern, text));

const clonePhasePreset = (phase: EditorialWorkflowPhasePreset): EditorialWorkflowPhasePreset =>
    Object.freeze({
        ...phase,
        recommendedSpecialistIds: Object.freeze([...phase.recommendedSpecialistIds]),
        mainAgentInstructions: Object.freeze([...phase.mainAgentInstructions]),
        outputSections: Object.freeze([...phase.outputSections]),
    });

const mergePhasePreset = (
    base: EditorialWorkflowPhasePreset,
    override: Partial<EditorialWorkflowPhasePreset> | undefined,
): EditorialWorkflowPhasePreset =>
    clonePhasePreset({
        ...base,
        ...override,
        phase: base.phase,
        recommendedSpecialistIds: override?.recommendedSpecialistIds ?? base.recommendedSpecialistIds,
        mainAgentInstructions: override?.mainAgentInstructions ?? base.mainAgentInstructions,
        outputSections: override?.outputSections ?? base.outputSections,
    });

const requireWorkflowPhase = (phase: EditorialWorkflowPhase): EditorialWorkflowPhasePreset => {
    const base = baseArticleWorkflowPhases.find((candidate) => candidate.phase === phase);
    if (!base) throw new Error(`Unknown editorial workflow phase: ${phase}`);
    return base;
};

const normalizeIntent = (intent: EditorialWorkflowIntent | undefined): EditorialWorkflowIntent => intent ?? "article";

export const getEditorialWorkflowPhasePreset = (
    phase: EditorialWorkflowPhase,
    intent: EditorialWorkflowIntent = "article",
): EditorialWorkflowPhasePreset => mergePhasePreset(requireWorkflowPhase(phase), intentPhaseOverrides[intent]?.[phase]);

export const createEditorialWorkflowPlan = (intent: EditorialWorkflowIntent = "article"): EditorialWorkflowPlan =>
    Object.freeze({
        intent,
        phases: Object.freeze(editorialWorkflowPhases.map((phase) => getEditorialWorkflowPhasePreset(phase, intent))),
    });

const uniqueSpecialistIds = (skillIds: readonly EditorialSpecialistId[]): EditorialSpecialistId[] => [...new Set(skillIds)];

export const getEditorialWorkflowSpecialistIds = (options: {
    phase: EditorialWorkflowPhase;
    intent?: EditorialWorkflowIntent;
    task?: string;
    context?: string;
    includeSafetyForUnsafeIntent?: boolean;
    additionalUnsafeIntentPatterns?: readonly RegExp[];
}): readonly EditorialSpecialistId[] => {
    const preset = getEditorialWorkflowPhasePreset(options.phase, normalizeIntent(options.intent));
    const skillIds = [...preset.recommendedSpecialistIds];
    const includeSafetyForUnsafeIntent = options.includeSafetyForUnsafeIntent ?? true;
    const text = [options.task, options.context].filter(Boolean).join(" ");
    if (includeSafetyForUnsafeIntent && text && hasUnsafeEditorialWorkflowIntent(text, options.additionalUnsafeIntentPatterns) && !skillIds.includes("safety-reviewer")) {
        skillIds.unshift("safety-reviewer");
    }
    return Object.freeze(uniqueSpecialistIds(skillIds));
};

export const createEditorialWorkflowConsultSummary = (
    phase: EditorialWorkflowPhase,
    intent: EditorialWorkflowIntent = "article",
    specialistIds?: readonly EditorialSpecialistId[],
): EditorialWorkflowConsultSummary => {
    const preset = getEditorialWorkflowPhasePreset(phase, intent);
    return Object.freeze({
        phase,
        intent,
        label: preset.label,
        objective: preset.objective,
        recommendedSpecialistIds: Object.freeze([...(specialistIds ?? preset.recommendedSpecialistIds)]),
        mainAgentInstructions: Object.freeze([...preset.mainAgentInstructions]),
        outputSections: Object.freeze([...preset.outputSections]),
    });
};

export const createEditorialWorkflowConsultRequest = (
    options: EditorialWorkflowConsultRequestOptions,
): SpecialistConsultRequest<EditorialSpecialistId> => {
    const intent = normalizeIntent(options.intent);
    const preset = getEditorialWorkflowPhasePreset(options.phase, intent);
    const specialistIds = getEditorialWorkflowSpecialistIds(options);
    return {
        task: options.task,
        ...(options.context ? { context: options.context } : {}),
        mode: options.phase,
        skillIds: specialistIds,
        maxHelpers: options.maxHelpers ?? preset.defaultMaxHelpers,
    };
};

export const createEditorialWorkflowPolicy = (options: {
    phase?: EditorialWorkflowPhase;
    intent?: EditorialWorkflowIntent;
    allowedCapabilities?: readonly EditorialSpecialistCapability[];
    deniedCapabilities?: readonly EditorialSpecialistCapability[];
    maxHelpers?: number;
    minConfidence?: number;
} = {}): SpecialistPolicy<EditorialSpecialistCapability> => {
    const defaultMaxHelpers = options.phase ? getEditorialWorkflowPhasePreset(options.phase, normalizeIntent(options.intent)).defaultMaxHelpers : undefined;
    return createEditorialSpecialistPolicy({
        allowedCapabilities: options.allowedCapabilities,
        deniedCapabilities: options.deniedCapabilities,
        maxHelpers: options.maxHelpers ?? defaultMaxHelpers,
        minConfidence: options.minConfidence,
    });
};

export const consultEditorialWorkflowPhase = async <TOutput = unknown>(
    options: ConsultEditorialWorkflowPhaseOptions<TOutput>,
): Promise<EditorialWorkflowPhaseConsultResult<TOutput>> => {
    const intent = normalizeIntent(options.intent);
    const request = createEditorialWorkflowConsultRequest(options);
    const result = await consultSpecialists(request, {
        registry: createEditorialSpecialistRegistry(),
        policy: options.policy ?? createEditorialWorkflowPolicy({ phase: options.phase, intent }),
        runner: options.runner,
        allowParallel: options.allowParallel,
    });
    return {
        ...result,
        workflow: createEditorialWorkflowConsultSummary(options.phase, intent, request.skillIds),
    };
};

const phaseParameterSchema = {
    anyOf: editorialWorkflowPhases.map((phase) => ({ const: phase })),
};

const intentParameterSchema = {
    anyOf: editorialWorkflowIntents.map((intent) => ({ const: intent })),
};

const createWorkflowToolParameters = () => ({
    type: "object",
    required: ["phase", "task"],
    properties: {
        phase: phaseParameterSchema,
        task: { type: "string", minLength: 1 },
        context: { type: "string" },
        intent: intentParameterSchema,
        maxHelpers: { type: "integer", minimum: 1 },
    },
});

const workflowToolRequestFromParams = (params: Record<string, unknown>, defaultIntent: EditorialWorkflowIntent): EditorialWorkflowConsultRequestOptions => ({
    phase: editorialWorkflowPhases.includes(params.phase as EditorialWorkflowPhase) ? (params.phase as EditorialWorkflowPhase) : "review",
    task: typeof params.task === "string" ? params.task : "",
    ...(typeof params.context === "string" ? { context: params.context } : {}),
    intent: editorialWorkflowIntents.includes(params.intent as EditorialWorkflowIntent) ? (params.intent as EditorialWorkflowIntent) : defaultIntent,
    ...(typeof params.maxHelpers === "number" ? { maxHelpers: params.maxHelpers } : {}),
});

export const createConsultEditorialWorkflowPhaseTool = <
    TToolName extends string = "consultEditorialWorkflowPhase",
    TOutput = unknown,
>(
    options: ConsultEditorialWorkflowPhaseToolOptions<TToolName, TOutput>,
): PiToolDefinition<TToolName> => {
    const name = (options.name ?? "consultEditorialWorkflowPhase") as TToolName;
    return {
        name,
        label: options.label ?? "Consult editorial workflow specialists",
        description:
            options.description ??
            "Run the specialist helpers recommended for an editorial workflow phase such as plan, draft, review, polish, or prepareMutation.",
        parameters: createWorkflowToolParameters(),
        async execute(_toolCallId, params = {}) {
            const result = await consultEditorialWorkflowPhase({
                ...workflowToolRequestFromParams(params, options.defaultIntent ?? "article"),
                additionalUnsafeIntentPatterns: options.additionalUnsafeIntentPatterns,
                runner: options.runner,
                policy: options.policy,
                allowParallel: options.allowParallel,
            });
            return createTextResult(JSON.stringify(result, null, 2), { kind: "consultEditorialWorkflowPhase", tool: name, ok: result.ok });
        },
    };
};
