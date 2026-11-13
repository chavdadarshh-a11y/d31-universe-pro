import { useRef } from 'react'
import { Camera } from 'lucide-react'
import { avatarFromFile } from '../lib/accounts'

export function Avatar({ src, name, size = 56, className = '' }: { src?: string; name?: string; size?: number; className?: string }) {
  const initials = (name || 'D31').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className={`avatar-ring relative grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-panel-2 font-display font-bold text-gold ${className}`} style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials}
    </span>
  )
}

/** Avatar with a camera button to pick a new photo (resized to 256px on the phone). */
export function AvatarPicker({ src, name, onChange, size = 84 }: { src?: string; name?: string; onChange: (dataUrl: string) => void; size?: number }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <button type="button" onClick={() => ref.current?.click()} className="relative" aria-label="Change photo" data-testid="avatar-pick">
      <Avatar src={src} name={name} size={size} />
      <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-xl border border-cyan/50 bg-[#061019] text-cyan"><Camera size={15} /></span>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (f) onChange(await avatarFromFile(f))
      }} />
    </button>
  )
}
