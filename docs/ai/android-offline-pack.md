# Offline AI Pack — honest Android scope

## What exists today

The Play Store app (`com.d31universe.pro`) is a **Trusted Web Activity (TWA)**. It loads the live website inside Chrome Custom Tabs / a WebView-style wrapper. It has no native Kotlin/Java activity that can load LiteRT-LM or MediaPipe’s UniversalEmbedder.

Because of that:

- Gemma-4-E2B-it (~2.6 GB) and Gemma-4-E4B-it (~3.7 GB) **cannot** run in the current Android app or in the GitHub Pages web app.
- EmbeddingGemma-2 (~499.9 MB) **cannot** run there either.
- The web features shipped in this release use what a browser can actually do: MediaPipe Pose in WebAssembly, the Web Speech API, and keyword search over names and tags.

## What a native module would need

To ship an optional “Offline AI Pack” later, the Android app has to grow a native surface next to (or instead of) the TWA, for example:

1. A Kotlin/Jetpack module (or a Capacitor/Cordova plugin) that can download, verify and store the model files, with a one-tap optional download so regular users are not asked for 3 GB.
2. LiteRT-LM (or the current Google AI Edge / MediaPipe LLM Inference API) to load Gemma-4-E2B-it, with a fallback to a smaller model on phones that cannot hold 2.6 GB + runtime overhead.
3. MediaPipe Tasks + UniversalEmbedder for EmbeddingGemma-2, plus an on-device index of Shoot and Progress photos, for true natural-language media search.
4. A JNI/bridge so the existing web UI can call: “analyse this photo”, “find this moment”, “parse this transcript”, without sending media to a server when the pack is installed.
5. The Coach Core system prompt and `agent-skills.json` tool schemas from this folder, wired to `log_set`, `adjust_program` and `find_moment`.
6. Storage, resume-able downloads, license/attribution for Gemma, and a clear RAM/storage gate (roughly 6–8 GB RAM devices for E2B; E4B needs more). Thermal and battery limits on mid-range phones need real-device QA.

## Scope estimate (not built in this release)

- **4–8 weeks** for a first native Offline AI Pack: download manager, model load, Ask Image + Audio Scribe + Movement Analyst prompts, basic tool calls, QA on a few mid-range Android phones.
- **+1–2 weeks** for on-device embedding search of the Shoot gallery and Progress photos.
- Video Moment Finder can stay on MediaPipe Pose (already on-device in the web app); embedding-based moment search is optional extra work, not required to match what the web app already does.

This is an estimate, not a schedule. The web features in this release do not pretend the Offline AI Pack is already available.
