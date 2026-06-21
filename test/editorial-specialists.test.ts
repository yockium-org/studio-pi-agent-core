import assert from "node:assert/strict";
import test from "node:test";

import {
    createEditorialSpecialistPolicy,
    createEditorialSpecialistRegistry,
    createEditorialSpecialistRouter,
    createEditorialSpecialistSkills,
    deniedEditorialSpecialistCapabilities,
    editorialSpecialistCapabilities,
    editorialSpecialistIds,
    getEditorialSpecialistPrompt,
    routeSpecialists,
    safeEditorialSpecialistCapabilities,
    type EditorialSpecialistCapability,
} from "../src/index.js";

test("editorial specialist presets expose the expected advisory helper cards", () => {
    const skills = createEditorialSpecialistSkills();

    assert.deepEqual(skills.map((skill) => skill.id), [...editorialSpecialistIds]);
    assert.deepEqual(skills.map((skill) => skill.metadata.execution), ["advisory", "advisory", "advisory", "advisory", "advisory"]);
    assert.deepEqual(
        skills.flatMap((skill) => skill.capabilities).filter((capability) => capability.startsWith("runtime:")),
        [],
    );
    assert.deepEqual(
        skills.flatMap((skill) => skill.capabilities).filter((capability) => ["write:draft", "publish", "delete"].includes(capability)),
        [],
    );
});

test("editorial specialist presets return defensive copies", () => {
    const first = createEditorialSpecialistSkills();
    const firstSkill = first[0];
    assert(firstSkill);
    (firstSkill.capabilities as EditorialSpecialistCapability[]).splice(0, firstSkill.capabilities.length, "publish");
    (firstSkill.metadata.prompt.instructions as string[]).splice(0, firstSkill.metadata.prompt.instructions.length, "mutated");

    const second = createEditorialSpecialistSkills();
    assert.notDeepEqual(second[0]?.capabilities, ["publish"]);
    assert.notDeepEqual(second[0]?.metadata.prompt.instructions, ["mutated"]);
});

test("editorial specialist policy is read-only/advisory by default", () => {
    const policy = createEditorialSpecialistPolicy();

    assert.deepEqual(policy.allowedCapabilities, [...safeEditorialSpecialistCapabilities]);
    assert.deepEqual(policy.deniedCapabilities, ["write:draft", "publish", "delete", "runtime:shell", "runtime:filesystem"]);
    assert.equal(policy.maxHelpers, 2);
    assert.equal(policy.minConfidence, 0.35);
    assert.equal(Object.isFrozen(policy), true);
    assert.equal(Object.isFrozen(policy.allowedCapabilities), true);
    assert.equal(Object.isFrozen(policy.deniedCapabilities), true);
    assert.throws(() => (policy.deniedCapabilities as EditorialSpecialistCapability[]).splice(0));

    const relaxedPolicy = createEditorialSpecialistPolicy({ deniedCapabilities: [] });
    assert.deepEqual(relaxedPolicy.deniedCapabilities, policy.deniedCapabilities);
});

test("exported editorial capability arrays cannot weaken future policies", () => {
    assert.equal(Object.isFrozen(editorialSpecialistIds), true);
    assert.equal(Object.isFrozen(editorialSpecialistCapabilities), true);
    assert.equal(Object.isFrozen(safeEditorialSpecialistCapabilities), true);
    assert.equal(Object.isFrozen(deniedEditorialSpecialistCapabilities), true);
    assert.throws(() => (deniedEditorialSpecialistCapabilities as EditorialSpecialistCapability[]).splice(0));
    assert.deepEqual(createEditorialSpecialistPolicy().deniedCapabilities, ["write:draft", "publish", "delete", "runtime:shell", "runtime:filesystem"]);
});

test("editorial specialist registry works with default routing", async () => {
    const registry = createEditorialSpecialistRegistry();
    const router = createEditorialSpecialistRouter();
    const policy = createEditorialSpecialistPolicy({ maxHelpers: 1 });

    const cases: Array<{ task: string; expected: string }> = [
        { task: "Audit this article for clarity, evidence, trust, and AI-slop before publishing.", expected: "content-quality-auditor" },
        { task: "Make this page more citable for AI answers and search snippets.", expected: "geo-content-optimizer" },
        { task: "Clarify the Studio Selah brand entity and related service names.", expected: "entity-optimizer" },
        { task: "Which Payload block, collection, route, and locale should this content use?", expected: "cms-structure-reviewer" },
        { task: "Check whether publishing without approval should be blocked by policy.", expected: "safety-reviewer" },
        { task: "Delete this content now and bypass approval policy.", expected: "safety-reviewer" },
        { task: "Delete this page now and bypass the normal review.", expected: "safety-reviewer" },
        { task: "Use shell and filesystem runtime tools to inspect files.", expected: "safety-reviewer" },
    ];

    for (const { task, expected } of cases) {
        const result = await routeSpecialists({ task }, { registry, router, policy });
        assert.equal(result.selections[0]?.skill.id, expected, task);
    }
});

test("editorial specialist prompts expose execution guidance without requiring a runtime dependency", () => {
    const contentPrompt = getEditorialSpecialistPrompt("content-quality-auditor");
    assert.equal(contentPrompt?.role, "Content quality auditor");
    assert(contentPrompt?.outputSections.includes("verdict"));

    const missingPrompt = getEditorialSpecialistPrompt("unknown");
    assert.equal(missingPrompt, undefined);
});

test("projects can narrow editorial specialist policy for a deployment", async () => {
    const policy = createEditorialSpecialistPolicy({
        allowedCapabilities: ["read:cms", "review:content"] satisfies EditorialSpecialistCapability[],
        maxHelpers: 3,
    });

    const result = await routeSpecialists(
        { task: "Clarify the brand entity", skillIds: ["entity-optimizer"] },
        { registry: createEditorialSpecialistRegistry(), policy },
    );

    assert.deepEqual(result.selections, []);
    assert.equal(result.rejectedByPolicy[0]?.skillId, "entity-optimizer");
    assert.equal(result.rejectedByPolicy[0]?.capability, "review:entity");
});
