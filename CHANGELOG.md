# Changelog

## 0.2.0

Adds advisory specialist-helper orchestration:

- `defineSpecialistSkill` and `createSpecialistRegistry` for project-owned specialist cards;
- `createKeywordSpecialistRouter` and `routeSpecialists` for deterministic default routing with capability-policy filtering;
- `consultSpecialists` for running selected helpers while allowing each helper to accept, decline, or error independently;
- `createConsultSpecialistsTool` for optional Pi tool integration;
- `docs/specialists.md` with the intended safety model.

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
