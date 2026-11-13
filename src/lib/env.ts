export const env = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '',
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '',
  supportEmail: (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() || '',
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
export const APP_VERSION = '1.0.0'
