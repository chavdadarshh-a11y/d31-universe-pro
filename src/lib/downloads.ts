/**
 * In-app downloads (Platinum). Files are stored INSIDE the app (IndexedDB) and are never
 * written to the phone's gallery or file system. A per-account list of what was saved is kept
 * in localStorage and, when Supabase is configured, mirrored to the `user_downloads` table so
 * a reinstall can show the list again and re-download into the app.
 *
 * Note for the Play Store build (TWA / Capacitor): uninstalling clears in-app storage — that is
 * expected. The cloud list is what brings the downloads back after a reinstall.
 */
import { create } from 'zustand'
import { useApp } from '../store/app'
import { supabase } from './supabase'
import { kFetchUrl } from './knowledge'

export type DlType = 'video' | 'pdf' | 'photo'
export type DlItem = {
  item_id: string // `${type}:${source_id}`
  type: DlType
  title: string
  source_id: string // Google Drive file id
  size: number
  downloaded_at: string
  mime?: string
  post?: number
  /** à-la-carte unlock key (`<post>:<video|pdf>:<n>`) — a bought item stays openable without a plan */
  unlock?: string
}

const DB = 'd31-downloads'
const STORE = 'files'
const accountKey = () => useApp.getState().user?.id ?? 'guest'
const listKey = (acc = accountKey()) => `d31-dl-list:${acc}`
const blobKey = (item_id: string, acc = accountKey()) => `${acc}|${item_id}`
export const itemId = (type: DlType, sourceId: string) => `${type}:${sourceId}`

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const d = await db()
  return new Promise<T>((res, rej) => {
    const tx = d.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    req.onsuccess = () => res(req.result as T)
    req.onerror = () => rej(req.error)
  })
}
export const getBlob = (item_id: string) => idb<Blob | undefined>('readonly', (s) => s.get(blobKey(item_id)))
const putBlob = (item_id: string, b: Blob) => idb('readwrite', (s) => s.put(b, blobKey(item_id)))
const delBlob = (item_id: string) => idb('readwrite', (s) => s.delete(blobKey(item_id)))
const allKeys = () => idb<IDBValidKey[]>('readonly', (s) => s.getAllKeys())

function readList(): DlItem[] {
  try { return JSON.parse(localStorage.getItem(listKey()) || '[]') } catch { return [] }
}
function writeList(l: DlItem[]) {
  try { localStorage.setItem(listKey(), JSON.stringify(l)) } catch { /* quota */ }
}

/* ── cloud mirror (Supabase `user_downloads`, RLS: owner only) ── */
const cloudUser = () => (supabase ? useApp.getState().user?.id : undefined)
export const cloudRestoreReady = () => !!supabase
async function cloudUpsert(it: DlItem) {
  const uid = cloudUser()
  if (!supabase || !uid) return
  const { error } = await supabase.from('user_downloads').upsert({ user_id: uid, item_id: it.item_id, type: it.type, title: it.title, source_id: it.source_id, size: it.size, downloaded_at: it.downloaded_at, unlock_key: it.unlock ?? null }, { onConflict: 'user_id,item_id' })
  if (error) console.warn('[downloads] cloud upsert', error.message)
}
async function cloudDelete(item_id: string) {
  const uid = cloudUser()
  if (!supabase || !uid) return
  const { error } = await supabase.from('user_downloads').delete().eq('user_id', uid).eq('item_id', item_id)
  if (error) console.warn('[downloads] cloud delete', error.message)
}
async function cloudList(): Promise<DlItem[] | null> {
  const uid = cloudUser()
  if (!supabase || !uid) return null
  const { data, error } = await supabase.from('user_downloads').select('item_id,type,title,source_id,size,downloaded_at,unlock_key').eq('user_id', uid)
  if (error) { console.warn('[downloads] cloud list', error.message); return null }
  return ((data ?? []) as (DlItem & { unlock_key?: string | null })[]).map(({ unlock_key, ...x }) => ({ ...x, unlock: unlock_key ?? undefined }))
}

type DlState = {
  list: DlItem[]
  present: Record<string, boolean> // stored on THIS phone
  progress: Record<string, number> // 0..1 while downloading
  errors: Record<string, string>
  loaded: string | null // account the state belongs to
  refresh: () => Promise<void>
  save: (it: Omit<DlItem, 'item_id' | 'size' | 'downloaded_at'> & { size?: number }) => Promise<boolean>
  remove: (item_id: string) => Promise<void>
  restoreMissing: () => Promise<number>
}

export const useDownloads = create<DlState>()((set, get) => ({
  list: [], present: {}, progress: {}, errors: {}, loaded: null,
  refresh: async () => {
    const acc = accountKey()
    let list = readList()
    const remote = await cloudList()
    if (remote) {
      const ids = new Set(list.map((x) => x.item_id))
      for (const r of remote) if (!ids.has(r.item_id)) list.push(r)
      writeList(list)
    }
    const keys = new Set((await allKeys().catch(() => [])).map(String))
    const present: Record<string, boolean> = {}
    for (const it of list) present[it.item_id] = keys.has(blobKey(it.item_id, acc))
    list = list.slice().sort((a, b) => b.downloaded_at.localeCompare(a.downloaded_at))
    set({ list, present, loaded: acc })
  },
  save: async (base) => {
    const item_id = itemId(base.type, base.source_id)
    if (get().progress[item_id] !== undefined) return false
    set((s) => ({ progress: { ...s.progress, [item_id]: 0 }, errors: { ...s.errors, [item_id]: '' } }))
    try {
      const url = kFetchUrl(base.type, base.source_id)
      if (!url) throw new Error('needs-key')
      const res = await fetch(url)
      if (!res.ok || !res.body) throw new Error(String(res.status))
      const total = Number(res.headers.get('content-length')) || base.size || 0
      const reader = res.body.getReader()
      const chunks: BlobPart[] = []
      let got = 0, last = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        got += value.byteLength
        const p = total ? got / total : 0
        if (p - last > 0.01) { last = p; set((s) => ({ progress: { ...s.progress, [item_id]: Math.min(0.99, p) } })) }
      }
      const type = res.headers.get('content-type') || base.mime || (base.type === 'pdf' ? 'application/pdf' : base.type === 'video' ? 'video/mp4' : 'image/jpeg')
      if (/text\/html/.test(type)) throw new Error('html')
      const blob = new Blob(chunks, { type })
      await putBlob(item_id, blob)
      const it: DlItem = { item_id, type: base.type, title: base.title, source_id: base.source_id, size: blob.size, downloaded_at: new Date().toISOString(), mime: type, post: base.post, unlock: base.unlock }
      writeList([it, ...readList().filter((x) => x.item_id !== item_id)])
      void cloudUpsert(it)
      set((s) => { const progress = { ...s.progress }; delete progress[item_id]; return { progress } })
      await get().refresh()
      return true
    } catch (e) {
      set((s) => { const progress = { ...s.progress }; delete progress[item_id]; return { progress, errors: { ...s.errors, [item_id]: e instanceof Error ? e.message : 'error' } } })
      return false
    }
  },
  remove: async (item_id) => {
    await delBlob(item_id).catch(() => {})
    writeList(readList().filter((x) => x.item_id !== item_id))
    void cloudDelete(item_id)
    await get().refresh()
  },
  restoreMissing: async () => {
    const { list, present } = get()
    let n = 0
    for (const it of list) if (!present[it.item_id]) { if (await get().save(it)) n++ }
    return n
  },
}))

/** Blob URL for a saved item (caller revokes). */
export async function savedUrl(item_id: string): Promise<string | null> {
  const b = await getBlob(item_id).catch(() => undefined)
  return b ? URL.createObjectURL(b) : null
}

export async function storageUsed(): Promise<number | null> {
  try { return (await navigator.storage?.estimate?.())?.usage ?? null } catch { return null }
}
/** Ask the browser not to evict our in-app files under storage pressure. */
export const persistStorage = () => navigator.storage?.persist?.().catch(() => false)

export const onWifi = () => {
  const c = (navigator as Navigator & { connection?: { type?: string } }).connection
  return !c?.type || c.type === 'wifi' || c.type === 'ethernet'
}

export const fmtBytes = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`)

/** Remove every in-app file + the local list for an account (used by "Delete account"). */
export async function wipeAccountDownloads(acc: string) {
  try { localStorage.removeItem(listKey(acc)) } catch { /* ignore */ }
  const keys = (await allKeys().catch(() => [])).map(String).filter((k) => k.startsWith(`${acc}|`))
  for (const k of keys) await idb('readwrite', (s) => s.delete(k)).catch(() => {})
}
