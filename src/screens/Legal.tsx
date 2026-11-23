import { useApp } from '../store/app'
import { useT } from '../i18n'
import { SocialRow } from '../components/Social'
import { Header } from '../components/ui'
import { PASSES, TRIAL, POST_PASSES, postPassDuration, FOUNDING, REFERRAL, foundingPrice } from '../config/plans'

const passTxt = PASSES.map((p) => {
  const label = p.plan === 'gold' ? 'Golden' : p.plan[0].toUpperCase() + p.plan.slice(1)
  const period = p.days === 365 ? 'year' : 'month'
  return `${label} ₹${p.priceInr.toLocaleString('en-IN')} / ${period}`
}).join(', ')
const MEMBERSHIP_TERMS = `Tiers: Free, Pro, Golden and Platinum. Passes (one-time, no auto-renew, paid in INR through Razorpay — UPI, cards, netbanking, wallets): ${passTxt}. Every new account gets one free ${TRIAL.days}-day ${TRIAL.plan[0].toUpperCase()}${TRIAL.plan.slice(1)} trial (once per account). Knowledge PDFs: Free — samples (English); Pro — standard (English); Golden and Platinum — trilingual (English, Hindi, Gujarati). Offline downloads of Knowledge videos, PDFs and photos are included during valid Pro, Golden or Platinum access (Free is limited). After a paid pass ends there is a short grace period with full access (see the app), then saved downloads stay on the phone but lock until you renew. Single-item Knowledge purchases (₹19 / ₹9 / ₹49) are no longer offered; Portal Pass replaces them.`
/** Google Play app: no prices, payment methods or buying instructions (Play payments policy). */
const MEMBERSHIP_TERMS_APP = `Tiers: Free, Pro, Golden and Platinum. A membership is linked to your D31 account and works on every device where you sign in with that account. Memberships never auto-renew. Every new account gets one free ${TRIAL.days}-day ${TRIAL.plan[0].toUpperCase()}${TRIAL.plan.slice(1)} trial (once per account). Knowledge PDFs: Free — samples (English); Pro — standard (English); Golden and Platinum — trilingual (English, Hindi, Gujarati). Offline downloads of Knowledge videos, PDFs and photos are included during valid Pro, Golden or Platinum access (Free is limited). After a membership ends there is a short grace period with full access, then saved downloads stay on the phone but lock.`
const POST_PASS_TERMS = `Portal Pass credits: ${POST_PASSES.map((x) => { const d = postPassDuration(x); return `${x.name} ₹${x.priceInr} — ${x.posts} credit${x.posts === 1 ? '' : 's'}, ${d.n} ${d.unit} each`; }).join('; ')}. You choose which Knowledge posts to unlock. Each unlock starts its own timer. Unused purchased credits never expire and can open current or future posts. While a post is unlocked you get all three languages, videos, PDFs, photos, download and offline play. When the timer ends the post locks again and its in-app downloads are blocked. Offered to Free, Pro and Golden members; hidden for Platinum (all included vaults).`
const FOUNDING_TERMS = `${FOUNDING.name} is a launch offer for the first ${FOUNDING.cap} verified paid members. Eligible members receive ${FOUNDING.discountPct}% off membership prices (not Portal Passes) as long as their eligible subscription stays active, including the published grace period, a Founding Member profile badge, and early access to selected upcoming features. Example founding prices (rounded to the nearest rupee): ` + PASSES.map((p) => {
  const label = p.plan === 'gold' ? 'Golden' : p.plan[0].toUpperCase() + p.plan.slice(1)
  const period = p.days === 365 ? 'year' : 'month'
  return `${label} ₹${foundingPrice(p.priceInr).toLocaleString('en-IN')} / ${period}`
}).join(', ') + `. If the membership lapses past grace, rejoining the discount is subject to these terms and is not automatic. The in-app counter shows only the real claimed count from our records; we do not display invented numbers. This is a draft policy and may be refined before or shortly after launch.`
const CREDIT_POLICY = POST_PASS_TERMS + ' This is the published credit-expiry disclosure: purchased credits themselves do not expire; access timers apply only after a credit is spent on a specific post.'
const REFERRAL_TERMS = `Each member gets a personal referral link (?ref=CODE). When a referred friend creates an account and completes their first paid purchase (membership or Portal Pass), both people receive ₹${REFERRAL.rewardInr} wallet credit. A member can earn this reward for at most ${REFERRAL.maxPerMember} successful referrals. Self-referrals and duplicate accounts (same email or same device) are blocked. Wallet credit can be applied at website checkout toward a membership or Portal Pass; it has no cash value and is not paid out. Referral rewards and wallet checkout are not offered inside the Android app.`
import { env } from '../lib/env'
import { IN_APP } from '../lib/appMode'

const UPDATED = '15 November 2026'

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
        ['Memberships', IN_APP ? MEMBERSHIP_TERMS_APP : MEMBERSHIP_TERMS],
        ...(IN_APP ? [] : [['Portal Pass credits', POST_PASS_TERMS] as [string, string], [FOUNDING.name, FOUNDING_TERMS] as [string, string], ['Referral & wallet', REFERRAL_TERMS] as [string, string]]),
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
      body: IN_APP ? [
        ['Memberships', 'Memberships never auto-renew; access simply ends when the membership ends.'],
        ['Questions', `For any membership or refund question, ${contact}.`],
        ['Free offers', 'The 7-day Platinum trial is free and does not convert to paid automatically.'],
      ] : [
        ['One-time passes', 'Every membership (monthly or yearly) and every Portal Pass is a one-time payment and never auto-renews. Membership access ends when the pass ends unless you buy again. Purchased Portal credits never expire; only an unlocked post’s timer ends, after which that post locks again.'],
        ['Cancellation', 'There is nothing to cancel mid-term because passes do not auto-renew. You can simply choose not to buy again. Stopping a membership after it lapses past grace ends the First 131 discount until you requalify under the published terms.'],
        ['Refunds', `If you are charged by mistake or cannot access paid features because of a fault on our side, ${contact} within 7 days of payment with your Razorpay payment ID. Approved refunds are returned to the original payment method within 5–7 working days. Used Portal credits (already spent on a post) and consumed membership days may be deducted from a goodwill refund. Wallet credit from referrals is not cash and is not refunded as money.`],
        ['Free offers', 'The 7-day Platinum trial is free and does not convert to paid automatically. THE FIRST 131 discount is not a cash coupon; it only reduces the membership price at eligible checkout.'],
        ['Draft', 'This refund and cancellation policy is a draft written for launch. Have it reviewed before relying on it as a final legal document.'],
      ],
    },
    credits: {
      title: 'Portal credit policy',
      body: IN_APP ? [
        ['Credits', 'Portal Pass offers are managed on the website linked to your D31 account. Unused credits stay on your account.'],
        ['Questions', `For questions about credits, ${contact}.`],
      ] : [
        ['What you buy', CREDIT_POLICY],
        ['Downloads', 'Download and offline play are included only while that post’s timer is valid. After expiry the post auto-locks and its in-app downloads are blocked.'],
        ['Platinum', 'Platinum members already have all included vaults, so Portal Pass offers are hidden and are not sold to them.'],
        ['Questions', `For questions about credits, ${contact}.`],
        ['Draft', 'This disclosure is a draft for launch and may be refined.'],
      ],
    },
    founding: {
      title: 'THE FIRST 131',
      body: IN_APP ? [
        ['Campaign', 'THE FIRST 131 recognises the first 131 verified paid members with Founding Member status and early access to selected features, while their membership stays active.'],
        ['Questions', `For questions, ${contact}.`],
      ] : [
        ['Offer (draft)', FOUNDING_TERMS],
        ['Counter', 'Any claimed-count or “places left” figure shown in the app comes from our live records. If the server is unavailable we hide the number rather than invent one.'],
        ['Questions', `For questions, ${contact}.`],
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
      <SocialRow className="mt-8 flex-wrap" />
    </div>
  )
}
