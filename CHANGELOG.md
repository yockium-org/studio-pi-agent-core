# Changelog

## 0.1.0-local

Initial extraction candidate for `@studio/pi-agent-core`.

Includes:

- generic Pi editorial extension factory;
- lightweight schema guard helpers;
- lazy toolset registry helpers;
- generic Payload MCP HTTP client;
- safe Pi RPC launch argument and assistant text extraction helpers;
- Telegram response formatting helpers;
- provider-agnostic Telegram audio transcription pipeline contracts;
- reusable Pi session index helpers.

This version is intended for local validation before pushing a real remote/tag. Project adapters remain responsible for prompts, CMS schemas, content policy, runtime/deploy configuration, and concrete transcription providers.
