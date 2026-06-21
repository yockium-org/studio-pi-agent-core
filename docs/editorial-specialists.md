# Editorial specialist presets

`@studio/pi-agent-core` includes default advisory specialist cards for common editorial work. These presets do not run subagents by themselves; they are metadata and routing hints for a project-owned `SpecialistRunner`.

## Included helpers

| ID | Purpose | Suggested pi skill |
| --- | --- | --- |
| `content-quality-auditor` | Publish-readiness, usefulness, trust, evidence, clarity, AI-slop risk | `content-quality-auditor` |
| `geo-content-optimizer` | AI/search answerability, quotable facts, entity clarity, citable structure | `geo-content-optimizer` |
| `entity-optimizer` | Brand/person/service/topic disambiguation and canonical facts | `entity-optimizer` |
| `cms-structure-reviewer` | Payload collection, route, locale, and block-structure fit | project-specific |
| `safety-reviewer` | Capability policy, approval gates, write/publish/delete bypass attempts | project-specific |

All default presets are advisory. None declares `write:draft`, `publish`, `delete`, `runtime:shell`, or `runtime:filesystem` capabilities.

## Usage

```ts
import {
  consultSpecialists,
  createEditorialSpecialistPolicy,
  createEditorialSpecialistRegistry,
  createEditorialSpecialistRouter,
} from "@studio/pi-agent-core";

const registry = createEditorialSpecialistRegistry();
const policy = createEditorialSpecialistPolicy({ maxHelpers: 2 });

const result = await consultSpecialists(
  { task: "Audit this page and make it more citable for AI answers" },
  {
    registry,
    policy,
    router: createEditorialSpecialistRouter(),
    runner: async ({ skill, request }) => {
      // Project-owned execution. This could call pi-subagents, a model API,
      // a local deterministic reviewer, or a future worker service.
      return {
        decision: "accept",
        reason: `${skill.label} is relevant to ${request.task}`,
        result: { notes: [] },
      };
    },
  },
);
```

## Default policy

`createEditorialSpecialistPolicy()` returns:

- `allowedCapabilities`:
  - `read:cms`
  - `review:content`
  - `optimize:content`
  - `review:entity`
  - `review:structure`
  - `review:safety`
- `deniedCapabilities`:
  - `write:draft`
  - `publish`
  - `delete`
  - `runtime:shell`
  - `runtime:filesystem`
- `maxHelpers: 2`
- `minConfidence: 0.35`

The denied list is hard-merged into every default editorial policy. Passing `deniedCapabilities: []` does not remove `write:draft`, `publish`, `delete`, shell, or filesystem protections.

Projects can narrow the allowed policy for a deployment, for example to allow only content-review helpers:

```ts
const policy = createEditorialSpecialistPolicy({
  allowedCapabilities: ["read:cms", "review:content"],
  maxHelpers: 1,
});
```

## Runtime choice

`createEditorialSpecialistRouter()` wraps the deterministic keyword router and gives `safety-reviewer` priority for unsafe-intent terms such as delete, approval bypass, shell, filesystem, runtime access, or publish requests paired with urgency/approval-bypass wording like `now`, `without`, `bypass`, or `approval`.

The presets intentionally do not depend on `pi-subagents` or any other worker runtime. Use the preset metadata to build the project-side runner:

- `metadata.piSkillName` maps three helpers to existing pi skill names when available;
- `metadata.prompt` gives role instructions and expected output sections;
- `metadata.execution` is `advisory` for every default helper.

This keeps core reusable while allowing each project to choose whether specialists run through pi-subagents, direct model calls, local functions, or a dedicated worker service.

If a project experiments with write-capability helpers, do not reuse the default editorial policy as an approval bypass. Add a separately reviewed policy path with explicit approval gates and tests.
