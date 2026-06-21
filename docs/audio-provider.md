# Audio transcription providers

`@studio/pi-agent-core` owns the reusable Telegram audio mechanics, not provider billing or credentials.

Core responsibilities:

- detect Telegram `voice`, `audio`, and audio `document` attachments;
- download file bytes through the Telegram Bot API;
- enforce size, duration, and MIME policy limits;
- call an injected `AudioTranscriber`;
- build a transcript prompt for Pi.

Project responsibilities:

- choose the concrete transcription provider;
- own provider credentials and billing;
- set privacy/retention policy;
- configure language hints and limits;
- decide whether audio transcription is enabled.

Current project adapters use OpenAI hosted transcription. That requires a client-owned OpenAI Platform API key in the sidecar environment:

```env
PI_AGENT_TELEGRAM_AUDIO_TRANSCRIPTION=true
PI_AGENT_TRANSCRIPTION_PROVIDER=openai
OPENAI_API_KEY=<client-owned-openai-platform-key>
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
```

A ChatGPT subscription, ChatGPT Team account, or Pi `/login` session does not automatically provide transcription API billing. Treat transcription credentials as project-side runtime secrets, not as core package configuration.

The Telegram Bot API does not expose Telegram-native transcript text. It only provides file metadata and bytes. If an MTProto/userbot transcript provider is ever added, keep it as an optional experimental provider behind the same `AudioTranscriber` contract.
