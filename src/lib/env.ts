export const env = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '',
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '',
  /** Optional: Google OAuth Web client id → enables Google One Tap (Supabase signInWithIdToken). */
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || '',
  /** Google API key (Drive API, HTTP-referrer restricted) → direct in-app streaming + in-app saves of Knowledge videos/PDFs.
   *  Google blocks cross-site browser reads of drive.usercontent.google.com, so the Drive API is the only keyless-account-free route. */
  googleApiKey: (import.meta.env.VITE_GOOGLE_API_KEY as string | undefined)?.trim() || '',
  supportEmail: (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() || 'dpchavda22@gmail.com',
  businessName: (import.meta.env.VITE_BUSINESS_NAME as string | undefined)?.trim() || 'D31.UNIVERSE by Darshan Chavda',
  socials: {
    youtube: (import.meta.env.VITE_SOCIAL_YOUTUBE as string | undefined)?.trim() || '',
    instagram: (import.meta.env.VITE_SOCIAL_INSTAGRAM as string | undefined)?.trim() || '',
    snapchat: (import.meta.env.VITE_SOCIAL_SNAPCHAT as string | undefined)?.trim() || '',
    facebook: (import.meta.env.VITE_SOCIAL_FACEBOOK as string | undefined)?.trim() || '',
  },
}

/** Live mode = Supabase configured. Everything else (Gemini, Razorpay) lives server-side behind it. */
export const isLive = Boolean(env.supabaseUrl && env.supabaseAnonKey)
export const APP_VERSION = '4.1.2'
