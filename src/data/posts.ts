/**
 * SAMPLE / MOCK SEED DATA — used when Supabase env is missing.
 * Not production content. Images are Unsplash placeholders for HUD demos.
 */
import type { D31Post } from '../lib/posts'

export const SAMPLE_POSTS: D31Post[] = [
  {
    id: 1,
    post_id: 'D31-RANGE-001',
    title: 'Front Splits — End-Range Ownership',
    layer: 'RANGE',
    skills: ['splits', 'hip-flexor', 'hamstring', 'pelvic-control'],
    core_skill: 'Front Splits',
    cover_url:
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80',
    videos: ['https://example.com/sample/front-splits.mp4'],
    photos: [
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80',
    ],
    pdfs: ['https://example.com/sample/front-splits-protocol.pdf'],
    content: {
      summary:
        'Own anterior and posterior chain length before chasing floor contact. Hip Realm energy — Neev-style depth under control.',
      technique:
        'Square the pelvis, stack the front heel, posterior tilt lightly, breathe into the rear-hip capsule.',
      biomechanics:
        'Kinetic chain: rear-hip extension + front hamstring length. Fault: lumbar dump substitutes for hip ROM.',
      coaching:
        'Regress 10–15° depth. 3×20s isometrics at honest end-range before loaded progressions.',
    },
    created_at: '2026-10-28T08:00:00.000Z',
  },
  {
    id: 2,
    post_id: 'D31-CONTROL-001',
    title: 'Handstand — Shoulder Stack Protocol',
    layer: 'CONTROL',
    skills: ['handstand', 'scapular-control', 'wrist', 'core-brace'],
    core_skill: 'Handstand',
    cover_url:
      'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80',
    videos: ['https://example.com/sample/handstand-kickup.mp4'],
    photos: [
      'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80',
    ],
    pdfs: [],
    content: {
      summary:
        'Shoulder stack before you float. Crush the wall, then leave it — Halo Planet energy.',
      technique:
        'Finger tip pressure, scapulae elevated and slightly protracted, ribs stacked over pelvis.',
      biomechanics:
        'Closed kinetic chain through wrists → elbows → glenohumeral → scapulothoracic. Fault: rib flare + banana back.',
      coaching:
        'Wall facing holds 5×20–40s. Film sagittal. Cue “push the floor away” before kick-ups.',
    },
    created_at: '2026-11-05T16:00:00.000Z',
  },
  {
    id: 3,
    post_id: 'D31-FORCE-001',
    title: 'Nordic Curl — Eccentric Hamstring Force',
    layer: 'FORCE',
    skills: ['nordic-curl', 'hamstring', 'eccentric', 'knee-flexion'],
    core_skill: 'Nordic Curl',
    cover_url:
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80',
    videos: [],
    photos: [
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80',
    ],
    pdfs: ['https://example.com/sample/nordic-progression.pdf'],
    content: {
      summary:
        'Build eccentric hamstring capacity for sprint resilience and hinge integrity.',
      technique:
        'Ankles secured, hips tall, slow descent with intentional knee flexion control.',
      biomechanics:
        'High load at long muscle lengths. Fault: hip hinge escape or abrupt knee collapse.',
      coaching:
        'Band-assisted eccentrics 3×4–6. Add 1–2s pause near failure angle weekly.',
    },
    created_at: '2026-11-01T09:30:00.000Z',
  },
  {
    id: 4,
    post_id: 'D31-FORCE-002',
    title: 'Landmine Single-Leg RDL',
    layer: 'FORCE',
    skills: ['rdl', 'single-leg', 'posterior-chain', 'landmine'],
    core_skill: 'Single-Leg RDL',
    cover_url:
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80',
    videos: ['https://example.com/sample/landmine-sl-rdl.mp4'],
    photos: [
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80',
    ],
    pdfs: [],
    content: {
      summary:
        'Unilateral hinge force with landmine guidance — hip stability under load.',
      technique:
        'Soft knee, hinge at hip, bar path close, reach long through the crown.',
      biomechanics:
        'Stance-leg glute–ham synergy + anti-rotation through trunk. Fault: lumbar rotation / open hip.',
      coaching:
        'Tempo 3-1-1. Film from rear. Pair with 90/90 for hip prep.',
    },
    created_at: '2026-11-03T07:45:00.000Z',
  },
  {
    id: 5,
    post_id: 'D31-EXPRESSION-001',
    title: 'Human Flag — Side-Chain Expression',
    layer: 'EXPRESSION',
    skills: ['human-flag', 'obliques', 'scapular-strength', 'skill'],
    core_skill: 'Human Flag',
    cover_url:
      'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=800&q=80',
    videos: ['https://example.com/sample/human-flag.mp4'],
    photos: [
      'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=800&q=80',
    ],
    pdfs: [],
    content: {
      summary:
        'Lateral chain skill under full body lever — savage expression of CONTROL + FORCE.',
      technique:
        'Bottom arm push, top arm pull, hips stacked, toes long, eyes soft.',
      biomechanics:
        'Anti-lateral-flexion torque through obliques / QL. Fault: piked hips or bent elbows.',
      coaching:
        'Tuck → straddle → full. Hold quality over duration. Film frontal plane weekly.',
    },
    created_at: '2026-10-30T12:15:00.000Z',
  },
  {
    id: 6,
    post_id: 'D31-FORCE-003',
    title: 'Deadlift — Absolute Pull Force',
    layer: 'FORCE',
    skills: ['deadlift', 'hinge', 'grip', 'posterior-chain'],
    core_skill: 'Deadlift',
    cover_url:
      'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=800&q=80',
    videos: [],
    photos: [
      'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=800&q=80',
    ],
    pdfs: ['https://example.com/sample/deadlift-cues.pdf'],
    content: {
      summary:
        'Root force into the floor. Identity of strength starts with an honest hinge.',
      technique:
        'Bar over mid-foot, lats packed, brace, push the floor away, lock hips through.',
      biomechanics:
        'Hip–knee extension synergy; spine as force transmitter not prime mover. Fault: early hip rise.',
      coaching:
        'Film sagittal + rear. Pause below knee on warm-ups. Never chase ego weight.',
    },
    created_at: '2026-11-06T11:20:00.000Z',
  },
  {
    id: 7,
    post_id: 'D31-CONTROL-002',
    title: '90/90 Switch — Hip Rotation Control',
    layer: 'CONTROL',
    skills: ['90-90', 'hip-rotation', 'IR-ER', 'mobility-control'],
    core_skill: '90/90 Sit',
    cover_url:
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80',
    videos: [],
    photos: [
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80',
    ],
    pdfs: [],
    content: {
      summary:
        'Internal / external rotation under bodyweight. Own both sides before load.',
      technique:
        'Tall spine, front shin parallel, switch with controlled IR→ER without lumbar twist.',
      biomechanics:
        'Femoral rotation in acetabulum; trunk stays quiet. Fault: leaning / hip hike.',
      coaching:
        '5 switches / side slow. Add PAILS/RAILS after base control is honest.',
    },
    created_at: '2026-11-04T10:00:00.000Z',
  },
  {
    id: 8,
    post_id: 'D31-IDENTITY-001',
    title: 'D31 Manifesto — Train Like a Universe',
    layer: 'IDENTITY',
    skills: ['philosophy', 'brand', 'long-game', 'protocol-design'],
    core_skill: 'D31 Philosophy',
    cover_url:
      'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&q=80',
    videos: [],
    photos: [
      'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&q=80',
    ],
    pdfs: ['https://example.com/sample/d31-manifesto.pdf'],
    content: {
      summary:
        'Realms map to body. Layers map to capability. Savage, premium, precise — this is D31.UNIVERSE.',
      technique:
        'Program RANGE → CONTROL → FORCE → EXPRESSION. Identity is the through-line.',
      biomechanics:
        'Systems thinking: kinetic chain literacy over isolated aesthetics.',
      coaching:
        'Film weekly. Log faults. Re-test end-range monthly. Never skip the boring foundation.',
    },
    created_at: '2026-09-15T08:00:00.000Z',
  },
]
