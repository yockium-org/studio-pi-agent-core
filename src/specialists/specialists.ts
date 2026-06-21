import { createTextResult } from "../responses/result.js";
import type { PiToolDefinition } from "../extension/editorial-extension.js";

export type SpecialistSkill<TSkillId extends string = string, TCapability extends string = string> = {
    id: TSkillId;
    label: string;
    description: string;
    whenToUse?: readonly string[];
    capabilities: readonly TCapability[];
    metadata?: Readonly<Record<string, unknown>>;
};

export type SpecialistRegistry<TSkillId extends string = string, TCapability extends string = string> = {
    list(): SpecialistSkill<TSkillId, TCapability>[];
    get(skillId: TSkillId | string): SpecialistSkill<TSkillId, TCapability> | undefined;
    has(skillId: TSkillId | string): boolean;
};

export type SpecialistConsultRequest<TSkillId extends string = string> = {
    task: string;
    context?: string;
    mode?: string;
    skillIds?: readonly TSkillId[];
    maxHelpers?: number;
};

export type SpecialistPolicy<TCapability extends string = string> = {
    allowedCapabilities?: readonly TCapability[];
    deniedCapabilities?: readonly TCapability[];
    maxHelpers?: number;
    minConfidence?: number;
};

export type SpecialistPolicyRejection<TSkillId extends string = string, TCapability extends string = string> = {
    skillId: TSkillId;
    label: string;
    capability?: TCapability;
    reason: string;
};

export type SpecialistRouteCandidate<TSkillId extends string = string> = {
    skillId: TSkillId;
    confidence?: number;
    reason?: string;
};

export type SpecialistSelection<TSkillId extends string = string, TCapability extends string = string> = {
    skill: SpecialistSkill<TSkillId, TCapability>;
    confidence: number;
    reason?: string;
};

export type SpecialistRouter<TSkillId extends string = string, TCapability extends string = string> = (args: {
    request: SpecialistConsultRequest<TSkillId>;
    candidates: readonly SpecialistSkill<TSkillId, TCapability>[];
}) => SpecialistRouteCandidate<TSkillId>[] | Promise<SpecialistRouteCandidate<TSkillId>[]>;

export type SpecialistRouteResult<TSkillId extends string = string, TCapability extends string = string> = {
    selections: SpecialistSelection<TSkillId, TCapability>[];
    rejectedByPolicy: SpecialistPolicyRejection<TSkillId, TCapability>[];
    unknownSkillIds: string[];
};

export type SpecialistDecision<TOutput = unknown, TSkillId extends string = string> =
    | {
          decision: "accept";
          reason?: string;
          result: TOutput;
      }
    | {
          decision: "decline";
          reason: string;
          suggestedSkillId?: TSkillId | string;
      };

export type SpecialistRunner<TSkillId extends string = string, TCapability extends string = string, TOutput = unknown> = (args: {
    request: SpecialistConsultRequest<TSkillId>;
    selection: SpecialistSelection<TSkillId, TCapability>;
    skill: SpecialistSkill<TSkillId, TCapability>;
}) => SpecialistDecision<TOutput, TSkillId> | Promise<SpecialistDecision<TOutput, TSkillId>>;

export type SpecialistAcceptedResult<TSkillId extends string = string, TOutput = unknown> = {
    skillId: TSkillId;
    label: string;
    reason?: string;
    result: TOutput;
};

export type SpecialistDeclinedResult<TSkillId extends string = string> = {
    skillId: TSkillId;
    label: string;
    reason: string;
    suggestedSkillId?: TSkillId | string;
};

export type SpecialistErroredResult<TSkillId extends string = string> = {
    skillId: TSkillId;
    label: string;
    error: string;
};

export type SpecialistSelectedSummary<TSkillId extends string = string> = {
    skillId: TSkillId;
    label: string;
    confidence: number;
    reason?: string;
};

export type SpecialistConsultResult<TSkillId extends string = string, TCapability extends string = string, TOutput = unknown> = {
    ok: boolean;
    task: string;
    mode: string;
    selected: SpecialistSelectedSummary<TSkillId>[];
    accepted: SpecialistAcceptedResult<TSkillId, TOutput>[];
    declined: SpecialistDeclinedResult<TSkillId>[];
    errored: SpecialistErroredResult<TSkillId>[];
    rejectedByPolicy: SpecialistPolicyRejection<TSkillId, TCapability>[];
    unknownSkillIds: string[];
};

export type ConsultSpecialistsOptions<TSkillId extends string = string, TCapability extends string = string, TOutput = unknown> = {
    registry: SpecialistRegistry<TSkillId, TCapability>;
    runner: SpecialistRunner<TSkillId, TCapability, TOutput>;
    router?: SpecialistRouter<TSkillId, TCapability>;
    policy?: SpecialistPolicy<TCapability>;
    allowParallel?: boolean;
};

export type ConsultSpecialistsToolOptions<
    TToolName extends string = "consultSpecialists",
    TSkillId extends string = string,
    TCapability extends string = string,
    TOutput = unknown,
> = ConsultSpecialistsOptions<TSkillId, TCapability, TOutput> & {
    name?: TToolName;
    label?: string;
    description?: string;
};

const defaultMaxHelpers = 2;

const defaultMode = "auto";

const normalizeTask = (task: string): string => task.trim();

const normalizeText = (text: string): string => text.toLocaleLowerCase();

const tokenize = (text: string): Set<string> => new Set(normalizeText(text).match(/[\p{L}\p{N}]{3,}/gu) ?? []);

const normalizeConfidence = (confidence: number | undefined): number => {
    if (typeof confidence !== "number" || !Number.isFinite(confidence)) return 0.5;
    return Math.max(0, Math.min(1, confidence));
};

const summarizeError = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown specialist runner error";
};

const normalizeSkillIds = (skillIds: readonly string[] | undefined): string[] => {
    if (!Array.isArray(skillIds)) return [];
    return [...new Set(skillIds.map((skillId) => skillId.trim()).filter(Boolean))];
};

const resolveMaxHelpers = (request: SpecialistConsultRequest, policy: SpecialistPolicy | undefined): number => {
    const requestMax = typeof request.maxHelpers === "number" && Number.isInteger(request.maxHelpers) && request.maxHelpers > 0 ? request.maxHelpers : undefined;
    const policyMax = typeof policy?.maxHelpers === "number" && Number.isInteger(policy.maxHelpers) && policy.maxHelpers > 0 ? policy.maxHelpers : undefined;
    const requestedOrDefault = requestMax ?? policyMax ?? defaultMaxHelpers;
    return policyMax ? Math.min(requestedOrDefault, policyMax) : requestedOrDefault;
};

const getPolicyRejection = <TSkillId extends string, TCapability extends string>(
    skill: SpecialistSkill<TSkillId, TCapability>,
    policy?: SpecialistPolicy<TCapability>,
): SpecialistPolicyRejection<TSkillId, TCapability> | undefined => {
    if (!policy) return undefined;

    const capabilities = skill.capabilities ?? [];
    const deniedCapabilities = new Set(policy.deniedCapabilities ?? []);
    for (const capability of capabilities) {
        if (deniedCapabilities.has(capability)) {
            return {
                skillId: skill.id,
                label: skill.label,
                capability,
                reason: `Capability '${capability}' is denied by specialist policy.`,
            };
        }
    }

    if (policy.allowedCapabilities) {
        if (capabilities.length === 0) {
            return {
                skillId: skill.id,
                label: skill.label,
                reason: "Specialist skill declares no capabilities and cannot satisfy an allowed-capabilities policy.",
            };
        }

        const allowedCapabilities = new Set(policy.allowedCapabilities);
        for (const capability of capabilities) {
            if (!allowedCapabilities.has(capability)) {
                return {
                    skillId: skill.id,
                    label: skill.label,
                    capability,
                    reason: `Capability '${capability}' is not allowed by specialist policy.`,
                };
            }
        }
    }

    return undefined;
};

export const defineSpecialistSkill = <TSkillId extends string, TCapability extends string>(
    skill: SpecialistSkill<TSkillId, TCapability>,
): SpecialistSkill<TSkillId, TCapability> => skill;

export const createSpecialistRegistry = <TSkillId extends string, TCapability extends string>(
    skills: readonly SpecialistSkill<TSkillId, TCapability>[],
): SpecialistRegistry<TSkillId, TCapability> => {
    const byId = new Map<string, SpecialistSkill<TSkillId, TCapability>>();
    for (const skill of skills) {
        if (!skill.id.trim()) throw new Error("Specialist skill id must be non-empty.");
        if (byId.has(skill.id)) throw new Error(`Duplicate specialist skill id: ${skill.id}`);
        byId.set(skill.id, skill);
    }

    return {
        list() {
            return [...byId.values()];
        },
        get(skillId: TSkillId | string) {
            return byId.get(skillId);
        },
        has(skillId: TSkillId | string) {
            return byId.has(skillId);
        },
    };
};

export const isSpecialistAllowedByPolicy = <TSkillId extends string, TCapability extends string>(
    skill: SpecialistSkill<TSkillId, TCapability>,
    policy?: SpecialistPolicy<TCapability>,
): boolean => !getPolicyRejection(skill, policy);

export const createKeywordSpecialistRouter = <TSkillId extends string, TCapability extends string>(): SpecialistRouter<TSkillId, TCapability> => {
    return ({ request, candidates }) => {
        const requestTokens = tokenize([request.task, request.context, request.mode].filter(Boolean).join(" "));
        const scoredCandidates: SpecialistRouteCandidate<TSkillId>[] = [];

        for (const skill of candidates) {
            const skillTokens = tokenize([skill.id, skill.label, skill.description, ...(skill.whenToUse ?? [])].join(" "));
            let overlap = 0;
            for (const token of requestTokens) {
                if (skillTokens.has(token)) overlap += 1;
            }
            if (overlap === 0) continue;
            scoredCandidates.push({
                skillId: skill.id,
                confidence: Math.min(0.95, 0.35 + overlap * 0.1),
                reason: `Matched ${overlap} specialist keyword${overlap === 1 ? "" : "s"}.`,
            });
        }

        return scoredCandidates.sort((left, right) => normalizeConfidence(right.confidence) - normalizeConfidence(left.confidence));
    };
};

export const routeSpecialists = async <TSkillId extends string, TCapability extends string>(
    request: SpecialistConsultRequest<TSkillId>,
    options: {
        registry: SpecialistRegistry<TSkillId, TCapability>;
        router?: SpecialistRouter<TSkillId, TCapability>;
        policy?: SpecialistPolicy<TCapability>;
    },
): Promise<SpecialistRouteResult<TSkillId, TCapability>> => {
    const task = normalizeTask(request.task);
    if (!task) throw new TypeError("Specialist consult task must be a non-empty string.");

    const requestedSkillIds = normalizeSkillIds(request.skillIds);
    const allSkills = options.registry.list();
    const unknownSkillIds = requestedSkillIds.filter((skillId) => !options.registry.has(skillId));
    const candidatePool = requestedSkillIds.length > 0
        ? requestedSkillIds.flatMap((skillId) => {
              const skill = options.registry.get(skillId);
              return skill ? [skill] : [];
          })
        : allSkills;

    const rejectedByPolicy: SpecialistPolicyRejection<TSkillId, TCapability>[] = [];
    const policyAllowedSkills: SpecialistSkill<TSkillId, TCapability>[] = [];
    for (const skill of candidatePool) {
        const rejection = getPolicyRejection(skill, options.policy);
        if (rejection) rejectedByPolicy.push(rejection);
        else policyAllowedSkills.push(skill);
    }

    const router = options.router ?? createKeywordSpecialistRouter<TSkillId, TCapability>();
    const routeCandidates = requestedSkillIds.length > 0
        ? policyAllowedSkills.map((skill) => ({ skillId: skill.id, confidence: 1, reason: "Specialist was explicitly requested." }))
        : await router({ request: { ...request, task }, candidates: policyAllowedSkills });

    const bySkillId = new Map(policyAllowedSkills.map((skill) => [skill.id, skill]));
    const minConfidence = normalizeConfidence(options.policy?.minConfidence ?? 0);
    const seen = new Set<string>();
    const sortedCandidates = [...routeCandidates].sort((left, right) => normalizeConfidence(right.confidence) - normalizeConfidence(left.confidence));
    const selections: SpecialistSelection<TSkillId, TCapability>[] = [];

    for (const routeCandidate of sortedCandidates) {
        if (seen.has(routeCandidate.skillId)) continue;
        seen.add(routeCandidate.skillId);
        const confidence = normalizeConfidence(routeCandidate.confidence);
        if (confidence < minConfidence) continue;
        const skill = bySkillId.get(routeCandidate.skillId);
        if (!skill) continue;
        selections.push({ skill, confidence, reason: routeCandidate.reason });
    }

    return {
        selections: selections.slice(0, resolveMaxHelpers(request, options.policy)),
        rejectedByPolicy,
        unknownSkillIds,
    };
};

const selectedSummary = <TSkillId extends string, TCapability extends string>(
    selection: SpecialistSelection<TSkillId, TCapability>,
): SpecialistSelectedSummary<TSkillId> => ({
    skillId: selection.skill.id,
    label: selection.skill.label,
    confidence: selection.confidence,
    ...(selection.reason ? { reason: selection.reason } : {}),
});

const runSpecialist = async <TSkillId extends string, TCapability extends string, TOutput>(
    request: SpecialistConsultRequest<TSkillId>,
    selection: SpecialistSelection<TSkillId, TCapability>,
    runner: SpecialistRunner<TSkillId, TCapability, TOutput>,
): Promise<
    | { kind: "accepted"; value: SpecialistAcceptedResult<TSkillId, TOutput> }
    | { kind: "declined"; value: SpecialistDeclinedResult<TSkillId> }
    | { kind: "errored"; value: SpecialistErroredResult<TSkillId> }
> => {
    try {
        const decision = await runner({ request, selection, skill: selection.skill });
        if (decision.decision === "accept") {
            return {
                kind: "accepted",
                value: {
                    skillId: selection.skill.id,
                    label: selection.skill.label,
                    ...(decision.reason ? { reason: decision.reason } : {}),
                    result: decision.result,
                },
            };
        }
        return {
            kind: "declined",
            value: {
                skillId: selection.skill.id,
                label: selection.skill.label,
                reason: decision.reason,
                ...(decision.suggestedSkillId ? { suggestedSkillId: decision.suggestedSkillId } : {}),
            },
        };
    } catch (error) {
        return { kind: "errored", value: { skillId: selection.skill.id, label: selection.skill.label, error: summarizeError(error) } };
    }
};

export const consultSpecialists = async <TSkillId extends string, TCapability extends string, TOutput = unknown>(
    request: SpecialistConsultRequest<TSkillId>,
    options: ConsultSpecialistsOptions<TSkillId, TCapability, TOutput>,
): Promise<SpecialistConsultResult<TSkillId, TCapability, TOutput>> => {
    const task = normalizeTask(request.task);
    const normalizedRequest = { ...request, task, mode: request.mode ?? defaultMode };
    const route = await routeSpecialists(normalizedRequest, options);
    const selected = route.selections.map(selectedSummary);
    const accepted: SpecialistAcceptedResult<TSkillId, TOutput>[] = [];
    const declined: SpecialistDeclinedResult<TSkillId>[] = [];
    const errored: SpecialistErroredResult<TSkillId>[] = [];

    const recordRunResult = (runResult: Awaited<ReturnType<typeof runSpecialist<TSkillId, TCapability, TOutput>>>) => {
        if (runResult.kind === "accepted") accepted.push(runResult.value);
        if (runResult.kind === "declined") declined.push(runResult.value);
        if (runResult.kind === "errored") errored.push(runResult.value);
    };

    if (options.allowParallel === false) {
        for (const selection of route.selections) {
            recordRunResult(await runSpecialist(normalizedRequest, selection, options.runner));
        }
    } else {
        const runResults = await Promise.all(route.selections.map((selection) => runSpecialist(normalizedRequest, selection, options.runner)));
        for (const runResult of runResults) recordRunResult(runResult);
    }

    return {
        ok: errored.length === 0,
        task,
        mode: normalizedRequest.mode,
        selected,
        accepted,
        declined,
        errored,
        rejectedByPolicy: route.rejectedByPolicy,
        unknownSkillIds: route.unknownSkillIds,
    };
};

const consultSpecialistsToolParameters = {
    type: "object",
    required: ["task"],
    properties: {
        task: { type: "string", minLength: 1 },
        context: { type: "string" },
        mode: { type: "string" },
        skillIds: { type: "array", items: { type: "string", minLength: 1 } },
        maxHelpers: { type: "integer", minimum: 1 },
    },
};

const requestFromToolParams = <TSkillId extends string>(params: Record<string, unknown>): SpecialistConsultRequest<TSkillId> => ({
    task: typeof params.task === "string" ? params.task : "",
    ...(typeof params.context === "string" ? { context: params.context } : {}),
    ...(typeof params.mode === "string" ? { mode: params.mode } : {}),
    ...(Array.isArray(params.skillIds) ? { skillIds: params.skillIds.filter((skillId): skillId is TSkillId => typeof skillId === "string") } : {}),
    ...(typeof params.maxHelpers === "number" ? { maxHelpers: params.maxHelpers } : {}),
});

export const createConsultSpecialistsTool = <
    TToolName extends string = "consultSpecialists",
    TSkillId extends string = string,
    TCapability extends string = string,
    TOutput = unknown,
>(
    options: ConsultSpecialistsToolOptions<TToolName, TSkillId, TCapability, TOutput>,
): PiToolDefinition<TToolName> => {
    const name = (options.name ?? "consultSpecialists") as TToolName;
    return {
        name,
        label: options.label ?? "Consult specialist helpers",
        description:
            options.description ??
            "Route a task to one or more advisory specialist helpers. Helpers may accept or decline based on their own fit check.",
        parameters: consultSpecialistsToolParameters,
        async execute(_toolCallId, params = {}) {
            const result = await consultSpecialists(requestFromToolParams<TSkillId>(params), options);
            return createTextResult(JSON.stringify(result, null, 2), { kind: "consultSpecialists", tool: name, ok: result.ok });
        },
    };
};
