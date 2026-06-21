import {
    createKeywordSpecialistRouter,
    createSpecialistRegistry,
    type SpecialistPolicy,
    type SpecialistRegistry,
    type SpecialistRouter,
    type SpecialistSkill,
} from "./specialists.js";

const editorialSpecialistIdValues = [
    "content-quality-auditor",
    "geo-content-optimizer",
    "entity-optimizer",
    "cms-structure-reviewer",
    "safety-reviewer",
] as const;

export type EditorialSpecialistId = (typeof editorialSpecialistIdValues)[number];

export const editorialSpecialistIds: readonly EditorialSpecialistId[] = Object.freeze([...editorialSpecialistIdValues]);

const editorialSpecialistCapabilityValues = [
    "read:cms",
    "review:content",
    "optimize:content",
    "review:entity",
    "review:structure",
    "review:safety",
    "write:draft",
    "publish",
    "delete",
    "runtime:shell",
    "runtime:filesystem",
] as const;

export type EditorialSpecialistCapability = (typeof editorialSpecialistCapabilityValues)[number];

export const editorialSpecialistCapabilities: readonly EditorialSpecialistCapability[] = Object.freeze([...editorialSpecialistCapabilityValues]);

export type EditorialSpecialistPrompt = {
    role: string;
    instructions: readonly string[];
    outputSections: readonly string[];
};

export type EditorialSpecialistMetadata = Readonly<{
    prompt: EditorialSpecialistPrompt;
    piSkillName?: "content-quality-auditor" | "geo-content-optimizer" | "entity-optimizer";
    execution: "advisory";
}>;

export type EditorialSpecialistSkill = SpecialistSkill<EditorialSpecialistId, EditorialSpecialistCapability> & {
    metadata: EditorialSpecialistMetadata;
};

export type EditorialSpecialistPolicyOptions = {
    allowedCapabilities?: readonly EditorialSpecialistCapability[];
    deniedCapabilities?: readonly EditorialSpecialistCapability[];
    maxHelpers?: number;
    minConfidence?: number;
};

const defaultSafeEditorialSpecialistCapabilities = Object.freeze([
    "read:cms",
    "review:content",
    "optimize:content",
    "review:entity",
    "review:structure",
    "review:safety",
] as const satisfies readonly EditorialSpecialistCapability[]);

const hardDeniedEditorialSpecialistCapabilities = Object.freeze([
    "write:draft",
    "publish",
    "delete",
    "runtime:shell",
    "runtime:filesystem",
] as const satisfies readonly EditorialSpecialistCapability[]);

export const safeEditorialSpecialistCapabilities: readonly EditorialSpecialistCapability[] = defaultSafeEditorialSpecialistCapabilities;

export const deniedEditorialSpecialistCapabilities: readonly EditorialSpecialistCapability[] = hardDeniedEditorialSpecialistCapabilities;

const editorialSpecialistSkills = [
    {
        id: "content-quality-auditor",
        label: "Content Quality Auditor",
        description: "Audits drafts and existing pages for clarity, usefulness, evidence, trust, SEO/GEO readiness, and AI-slop risk.",
        whenToUse: [
            "review article or page content before publishing",
            "audit content quality, usefulness, trust, evidence, or AI-slop risk",
            "decide whether a draft should ship, be fixed, or be blocked",
        ],
        capabilities: ["read:cms", "review:content", "optimize:content"],
        metadata: {
            piSkillName: "content-quality-auditor",
            execution: "advisory",
            prompt: {
                role: "Content quality auditor",
                instructions: [
                    "Assess whether the content is useful, clear, specific, trustworthy, and ready for publication.",
                    "Call out missing evidence, vague claims, thin sections, duplicated ideas, and AI-slop risk.",
                    "Give a ship/fix/block verdict with concrete changes before any publishing decision.",
                ],
                outputSections: ["verdict", "blocking issues", "recommended fixes", "evidence/trust notes"],
            },
        },
    },
    {
        id: "geo-content-optimizer",
        label: "GEO Content Optimizer",
        description: "Improves drafts and pages so search engines and AI answer engines can identify, quote, and cite clear answers.",
        whenToUse: [
            "optimize content for AI answers, search snippets, or GEO",
            "make a page more quotable, citable, or answer-ready",
            "improve headings, direct answers, summaries, or structured facts",
        ],
        capabilities: ["read:cms", "review:content", "optimize:content"],
        metadata: {
            piSkillName: "geo-content-optimizer",
            execution: "advisory",
            prompt: {
                role: "GEO content optimizer",
                instructions: [
                    "Make the content easier for search engines and AI answer engines to parse and cite.",
                    "Prefer direct answers, clear entities, concise summaries, quotable facts, and well-scoped headings.",
                    "Do not invent facts; mark where the project needs source material or proof.",
                ],
                outputSections: ["answerability gaps", "quotable facts", "structure changes", "entity clarity notes"],
            },
        },
    },
    {
        id: "entity-optimizer",
        label: "Entity Optimizer",
        description: "Clarifies brand, person, project, service, and topic entities so humans and answer engines can disambiguate them.",
        whenToUse: [
            "clarify a brand, person, project, service, author, or topic entity",
            "disambiguate entity names, descriptions, relationships, or canonical facts",
            "make the content identify who or what the page is about",
        ],
        capabilities: ["read:cms", "review:entity", "optimize:content"],
        metadata: {
            piSkillName: "entity-optimizer",
            execution: "advisory",
            prompt: {
                role: "Entity optimizer",
                instructions: [
                    "Identify the primary entity and related entities in the content.",
                    "Check whether names, descriptions, relationships, locations, and canonical facts are explicit and consistent.",
                    "Recommend wording that improves disambiguation without adding unsupported claims.",
                ],
                outputSections: ["primary entity", "related entities", "ambiguities", "recommended facts/wording"],
            },
        },
    },
    {
        id: "cms-structure-reviewer",
        label: "CMS Structure Reviewer",
        description: "Reviews whether the right Payload collections, routes, locales, and blocks are being used for an editorial task.",
        whenToUse: [
            "choose the right Payload block, route, collection, or locale",
            "review CMS structure before creating or changing content",
            "map editorial intent to page builder or article structure",
        ],
        capabilities: ["read:cms", "review:structure"],
        metadata: {
            execution: "advisory",
            prompt: {
                role: "CMS structure reviewer",
                instructions: [
                    "Check whether the requested content belongs in the proposed collection, route, locale, and block structure.",
                    "Prefer existing project conventions over generic CMS advice.",
                    "Flag missing prerequisites before any draft-writing workflow starts.",
                ],
                outputSections: ["recommended CMS target", "block/route notes", "missing prerequisites", "risks"],
            },
        },
    },
    {
        id: "safety-reviewer",
        label: "Safety Reviewer",
        description: "Reviews whether an agent request stays within read-only/advisory policy and whether write/publish approval gates are needed.",
        whenToUse: [
            "check if a request tries to bypass approval, publish, delete, or write without review",
            "block requests for shell, filesystem, runtime tools, or unsafe side effects",
            "review safety policy for an agent action",
            "decide whether a tool or helper should be blocked by capability policy",
        ],
        capabilities: ["review:safety"],
        metadata: {
            execution: "advisory",
            prompt: {
                role: "Agent safety reviewer",
                instructions: [
                    "Check whether the request stays inside the configured capability policy.",
                    "Flag attempts to bypass approval, publish, delete, access shell/filesystem, or change CMS state without explicit gates.",
                    "Recommend the safest allowed next step for the main agent.",
                ],
                outputSections: ["policy verdict", "blocked capabilities", "approval requirements", "safe next step"],
            },
        },
    },
] as const satisfies readonly EditorialSpecialistSkill[];

const cloneSkill = (skill: EditorialSpecialistSkill): EditorialSpecialistSkill => ({
    ...skill,
    whenToUse: [...(skill.whenToUse ?? [])],
    capabilities: [...skill.capabilities],
    metadata: {
        ...skill.metadata,
        prompt: {
            role: skill.metadata.prompt.role,
            instructions: [...skill.metadata.prompt.instructions],
            outputSections: [...skill.metadata.prompt.outputSections],
        },
    },
});

export const createEditorialSpecialistSkills = (): EditorialSpecialistSkill[] => editorialSpecialistSkills.map(cloneSkill);

export const createEditorialSpecialistRegistry = (): SpecialistRegistry<EditorialSpecialistId, EditorialSpecialistCapability> =>
    createSpecialistRegistry(createEditorialSpecialistSkills());

export const getEditorialSpecialistPrompt = (skillId: EditorialSpecialistId | string): EditorialSpecialistPrompt | undefined => {
    const skill = editorialSpecialistSkills.find((candidate) => candidate.id === skillId);
    return skill
        ? {
              role: skill.metadata.prompt.role,
              instructions: [...skill.metadata.prompt.instructions],
              outputSections: [...skill.metadata.prompt.outputSections],
          }
        : undefined;
};

const unsafeEditorialActionPattern = /\b(delete|deleted|deleting|bypass|approval|approve|approved|shell|filesystem|file system|runtime)\b/iu;
const publishBypassPattern = /\bpublish(?:ing)?\b.*\b(now|without|bypass|approval|approve|approved)\b|\b(now|without|bypass|approval|approve|approved)\b.*\bpublish(?:ing)?\b/iu;

const hasUnsafeEditorialIntent = (text: string): boolean => unsafeEditorialActionPattern.test(text) || publishBypassPattern.test(text);

export const createEditorialSpecialistRouter = (): SpecialistRouter<EditorialSpecialistId, EditorialSpecialistCapability> => {
    const keywordRouter = createKeywordSpecialistRouter<EditorialSpecialistId, EditorialSpecialistCapability>();
    return async (args) => {
        const routed = await keywordRouter(args);
        const text = [args.request.task, args.request.context, args.request.mode].filter(Boolean).join(" ");
        if (!hasUnsafeEditorialIntent(text) || !args.candidates.some((candidate) => candidate.id === "safety-reviewer")) return routed;

        return [
            {
                skillId: "safety-reviewer",
                confidence: 1,
                reason: "Unsafe-intent terms should be reviewed by safety policy.",
            },
            ...routed.filter((candidate) => candidate.skillId !== "safety-reviewer"),
        ];
    };
};

const uniqueCapabilities = (capabilities: readonly EditorialSpecialistCapability[]): EditorialSpecialistCapability[] => [...new Set(capabilities)];

export const createEditorialSpecialistPolicy = (
    options: EditorialSpecialistPolicyOptions = {},
): SpecialistPolicy<EditorialSpecialistCapability> =>
    Object.freeze({
        allowedCapabilities: Object.freeze([...(options.allowedCapabilities ?? defaultSafeEditorialSpecialistCapabilities)]),
        deniedCapabilities: Object.freeze(uniqueCapabilities([...hardDeniedEditorialSpecialistCapabilities, ...(options.deniedCapabilities ?? [])])),
        maxHelpers: options.maxHelpers ?? 2,
        minConfidence: options.minConfidence ?? 0.35,
    });
