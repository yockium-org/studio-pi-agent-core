import assert from "node:assert/strict";
import test from "node:test";

import {
    consultSpecialists,
    createConsultSpecialistsTool,
    createKeywordSpecialistRouter,
    createSpecialistRegistry,
    defineSpecialistSkill,
    routeSpecialists,
    type SpecialistRunner,
} from "../src/index.js";

type SkillId = "quality" | "geo" | "publisher";
type Capability = "read:cms" | "optimize:content" | "publish";

const qualitySkill = defineSpecialistSkill<SkillId, Capability>({
    id: "quality",
    label: "Content Quality Auditor",
    description: "Audits article and page drafts for clarity, evidence, trust, usefulness, and AI-slop risk.",
    whenToUse: ["audit content before publishing", "review article quality"],
    capabilities: ["read:cms", "optimize:content"],
});

const geoSkill = defineSpecialistSkill<SkillId, Capability>({
    id: "geo",
    label: "GEO Content Optimizer",
    description: "Improves pages so search engines and AI answer engines can cite clear answers.",
    whenToUse: ["optimize content for AI answers", "make a page more citable"],
    capabilities: ["read:cms", "optimize:content"],
});

const publisherSkill = defineSpecialistSkill<SkillId, Capability>({
    id: "publisher",
    label: "Publisher",
    description: "Publishes approved CMS content.",
    whenToUse: ["publish content"],
    capabilities: ["publish"],
});

const registry = createSpecialistRegistry<SkillId, Capability>([qualitySkill, geoSkill, publisherSkill]);

const readToolJson = (result: any) => JSON.parse(result.content[0].text);

test("specialist registry lists skills and rejects duplicate ids", () => {
    assert.deepEqual(registry.list().map((skill) => skill.id), ["quality", "geo", "publisher"]);
    assert.equal(registry.get("quality")?.label, "Content Quality Auditor");
    assert.equal(registry.has("unknown"), false);

    assert.throws(
        () => createSpecialistRegistry([qualitySkill, qualitySkill]),
        /Duplicate specialist skill id: quality/,
    );
});

test("keyword specialist router selects likely advisory skills", async () => {
    const result = await routeSpecialists(
        { task: "Audit this article for evidence, trust, clarity, and AI-slop before publishing." },
        {
            registry,
            router: createKeywordSpecialistRouter(),
            policy: { allowedCapabilities: ["read:cms", "optimize:content"], maxHelpers: 1 },
        },
    );

    assert.deepEqual(result.selections.map((selection) => selection.skill.id), ["quality"]);
    assert.equal(result.rejectedByPolicy[0]?.skillId, "publisher");
    assert.equal(result.rejectedByPolicy[0]?.capability, "publish");
});

test("explicit routing reports unknown skills and policy rejections", async () => {
    const result = await routeSpecialists(
        { task: "Please publish it", skillIds: ["publisher", "missing"] },
        {
            registry: createSpecialistRegistry<string, Capability>([qualitySkill, geoSkill, publisherSkill]),
            policy: { deniedCapabilities: ["publish"] },
        },
    );

    assert.deepEqual(result.selections, []);
    assert.deepEqual(result.unknownSkillIds, ["missing"]);
    assert.equal(result.rejectedByPolicy.length, 1);
    assert.equal(result.rejectedByPolicy[0]?.reason, "Capability 'publish' is denied by specialist policy.");
});

test("policy maxHelpers is a hard upper bound even when the request asks for more", async () => {
    const result = await routeSpecialists(
        { task: "Review and optimize this content", maxHelpers: 99 },
        {
            registry,
            router: () => [
                { skillId: "quality", confidence: 0.9 },
                { skillId: "geo", confidence: 0.8 },
            ],
            policy: { allowedCapabilities: ["read:cms", "optimize:content"], maxHelpers: 1 },
        },
    );

    assert.deepEqual(result.selections.map((selection) => selection.skill.id), ["quality"]);
});

test("allowed-capabilities policy rejects unclassified specialist skills", async () => {
    const unclassified = defineSpecialistSkill<string, Capability>({
        id: "unclassified",
        label: "Unclassified helper",
        description: "A helper without explicit capability tags.",
        capabilities: [],
    });
    const result = await routeSpecialists(
        { task: "Use the unclassified helper", skillIds: ["unclassified"] },
        {
            registry: createSpecialistRegistry<string, Capability>([unclassified]),
            policy: { allowedCapabilities: ["read:cms"] },
        },
    );

    assert.deepEqual(result.selections, []);
    assert.equal(
        result.rejectedByPolicy[0]?.reason,
        "Specialist skill declares no capabilities and cannot satisfy an allowed-capabilities policy.",
    );
});

test("consultSpecialists lets helpers accept or decline after routing", async () => {
    const runner: SpecialistRunner<SkillId, Capability, { verdict: string }> = ({ skill }) => {
        if (skill.id === "geo") {
            return { decision: "decline", reason: "This is a publish-readiness audit, not a GEO rewrite.", suggestedSkillId: "quality" };
        }
        return { decision: "accept", reason: "Quality audit applies.", result: { verdict: "fix" } };
    };

    const result = await consultSpecialists(
        { task: "Review this article before publishing", maxHelpers: 2 },
        {
            registry,
            router: () => [
                { skillId: "quality", confidence: 0.91, reason: "Audit requested." },
                { skillId: "geo", confidence: 0.7, reason: "Content optimization might help." },
                { skillId: "publisher", confidence: 0.99, reason: "Publish was mentioned." },
            ],
            policy: { allowedCapabilities: ["read:cms", "optimize:content"] },
            runner,
            allowParallel: false,
        },
    );

    assert.equal(result.ok, true);
    assert.deepEqual(result.selected.map((selection) => selection.skillId), ["quality", "geo"]);
    assert.deepEqual(result.accepted, [
        { skillId: "quality", label: "Content Quality Auditor", reason: "Quality audit applies.", result: { verdict: "fix" } },
    ]);
    assert.deepEqual(result.declined, [
        { skillId: "geo", label: "GEO Content Optimizer", reason: "This is a publish-readiness audit, not a GEO rewrite.", suggestedSkillId: "quality" },
    ]);
    assert.equal(result.rejectedByPolicy[0]?.skillId, "publisher");
});

test("consultSpecialists records runner errors without crashing the whole consult", async () => {
    const result = await consultSpecialists(
        { task: "Review article quality", skillIds: ["quality"] },
        {
            registry,
            runner: () => {
                throw new Error("worker unavailable");
            },
        },
    );

    assert.equal(result.ok, false);
    assert.deepEqual(result.accepted, []);
    assert.deepEqual(result.errored, [{ skillId: "quality", label: "Content Quality Auditor", error: "worker unavailable" }]);
});

test("createConsultSpecialistsTool exposes a Pi-compatible advisory helper tool", async () => {
    const tool = createConsultSpecialistsTool({
        registry,
        router: () => [{ skillId: "quality", confidence: 0.88, reason: "Quality audit requested." }],
        policy: { allowedCapabilities: ["read:cms", "optimize:content"] },
        runner: () => ({ decision: "accept", result: { verdict: "ship" } }),
    });

    assert.equal(tool.name, "consultSpecialists");
    assert.equal(tool.parameters?.type, "object");

    const payload = readToolJson(await tool.execute("call-1", { task: "Audit this article before publishing" }));
    assert.equal(payload.ok, true);
    assert.deepEqual(payload.selected.map((selection: any) => selection.skillId), ["quality"]);
    assert.deepEqual(payload.accepted[0].result, { verdict: "ship" });
});
