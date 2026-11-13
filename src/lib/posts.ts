import { supabase } from './supabase'
import type { D31Layer } from '../types'

export interface D31PostContent { summary: string; technique: string; biomechanics: string; coaching: string }
export interface D31Post {
  id: number; post_id: string; title: string; layer: D31Layer; skills: string[]; core_skill: string; cover_url: string
  videos: string[]; photos: string[]; pdfs: string[]; content: D31PostContent; created_at: string
}

/** d31_posts from Supabase (full-text RPC when there is a query). Returns null when not live. */
export async function fetchPosts(q: string): Promise<D31Post[] | null> {
  if (!supabase) return null
  const res = q.trim()
    ? await supabase.rpc('search_d31_posts', { q: q.trim() })
    : await supabase.from('d31_posts').select('*').order('created_at', { ascending: false })
  if (res.error) {
    console.warn('[posts]', res.error.message)
    return null
  }
  return res.data as D31Post[]
}
