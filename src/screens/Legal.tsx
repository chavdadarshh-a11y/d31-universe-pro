import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Header } from '../components/ui'
import { env } from '../lib/env'

const UPDATED = '14 November 2026'

/**
 * Plain-language legal pages. They are a solid starting point written for an Indian
 * fitness app, but have them reviewed by a lawyer before launch.
 */
function docs(biz: string, email: string): Record<string, { title: string; body: [string, string][] }> {
  const contact = email ? `email ${email}` : 'use the contact details on the Contact page'
  return {
    privacy: {
      title: 'Privacy Policy',
      body: [
        ['Who we are', `${biz} ("D31", "we") operates the D31.UNIVERSE app. This policy explains what we collect and why. It is written to meet India's Digital Personal Data Protection Act, 2023.`],
        ['What we collect', 'Account data (email, name), your fitness profile (goal, level, equipment, age, height, weight, sex, activity), workouts, body measurements, nutrition and recovery logs, progress photos you choose to upload, and photos or videos you submit for form analysis. Payment details are handled by Razorpay; we only receive an order ID, payment ID and status.'],
        ['How we use it', 'To run the features you use: plans, tracking, calorie targets, AI form analysis and membership. We do not sell your data and we do not use your photos or videos for advertising.'],
        ['AI form analysis', 'When you run a form check, the media you select is sent securely to our server and processed by Google Gemini to generate feedback. We store the text result in your account. The live rep counter runs entirely on your device; camera video is never uploaded.'],
        ['Guest mode & on-device accounts', 'If you use the app as a guest, or with an account created on this phone (demo mode), your data stays in your browser storage on this device only. Passwords of on-device accounts are salted and hashed and never leave the phone. Clearing browser data deletes it.'],
        ['D31 Knowledge', 'Knowledge posts, photos, PDFs and videos are loaded from D31’s public Google Drive folder. Opening them contacts Google’s servers, which may log your IP address like any website.'],
        ['Storage & security', 'Signed-in data is stored with Supabase (row-level security: only you can read your rows). Progress photos are kept in a private storage bucket.'],
        ['Your rights', `You can export a JSON backup from Settings → Privacy & data, and delete your account and all its data yourself from Profile → Delete account (cloud accounts are deleted on our server too). To exercise any right, ${contact}. We respond within 30 days.`],
        ['Children', 'D31 is not intended for children under 13. Users aged 13–17 should use the app with a parent or guardian’s consent.'],
        ['Changes', 'If we change this policy we will update the date above and notify you in the app.'],
      ],
    },
    terms: {
      title: 'Terms of Use',
      body: [
        ['Agreement', `By using D31.UNIVERSE you agree to these terms with ${biz}. If you do not agree, please do not use the app.`],
        ['Your account', 'Keep your login secure. You are responsible for activity on your account. One account per person.'],
        ['Memberships', 'Free, Pro (₹149) and Platinum (₹499) are the tiers. Pro and Platinum are 30-day passes billed in INR through Razorpay and do not auto-renew. Downloads (program PDFs, history export, offline clips, Knowledge PDFs/videos) are part of Platinum. The launch offer (first 131 members get Pro free for 1 month) and the 7-day free trial can be used once per person.'],
        ['Acceptable use', 'Do not upload content you do not have rights to, content of other people without their consent, or anything illegal or abusive. Do not attempt to reverse engineer, overload or misuse the AI analysis service.'],
        ['Content', 'Programs, exercise descriptions, videos and D31 Knowledge posts are © Darshan Chavda / D31. You may use them for personal training only.'],
        ['No medical advice', 'See the Health Disclaimer. You train at your own risk.'],
        ['Liability', 'To the maximum extent permitted by law, D31 is not liable for indirect losses or injuries arising from use of the app. Our total liability is limited to the amount you paid in the last 3 months.'],
        ['Governing law', 'These terms are governed by the laws of India. Courts in Gujarat, India have jurisdiction.'],
      ],
    },
    disclaimer: {
      title: 'Health Disclaimer',
      body: [
        ['Not medical advice', 'D31.UNIVERSE provides general fitness information and AI-generated movement feedback. It is not medical advice, diagnosis or treatment and does not replace a doctor, physiotherapist or registered dietitian.'],
        ['Check with a professional', 'Consult a qualified professional before starting any exercise or nutrition program, especially if you are pregnant, have a heart condition, high blood pressure, diabetes, an injury, or any other medical condition.'],
        ['Stop if it hurts', 'Stop immediately and seek medical help if you feel chest pain, dizziness, shortness of breath or sharp joint pain.'],
        ['AI limitations', 'Form analysis and the rep counter are estimates from photos and camera data. Lighting, angle and clothing affect accuracy. Use them as coaching hints, not as a safety guarantee.'],
        ['Nutrition targets', 'Calorie and protein targets are calculated with standard formulas (Mifflin-St Jeor) and are approximate. Individual needs vary.'],
      ],
    },
    refunds: {
      title: 'Refund & Cancellation Policy',
      body: [
        ['30-day passes', 'Memberships are 30-day passes; they do not auto-renew. Your access simply ends after 30 days unless you buy again.'],
        ['Refunds', `If you are charged by mistake or cannot access paid features because of a fault on our side, ${contact} within 7 days of payment with your Razorpay payment ID. Approved refunds are returned to the original payment method within 5–7 working days.`],
        ['Free offers', 'Launch-offer months and free trials are free and do not convert to paid automatically.'],
      ],
    },
    contact: {
      title: 'Contact',
      body: [
        ['Business', biz],
        ['Email', email || 'Set VITE_SUPPORT_EMAIL in your environment to show your support email here.'],
        ['Response time', 'We reply within 2 working days (Mon–Sat, 10:00–18:00 IST).'],
      ],
    },
  }
}

export function Legal({ doc }: { doc: string }) {
  const t = useT()
  const onboarded = useApp((s) => s.onboarded)
  const all = docs(env.businessName, env.supportEmail)
  const d = all[doc] ?? all.privacy
  return (
    <div>
      <Header title={d.title} back={onboarded ? true : '#/'} />
      <p className="label mb-4">{t('lastUpdated')}: {UPDATED}</p>
      <div className="space-y-5">
        {d.body.map(([h, p]) => (
          <section key={h}>
            <h2 className="text-[15px] font-bold">{h}</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-frost/85">{p}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
