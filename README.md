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

## Adapter boundary

Shared core owns mechanics: tool registration wrapper, schema guard invocation, active toolset state, generic MCP transport, safe Pi RPC argument/text helpers, Telegram formatting/audio helpers, and session-index helpers.

Project adapters own content policy: system prompt, Telegram help/image wording, CMS tool names and descriptions, TypeBox schemas, route and locale rules, block contracts, and draft mapping.

## Validation

```sh
npm run check
```

From the repository root:

```sh
npm run pi-agent-core:check
```
