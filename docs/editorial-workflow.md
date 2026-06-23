# Editorial workflow phases

`@studio/pi-agent-core` provides phase-aware editorial workflow presets so the main agent can involve specialists before, during, and after writing instead of treating helpers only as a final audit.

The workflow is advisory and project-neutral. It does not read or write CMS data by itself, does not run subagents directly, and does not publish content. Projects provide the runner and decide which tools/secrets are available.

## Phases

| Phase | Purpose | Default specialists |
| --- | --- | --- |
| `discover` | Identify target content, route, locale, entity, and CMS constraints. | `cms-structure-reviewer`, `entity-optimizer` |
| `plan` | Create outline, entity facts, answerability goals, and CMS/block plan before writing. | `entity-optimizer`, `geo-content-optimizer`, `cms-structure-reviewer` |
| `draft` | Draft with entity and answerability constraints while keeping one final voice. | `entity-optimizer`, `geo-content-optimizer` |
| `review` | Audit quality, GEO readiness, and safety before presenting as ready. | `content-quality-auditor`, `geo-content-optimizer`, `safety-reviewer` |
| `polish` | Tighten wording, headings, summaries, and quotable answers without scope creep. | `content-quality-auditor`, `geo-content-optimizer` |
| `prepareMutation` | Preflight CMS write/update/publish intent before any mutation tool. | `cms-structure-reviewer`, `content-quality-auditor`, `safety-reviewer` |

Supported intents:

- `article`
- `page`
- `contentUpdate`
- `publishPreparation`

Intents can tune specialist selections and output sections while preserving the same phase vocabulary.

## Main-agent flow

For a request like “write/improve this article”, the main agent should usually do:

```txt
discover -> plan -> draft -> review -> polish -> prepareMutation
```

Not every request needs every phase. For example, a small wording fix may use only `discover`, `plan`, `review`, and `prepareMutation`; a pure audit may use `discover` and `review`.

## Usage

```ts
import {
  consultEditorialWorkflowPhase,
  createEditorialWorkflowPlan,
} from "@studio/pi-agent-core";

const plan = createEditorialWorkflowPlan("article");

const phaseResult = await consultEditorialWorkflowPhase({
  phase: "plan",
  intent: "article",
  task: "Plan an article about breathing practices",
  context: "Existing topic: breathwork",
  runner: async ({ skill, request }) => {
    // Project-owned execution: model call, pi-subagent, local reviewer, or worker.
    return {
      decision: "accept",
      reason: `${skill.label} is useful for ${request.mode}.`,
      result: { notes: [] },
    };
  },
});
```

## Guarding phase context

When a phase needs CMS, Telegram, web, tool, or file content as context, wrap that content before handing it to specialists. The workflow helpers do not inspect or sanitize `context` by themselves because projects own CMS shape and trust boundaries.

```ts
import {
  consultEditorialWorkflowPhase,
  createUntrustedContentEnvelope,
  renderUntrustedContentForModel,
} from "@studio/pi-agent-core";

const cmsContext = renderUntrustedContentForModel(
  createUntrustedContentEnvelope({
    source: "cms",
    label: "Existing article body",
    content: articleSummary,
    contentType: "markdown",
    metadata: { collection: "articles", slug: article.slug, locale: "nl" },
  }),
).text;

const review = await consultEditorialWorkflowPhase({
  phase: "review",
  intent: "article",
  task: "Review the proposed article update before prepareMutation.",
  context: cmsContext,
  runner,
});
```

This keeps the main workflow vocabulary trusted while treating fetched/editor-provided content as quoted data.

## Pi tool wrapper

Use `createConsultEditorialWorkflowPhaseTool` to expose phase consultation as a Pi tool:

```ts
const consultWorkflowTool = createConsultEditorialWorkflowPhaseTool({
  runner,
  defaultIntent: "article",
  additionalUnsafeIntentPatterns: [/\bgo live\b/i, /\bzet live\b/i],
});
```

Tool params:

- `phase` — one of `discover`, `plan`, `draft`, `review`, `polish`, `prepareMutation`;
- `task` — required task text;
- `context` — optional document/content context;
- `intent` — optional `article`, `page`, `contentUpdate`, or `publishPreparation`;
- `maxHelpers` — optional per-call cap; policy caps still apply. The default phase policy is a hard upper bound, so increasing `maxHelpers` above the phase default also requires passing an explicit project policy with a higher `maxHelpers`.

## Safety behavior

Workflow phases still use specialist capability policy. Default workflow policy comes from `createEditorialSpecialistPolicy()` and hard-denies:

- `write:draft`
- `publish`
- `delete`
- `runtime:shell`
- `runtime:filesystem`

Unsafe intent terms such as delete, approval bypass, shell, filesystem, runtime access, or urgent/bypass publish requests automatically add `safety-reviewer` to phases that would not normally include it. Projects can pass `additionalUnsafeIntentPatterns` when creating workflow consultation requests to cover project-specific or localized phrases such as "go live" / "zet live".

`prepareMutation` is only a preflight phase. It should summarize target, proposed changes, blockers, risks, and approval requirements. It must not apply writes or publish by itself.

## Integration guidance

- Keep the main agent responsible for final voice and synthesis.
- Specialists provide constraints, critique, and checks; they should not produce disconnected final content chunks.
- Use `plan` before substantial drafting so content is entity-aware and answer-ready from the start.
- Use `review` before claiming content is ready.
- Use `prepareMutation` before any future write/publish/apply tool.
- Project runners may use pi-subagents, direct model calls, local functions, or a worker service, but core intentionally does not depend on any one runtime.
- Wrap CMS bodies, Telegram messages, tool outputs, and other user/content context with `createUntrustedContentEnvelope` / `renderUntrustedContentForModel` before passing them into workflow `context` fields.
