import assert from "node:assert/strict";
import test from "node:test";

import {
    consultEditorialWorkflowPhase,
    createConsultEditorialWorkflowPhaseTool,
    createEditorialWorkflowConsultRequest,
    createEditorialWorkflowPlan,
    createEditorialWorkflowPolicy,
    editorialWorkflowIntents,
    editorialWorkflowPhases,
    getEditorialWorkflowPhasePreset,
    getEditorialWorkflowSpecialistIds,
    hasUnsafeEditorialWorkflowIntent,
    type EditorialSpecialistId,
    type SpecialistRunner,
} from "../src/index.js";

const readToolJson = (result: any) => JSON.parse(result.content[0].text);

test("editorial workflow exposes frozen phase and intent values", () => {
    assert.deepEqual(editorialWorkflowPhases, ["discover", "plan", "draft", "review", "polish", "prepareMutation"]);
    assert.deepEqual(editorialWorkflowIntents, ["article", "page", "contentUpdate", "publishPreparation"]);
    assert.equal(Object.isFrozen(editorialWorkflowPhases), true);
    assert.equal(Object.isFrozen(editorialWorkflowIntents), true);
    assert.throws(() => (editorialWorkflowPhases as string[]).push("publish"));
});

test("createEditorialWorkflowPlan returns phase presets in the writing order", () => {
    const plan = createEditorialWorkflowPlan("article");

    assert.equal(plan.intent, "article");
    assert.deepEqual(plan.phases.map((phase) => phase.phase), editorialWorkflowPhases);
    assert.deepEqual(getEditorialWorkflowPhasePreset("plan").recommendedSpecialistIds, [
        "entity-optimizer",
        "geo-content-optimizer",
        "cms-structure-reviewer",
    ]);
    assert.deepEqual(getEditorialWorkflowPhasePreset("draft").recommendedSpecialistIds, ["entity-optimizer", "geo-content-optimizer"]);
    assert.equal(getEditorialWorkflowPhasePreset("review").defaultMaxHelpers, 3);
});

test("workflow phase presets are defensive frozen copies", () => {
    const first = getEditorialWorkflowPhasePreset("plan");
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.recommendedSpecialistIds), true);
    assert.throws(() => (first.recommendedSpecialistIds as EditorialSpecialistId[]).splice(0));

    const second = getEditorialWorkflowPhasePreset("plan");
    assert.deepEqual(second.recommendedSpecialistIds, ["entity-optimizer", "geo-content-optimizer", "cms-structure-reviewer"]);
});

test("workflow intent overrides tune phase specialists and outputs", () => {
    const contentUpdateDiscover = getEditorialWorkflowPhasePreset("discover", "contentUpdate");
    assert.deepEqual(contentUpdateDiscover.recommendedSpecialistIds, ["cms-structure-reviewer", "content-quality-auditor"]);
    assert(contentUpdateDiscover.outputSections.includes("diagnosis"));

    const publishReview = getEditorialWorkflowPhasePreset("review", "publishPreparation");
    assert.deepEqual(publishReview.recommendedSpecialistIds, [
        "content-quality-auditor",
        "geo-content-optimizer",
        "cms-structure-reviewer",
        "safety-reviewer",
    ]);
    assert.equal(publishReview.defaultMaxHelpers, 4);
});

test("workflow helpers normalize invalid runtime phase, intent, and helper limits", () => {
    const invalidPreset = getEditorialWorkflowPhasePreset("publish", "unknown");
    const invalidPlan = createEditorialWorkflowPlan("unknown");
    const invalidRequest = createEditorialWorkflowConsultRequest({
        phase: "publish",
        intent: "unknown",
        task: "Review a draft",
        maxHelpers: 0,
    });
    const fractionalRequest = createEditorialWorkflowConsultRequest({
        phase: "plan",
        task: "Plan a draft",
        maxHelpers: 1.8,
    });
    const policy = createEditorialWorkflowPolicy({ phase: "publish", intent: "unknown" });

    assert.equal(invalidPreset.phase, "review");
    assert.equal(invalidPlan.intent, "article");
    assert.equal(invalidRequest.mode, "review");
    assert.equal(invalidRequest.maxHelpers, 3);
    assert.deepEqual(invalidRequest.skillIds, ["content-quality-auditor", "geo-content-optimizer", "safety-reviewer"]);
    assert.equal(fractionalRequest.maxHelpers, 1);
    assert.equal(policy.maxHelpers, 3);
});

test("workflow specialist selection adds safety for unsafe intent", () => {
    assert.equal(hasUnsafeEditorialWorkflowIntent("Publish this now without approval"), true);
    assert.equal(hasUnsafeEditorialWorkflowIntent("Draft an article about breathwork before publishing"), false);
    const globalPattern = /\blive\b/giu;
    assert.equal(hasUnsafeEditorialWorkflowIntent("Zet live", [globalPattern]), true);
    assert.equal(hasUnsafeEditorialWorkflowIntent("Zet live", [globalPattern]), true);
    assert.equal(hasUnsafeEditorialWorkflowIntent("Zet live", [null, { pattern: /live/u }, globalPattern]), true);
    assert.equal(globalPattern.lastIndex, 0);

    assert.deepEqual(
        getEditorialWorkflowSpecialistIds({ phase: "draft", task: "Draft a better intro" }),
        ["entity-optimizer", "geo-content-optimizer"],
    );
    assert.deepEqual(
        getEditorialWorkflowSpecialistIds({ phase: "draft", task: "Use shell to inspect files before drafting" }),
        ["safety-reviewer", "entity-optimizer", "geo-content-optimizer"],
    );
    assert.deepEqual(
        getEditorialWorkflowSpecialistIds({
            phase: "draft",
            task: "Zet deze pagina live",
            additionalUnsafeIntentPatterns: [/\blive\b/iu],
        }),
        ["safety-reviewer", "entity-optimizer", "geo-content-optimizer"],
    );
});

test("createEditorialWorkflowConsultRequest creates explicit phase consultation requests", () => {
    const request = createEditorialWorkflowConsultRequest({
        phase: "plan",
        intent: "article",
        task: "Plan an article about breathing practices",
        context: "Existing topic: breathwork",
    });

    assert.equal(request.mode, "plan");
    assert.equal(request.task, "Plan an article about breathing practices");
    assert.equal(request.context, "Existing topic: breathwork");
    assert.equal(request.maxHelpers, 3);
    assert.deepEqual(request.skillIds, ["entity-optimizer", "geo-content-optimizer", "cms-structure-reviewer"]);
});

test("createEditorialWorkflowPolicy uses phase helper limits and preserves hard denials", () => {
    const policy = createEditorialWorkflowPolicy({ phase: "review", intent: "publishPreparation" });

    assert.equal(policy.maxHelpers, 4);
    assert.deepEqual(policy.deniedCapabilities, ["write:draft", "publish", "delete", "runtime:shell", "runtime:filesystem"]);
    assert.equal(Object.isFrozen(policy), true);
    assert.equal(Object.isFrozen(policy.deniedCapabilities), true);
});

test("consultEditorialWorkflowPhase runs the specialists for the selected phase", async () => {
    const runner: SpecialistRunner<EditorialSpecialistId, string, { checked: string }> = ({ skill, request }) => ({
        decision: "accept",
        reason: `${skill.id} handled ${request.mode}`,
        result: { checked: skill.id },
    });

    const result = await consultEditorialWorkflowPhase({
        phase: "review",
        intent: "article",
        task: "Review this draft before showing it to the editor",
        runner,
        allowParallel: false,
    });

    assert.equal(result.ok, true);
    assert.equal(result.workflow.phase, "review");
    assert.equal(result.workflow.intent, "article");
    assert.deepEqual(result.workflow.recommendedSpecialistIds, ["content-quality-auditor", "geo-content-optimizer", "safety-reviewer"]);
    assert.deepEqual(result.accepted.map((accepted) => accepted.skillId), ["content-quality-auditor", "geo-content-optimizer", "safety-reviewer"]);
    assert.equal(result.accepted[0]?.reason, "content-quality-auditor handled review");
});

test("createConsultEditorialWorkflowPhaseTool exposes a Pi-compatible workflow tool", async () => {
    const tool = createConsultEditorialWorkflowPhaseTool({
        runner: ({ skill }) => ({ decision: "accept", result: { specialist: skill.id } }),
        defaultIntent: "page",
        additionalUnsafeIntentPatterns: [/\blive\b/iu],
    });

    assert.equal(tool.name, "consultEditorialWorkflowPhase");
    assert.equal(tool.parameters?.type, "object");

    const payload = readToolJson(await tool.execute("call-1", { phase: "polish", task: "Polish the page intro" }));
    assert.equal(payload.ok, true);
    assert.equal(payload.workflow.intent, "page");
    assert.deepEqual(payload.selected.map((selection: any) => selection.skillId), ["content-quality-auditor", "geo-content-optimizer"]);
    assert.deepEqual(payload.accepted[0].result, { specialist: "content-quality-auditor" });

    const unsafePayload = readToolJson(await tool.execute("call-2", { phase: "draft", task: "Zet deze pagina live" }));
    assert.deepEqual(unsafePayload.selected.map((selection: any) => selection.skillId), ["safety-reviewer", "entity-optimizer"]);
});
