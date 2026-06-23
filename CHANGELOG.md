# Changelog

## 0.4.0

Adds phase-aware editorial workflow helpers and untrusted-content / prompt-injection guard helpers as one cohesive release:

- `editorialWorkflowPhases` and `editorialWorkflowIntents` for shared workflow vocabulary;
- `createEditorialWorkflowPlan` and `getEditorialWorkflowPhasePreset` for discover, plan, draft, review, polish, and prepare-mutation phase guidance;
- `getEditorialWorkflowSpecialistIds` and `hasUnsafeEditorialWorkflowIntent` for phase specialist selection with safety-reviewer promotion on unsafe intent;
- `createEditorialWorkflowConsultRequest`, `consultEditorialWorkflowPhase`, and `createConsultEditorialWorkflowPhaseTool` for project-owned runner integration;
- `createEditorialWorkflowPolicy` for phase-aware helper caps while preserving hard-denied write/publish/delete/runtime capabilities;
- `createUntrustedContentEnvelope` for marking CMS, Telegram, web, user, tool, and file content as data rather than instructions;
- `renderUntrustedContentForModel` and `renderUntrustedContentListForModel` for model-facing quoted blocks with explicit safety rules;
- `detectPromptInjectionSignals` and `promptInjectionSignalKinds` for common instruction-override, secret-exfiltration, tool-use, policy-bypass, and role-confusion signals;
- `redactSensitiveText` for common token/API key/secret shapes before model rendering;
- `createUntrustedContentResult` for Pi-compatible tool results that preserve guard metadata;
- `docs/editorial-workflow.md` with the intended writing/review/prepare flow;
- `docs/untrusted-content.md` with integration guidance for CMS reads, specialists, and future prepare/apply flows.

## 0.2.0

Adds advisory specialist-helper orchestration:

- `defineSpecialistSkill` and `createSpecialistRegistry` for project-owned specialist cards;
- `createKeywordSpecialistRouter` and `routeSpecialists` for deterministic default routing with capability-policy filtering;
- `consultSpecialists` for running selected helpers while allowing each helper to accept, decline, or error independently;
- `createConsultSpecialistsTool` for optional Pi tool integration;
- default advisory editorial helper cards and router for content quality, GEO, entity clarity, CMS structure, and safety review;
- `docs/specialists.md` and `docs/editorial-specialists.md` with the intended safety model.

## 0.1.0

Initial remote/tagged release for `@studio/pi-agent-core`.

Includes:

- generic Pi editorial extension factory;
- lightweight schema guard helpers;
- lazy toolset registry helpers;
- generic Payload MCP HTTP client;
- safe Pi RPC launch argument and assistant text extraction helpers;
- Telegram response formatting helpers;
- provider-agnostic Telegram audio transcription pipeline contracts;
- reusable Pi session index helpers.

Project adapters remain responsible for prompts, CMS schemas, content policy, runtime/deploy configuration, and concrete transcription providers.
