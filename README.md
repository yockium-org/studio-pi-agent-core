# @studio/pi-agent-core

Shared primitives for Studio editorial pi-agent runtimes.

This package intentionally starts small. It contains project-neutral utilities that can be consumed by PlayHisWay, Studio Selah/Yoga, and future Payload projects without importing project-specific prompts, schemas, routes, or block contracts. The package root is the only public entrypoint; tests snapshot the runtime export surface so extraction to a versioned package is deliberate.

## Current exports

- `createTextResult` — Pi-compatible text tool result helper.
- `validateToolParams` / `validateAgainstSchema` — lightweight JSON-schema/TypeBox guard with adapter-provided locale guidance.
- `createLazyToolsetState` and toolset helpers — deterministic base-tool + lazy-toolset activation.
- `callPayloadMcpTool` / `createPayloadMcpToolCaller` — generic Payload MCP HTTP caller.
- `createEditorialExtension` — generic Pi extension factory driven by an `EditorialAgentAdapter`.
- `createSafePiRpcArgs` — safe Pi RPC launch arguments for stakeholder-facing sidecars (`--no-builtin-tools`, no context files/templates/themes by default).
- `extractPiMessageText` — assistant message text extraction for Telegram/webhook bridges.
- `escapeTelegramHtmlText` / `sanitizeTelegramCodeTags` / `chunkTelegramMessage` — Telegram-safe response formatting helpers.
- `listStoredPiSessions` / `formatPiSessionList` — reusable Pi session listing helpers.
- `extractTelegramAudioAttachment` / `downloadTelegramFile` / `transcribeTelegramAudio` / `buildTelegramAudioTranscriptPrompt` — provider-agnostic Telegram audio transcription pipeline helpers. Projects inject the concrete `AudioTranscriber` provider.
- `defineSpecialistSkill` / `createSpecialistRegistry` / `routeSpecialists` / `consultSpecialists` / `createConsultSpecialistsTool` — advisory specialist-helper orchestration with policy-gated capabilities, router contracts, and helper self-accept/decline decisions.
- `createEditorialSpecialistSkills` / `createEditorialSpecialistRegistry` / `createEditorialSpecialistRouter` / `createEditorialSpecialistPolicy` — default advisory editorial helper cards for content quality, GEO, entity clarity, CMS structure, and safety review.
- `createEditorialWorkflowPlan` / `getEditorialWorkflowPhasePreset` / `getEditorialWorkflowSpecialistIds` / `createEditorialWorkflowConsultRequest` / `consultEditorialWorkflowPhase` / `createConsultEditorialWorkflowPhaseTool` — phase-aware editorial workflow helpers for discover, plan, draft, review, polish, and prepare-mutation flows.
- `createEditorialWorkflowPolicy` / `hasUnsafeEditorialWorkflowIntent` / `editorialWorkflowPhases` / `editorialWorkflowIntents` — shared workflow policy, routing, and vocabulary helpers.
- `createUntrustedContentEnvelope` / `renderUntrustedContentForModel` / `renderUntrustedContentListForModel` / `createUntrustedContentResult` — prompt-injection-aware wrappers for CMS, Telegram, web, user, tool, and file content that must be treated as data rather than instructions.
- `detectPromptInjectionSignals` / `redactSensitiveText` / `promptInjectionSignalKinds` / `untrustedContentSources` / `untrustedContentTypes` — reusable signal detection, redaction, and source/type/kind vocabulary for project adapters.

## Adapter boundary

Shared core owns mechanics: tool registration wrapper, schema guard invocation, active toolset state, generic MCP transport, safe Pi RPC argument/text helpers, Telegram formatting/audio helpers, session-index helpers, specialist workflow helpers, and untrusted-content rendering helpers.

Project adapters own content policy: system prompt, Telegram help/image wording, CMS tool names and descriptions, TypeBox schemas, route and locale rules, block contracts, draft mapping, concrete specialist runner implementation, and where untrusted content wrappers are applied.

## Specialist helpers

Specialist helpers are advisory by default. Core provides the registry, routing, policy filtering, and `consultSpecialists` Pi tool wrapper; projects decide which specialist cards exist and how each helper is executed.

```ts
import { consultSpecialists, createSpecialistRegistry, defineSpecialistSkill } from "@studio/pi-agent-core";

const registry = createSpecialistRegistry([
  defineSpecialistSkill({
    id: "content-quality-auditor",
    label: "Content Quality Auditor",
    description: "Audits drafts for clarity, evidence, trust, and AI-slop risk.",
    whenToUse: ["audit content before publishing"],
    capabilities: ["read:cms", "optimize:content"],
  }),
]);

const result = await consultSpecialists(
  { task: "Audit this article before publishing" },
  {
    registry,
    policy: { allowedCapabilities: ["read:cms", "optimize:content"], maxHelpers: 2 },
    runner: async ({ skill, request }) => ({
      decision: "accept",
      reason: `${skill.label} is suitable for: ${request.task}`,
      result: { verdict: "fix" },
    }),
  },
);
```

See `docs/specialists.md` for the intended integration model and safety constraints, `docs/editorial-specialists.md` for the default editorial helper cards, `docs/editorial-workflow.md` for phase-aware writing/review flows, and `docs/untrusted-content.md` for prompt-injection boundary helpers.

## Validation

```sh
npm run check
npm run pack:smoke
```

`pack:smoke` builds the package tarball, installs it into a temporary consumer project, verifies root imports, and confirms subpath imports stay blocked by the package export map.
