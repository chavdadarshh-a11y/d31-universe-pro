/** Route map: Leaflet + OpenStreetMap tiles (loaded only on the Run screens). Works without tiles too (offline → just the line). */
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Map as LMap, Polyline, CircleMarker } from 'leaflet'
import type { LatLng } from '../lib/runs'
import { useSettings, resolvedTheme } from '../store/settings'

export function RunMap({ path, follow = false, className = '' }: { path: LatLng[]; follow?: boolean; className?: string }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<{ m: LMap; line: Polyline; dot: CircleMarker; start: CircleMarker } | null>(null)
  const dark = resolvedTheme(useSettings((s) => s.theme)) === 'night'
  useEffect(() => {
    let dead = false
    void import('leaflet').then((L) => {
      if (dead || !el.current || map.current) return
      const m = L.map(el.current, { zoomControl: false, attributionControl: true, center: path[0] ?? [22.3, 70.8], zoom: path.length ? 16 : 4 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, subdomains: 'abc', attribution: '© OpenStreetMap' }).addTo(m)
      const line = L.polyline(path, { color: '#22d3ee', weight: 5, opacity: 0.95, lineCap: 'round' }).addTo(m)
      const start = L.circleMarker(path[0] ?? [0, 0], { radius: 6, color: '#04060c', weight: 2, fillColor: '#a3e635', fillOpacity: 1 }).addTo(m)
      const dot = L.circleMarker(path[path.length - 1] ?? [0, 0], { radius: 7, color: '#04060c', weight: 2, fillColor: '#f7c548', fillOpacity: 1 }).addTo(m)
      map.current = { m, line, dot, start }
      if (path.length > 1 && !follow) m.fitBounds(line.getBounds(), { padding: [24, 24] })
    })
    return () => { dead = true; map.current?.m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const x = map.current
    if (!x || !path.length) return
    x.line.setLatLngs(path)
    x.start.setLatLng(path[0])
    x.dot.setLatLng(path[path.length - 1])
    if (follow) x.m.setView(path[path.length - 1], Math.max(x.m.getZoom(), 16), { animate: true })
    else if (path.length > 1) x.m.fitBounds(x.line.getBounds(), { padding: [24, 24] })
  }, [path, follow])
  return <div className={`run-map dark-zone ${dark ? 'run-dark-tiles' : ''} ${className}`} data-testid="run-map"><div ref={el} className="h-full w-full" /></div>
}
