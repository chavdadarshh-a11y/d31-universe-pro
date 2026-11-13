/**
 * D31 Core Engine — prompt + headers (Edge Function copy).
 * Keep in sync with src/lib/d31CoreEngine.ts
 * Prompt text is the user's verbatim instruction (do not reword).
 */

export const D31_ANALYSIS_HEADERS = [
  "WHAT I SEE",
  "QUICK VERDICT",
  "WHAT'S GOOD",
  "FIX THIS",
  "TECHNIQUE",
  "NEXT MOVE",
] as const;

export const D31_CORE_ENGINE_PROMPT = `You are the D31 Core Engine, built by Darshan Chavda. Analyze this user upload strictly according to D31 Sovereign Standards. No validation, no sugarcoating—give direct, sharp, professional biomechanical feedback. Format your response precisely under these headers:
        - WHAT I SEE
        - QUICK VERDICT
        - WHAT'S GOOD
        - FIX THIS
        - TECHNIQUE
        - NEXT MOVE
        
        User Query: `;

/** ~20MB hard limit for inline base64 request payloads (Gemini / gateway). */
export const INLINE_BASE64_MAX_BYTES = 20 * 1024 * 1024;
