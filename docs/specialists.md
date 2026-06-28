# Specialist helpers

`@studio/pi-agent-core` can orchestrate advisory specialist helpers without giving them unrestricted runtime tools.

The core package owns mechanics:

- register specialist skill cards;
- route a task to likely specialists;
- enforce capability policy before any helper runs;
- let each helper accept or decline the task after seeing its own card and request;
- return a structured result to the main agent;
- expose the orchestration as an optional Pi tool via `createConsultSpecialistsTool`.

Projects own policy:

- which specialists exist;
- how specialist prompts/sessions are executed;
- whether helpers are local functions, separate model calls, or external workers;
- which capabilities are allowed in a deployment;
- whether any write-capability helper can run.

## Flow

```txt
main agent
  -> consultSpecialists({ task, mode: "auto" })
  -> router selects candidates from skill cards
  -> core filters candidates by capability policy
  -> each helper accepts or declines based on fit
  -> main agent receives accepted/declined/errored results
```

The default keyword router is deterministic and intentionally simple. Production projects can inject a model-backed router if they need richer classification. Even with a model router, policy filtering still happens in core before helper execution.

## Minimal setup

```ts
import {
  consultSpecialists,
  createSpecialistRegistry,
  defineSpecialistSkill,
} from "@studio/pi-agent-core";

const registry = createSpecialistRegistry([
  defineSpecialistSkill({
    id: "content-quality-auditor",
    label: "Content Quality Auditor",
    description: "Audits drafts for clarity, usefulness, trust, evidence, and AI-slop risk.",
    whenToUse: ["review article quality", "audit content before publishing"],
    capabilities: ["read:cms", "optimize:content"],
  }),
]);

const result = await consultSpecialists(
  { task: "Review this page before publishing", maxHelpers: 1 },
  {
    registry,
    policy: {
      allowedCapabilities: ["read:cms", "optimize:content"],
      deniedCapabilities: ["publish", "delete"],
      maxHelpers: 2,
    },
    runner: async ({ skill, request }) => {
      // Project-specific execution: another model call, worker, or local reviewer.
      if (!request.task.includes("review")) {
        return { decision: "decline", reason: `${skill.label} only handles review tasks.` };
      }
      return {
        decision: "accept",
        reason: `${skill.label} is suitable for this task.`,
        result: { verdict: "fix", notes: ["Add clearer evidence."] },
      };
    },
  },
);
```

## Editorial presets

For common editorial work, core also exposes default advisory cards via `createEditorialSpecialistRegistry()` and `createEditorialSpecialistPolicy()`. See `docs/editorial-specialists.md` for the included content quality, GEO, entity, CMS structure, and safety reviewer presets, and `docs/editorial-workflow.md` for phase-aware writing/review flows.

## Pi tool wrapper

Use `createConsultSpecialistsTool` when a project adapter wants the main Pi agent to call specialists as a tool:

```ts
const consultTool = createConsultSpecialistsTool({
  registry,
  policy: { allowedCapabilities: ["read:cms", "optimize:content"] },
  runner,
});
```

The tool schema accepts:

- `task` — required non-empty task;
- `context` — optional context for helpers;
- `mode` — optional routing mode such as `auto`, `audit`, `plan`, or `review`;
- `skillIds` — optional explicit specialist ids;
- `maxHelpers` — optional per-call limit. If `policy.maxHelpers` is set, it remains a hard upper bound.

## Safety guidance

- Keep stakeholder-facing specialists advisory/read-only by default.
- Every skill should declare explicit `capabilities`; skills with no capabilities are rejected whenever `allowedCapabilities` is configured.
- Use `allowedCapabilities` and `deniedCapabilities`; do not rely only on prompts.
- Treat helpers with `write:draft`, `publish`, `delete`, shell, filesystem, or network capabilities as separate reviewed designs.
- Let helpers decline. A decline is useful signal, not a failure.
- Keep the main agent responsible for synthesis and user-facing decisions.
