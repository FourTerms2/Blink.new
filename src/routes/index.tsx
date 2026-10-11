import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowDownToLine, Check, ChevronDown, Plus, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'

// ─── Flag presets ──────────────────────────────────────────────────────────────
const flags = [
  { id: 'pride',       name: 'Pride',       note: 'Classic rainbow',       colors: ['#E40303','#FF8C00','#FFED00','#008026','#004DFF','#750787'] },
  { id: 'progress',   name: 'Progress',    note: 'Progress pride',         colors: ['#E40303','#FF8C00','#FFED00','#008026','#004DFF','#750787','#FFFFFF','#FFAFC8','#74D7EE','#613915','#000000'] },
  { id: 'trans',      name: 'Trans',       note: 'Transgender pride',      colors: ['#5BCEFA','#F5A9B8','#FFFFFF','#F5A9B8','#5BCEFA'] },
  { id: 'bi',         name: 'Bisexual',    note: 'Bi pride',               colors: ['#D60270','#9B4F96','#0038A8'] },
  { id: 'lesbian',    name: 'Lesbian',     note: 'Sunset pride',           colors: ['#D52D00','#EF7627','#FF9A56','#FFFFFF','#D162A4','#B55690','#A30262'] },
  { id: 'nonbinary',  name: 'Non-binary',  note: 'Non-binary pride',       colors: ['#FCF434','#FFFFFF','#9C59D1','#2C2C2C'] },
  { id: 'pan',        name: 'Pansexual',   note: 'Pan pride',              colors: ['#FF1B8D','#FFD900','#1BB3FF'] },
  { id: 'ace',        name: 'Asexual',     note: 'Ace pride',              colors: ['#000000','#A3A3A3','#FFFFFF','#800080'] },
  { id: 'aro',        name: 'Aromantic',   note: 'Aro pride',              colors: ['#3DA542','#A7D379','#FFFFFF','#A9A9A9','#000000'] },
  { id: 'genderfluid',name: 'Genderfluid', note: 'Genderfluid pride',      colors: ['#FF75A2','#FFFFFF','#BE18D6','#000000','#333EBD'] },
  { id: 'agender',    name: 'Agender',     note: 'Agender pride',          colors: ['#000000','#B9B9B9','#FFFFFF','#B8F483','#FFFFFF','#B9B9B9','#000000'] },
  { id: 'intersex',   name: 'Intersex',    note: 'Intersex pride',         colors: ['#FFD800','#7902AA'] },
  { id: 'ally',       name: 'Ally',        note: 'Ally pride',             colors: ['#000000','#FFFFFF','#7402A1','#FFFFFF','#000000'] },
  { id: 'custom',     name: 'Custom',      note: 'Build your own palette', colors: [] },
]

const addedColorDefaults = ['#F43F5E','#FB923C','#FACC15','#4ADE80','#38BDF8','#A78BFA','#F472B6','#94A3B8']

const patterns = [
  { id: 'horizontal', name: 'Horizontal', glyph: '▤' },
  { id: 'vertical',   name: 'Vertical',   glyph: '▥' },
  { id: 'diagonal',   name: 'Diagonal',   glyph: '▨' },
  { id: 'wave',       name: 'Wave',       glyph: '〰' },
  { id: 'radial',     name: 'Radial',     glyph: '◎' },
  { id: 'checker',    name: 'Checker',    glyph: '⊞' },
] as const

type Pattern = (typeof patterns)[number]['id']

// ─── Color helpers ─────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}

/** Smooth interpolation across a palette at position t ∈ [0,1]. */
function samplePalette(colors: string[], t: number): string {
  if (colors.length === 1) return colors[0]
  const scaled = t * (colors.length - 1)
  const lo = Math.floor(scaled)
  const hi = Math.min(lo + 1, colors.length - 1)
  const f = scaled - lo
  const [r1, g1, b1] = hexToRgb(colors[lo])
  const [r2, g2, b2] = hexToRgb(colors[hi])
  return rgbToHex(r1 + (r2 - r1) * f, g1 + (g2 - g1) * f, b1 + (b2 - b1) * f)
}

/** Darken a hex color by `amount` (0–1). Used for shading side/edge pixels. */
function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount))
}

/** Lighten a hex color by `amount` (0–1). Used for top highlight pixels. */
function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount)
}

// ─── Template pixel regions (exact coordinates from templet.png) ───────────────
//
// The template is 64×32. Every active pixel belongs to one of these named regions.
// We load the template at runtime as a mask (see useTemplateMask), but we also
// hard-code the region boundaries here so we can assign each pixel a normalised
// (u, v) coordinate within its region — that gives patterns a consistent look
// regardless of which region the pixel is in.
//
// Cape  – left face body:   x=2–9,   y=4–15   (8×12)
// Cape  – right face body:  x=13–20, y=4–15   (8×12, same design mirrored)
// Cape  – left sides:       x=0–1,   y=4–16   (2×13 edge strips)
// Cape  – right sides:      x=10–12, y=4–16   (3×13 edge/gap strips)
// Cape  – far right side:   x=21,    y=4–16   (1×13)
// Cape  – top strip:        x=0–21,  y=0–3    (top face)
// Cape  – bottom strip:     x=0–21,  y=16     (bottom edge)
//
// Elytra – left wing body:  x=25–32, y=4–20   (8×17)
// Elytra – right wing body: x=37–44, y=4–20   (8×17, mirrored)
// Elytra – left borders:    x=22–24, y=4–21
// Elytra – right borders:   x=33–36, y=4–21
// Elytra – far border:      x=45,    y=4–21
// Elytra – top strip:       x=22–45, y=0–3
// Elytra – bottom strip:    x=22–45, y=21

// Given a pixel's (x,y), return a normalised (u,v) ∈ [0,1] and a shade multiplier.
// u drives horizontal patterns, v drives vertical patterns.
// shade: 1.0 = full color, <1 = darker (sides/edges), >1 = lighter (top highlight).
function getPixelUV(px: number, py: number): { u: number; v: number; shade: number } {
  // ── Cape left face body (main design area) ────────────────────────────────
  if (px >= 2 && px <= 9 && py >= 4 && py <= 15) {
    return { u: (px - 2) / 7, v: (py - 4) / 11, shade: 1.0 }
  }
  // ── Cape right face body (same design, slightly darker — it's the back face) ─
  if (px >= 13 && px <= 20 && py >= 4 && py <= 15) {
    return { u: (px - 13) / 7, v: (py - 4) / 11, shade: 0.88 }
  }
  // ── Cape top strip (y=0–3): maps u from cape x range, v from top ─────────
  if (px >= 0 && px <= 21 && py >= 0 && py <= 3) {
    return { u: px / 21, v: py / 3, shade: 1.08 }
  }
  // ── Cape bottom strip (y=16) ──────────────────────────────────────────────
  if (px >= 0 && px <= 21 && py === 16) {
    return { u: px / 21, v: 1.0, shade: 0.75 }
  }
  // ── Cape left edge strips (x=0–1, y=4–16): narrow side faces ─────────────
  if (px <= 1 && py >= 4 && py <= 16) {
    return { u: px / 1, v: (py - 4) / 12, shade: 0.72 }
  }
  // ── Cape middle/right edge strips (x=10–12, y=4–16) ──────────────────────
  if (px >= 10 && px <= 12 && py >= 4 && py <= 16) {
    return { u: (px - 10) / 2, v: (py - 4) / 12, shade: 0.78 }
  }
  // ── Cape far right edge (x=21, y=4–16) ───────────────────────────────────
  if (px === 21 && py >= 4 && py <= 16) {
    return { u: 1.0, v: (py - 4) / 12, shade: 0.72 }
  }
  // ── Elytra left wing body ─────────────────────────────────────────────────
  if (px >= 25 && px <= 32 && py >= 4 && py <= 20) {
    return { u: (px - 25) / 7, v: (py - 4) / 16, shade: 1.0 }
  }
  // ── Elytra right wing body (mirrored u so the pattern is symmetric) ───────
  if (px >= 37 && px <= 44 && py >= 4 && py <= 20) {
    return { u: 1 - (px - 37) / 7, v: (py - 4) / 16, shade: 0.88 }
  }
  // ── Elytra top strip (y=0–3) ─────────────────────────────────────────────
  if (px >= 22 && px <= 45 && py >= 0 && py <= 3) {
    return { u: (px - 22) / 23, v: py / 3, shade: 1.08 }
  }
  // ── Elytra bottom strip (y=21) ───────────────────────────────────────────
  if (px >= 22 && px <= 45 && py === 21) {
    return { u: (px - 22) / 23, v: 1.0, shade: 0.75 }
  }
  // ── Elytra left border strips (x=22–24, y=4–21) ──────────────────────────
  if (px >= 22 && px <= 24 && py >= 4 && py <= 21) {
    return { u: 0, v: (py - 4) / 17, shade: 0.72 }
  }
  // ── Elytra middle border strips (x=33–36, y=4–21) ────────────────────────
  if (px >= 33 && px <= 36 && py >= 4 && py <= 21) {
    return { u: 0.5, v: (py - 4) / 17, shade: 0.78 }
  }
  // ── Elytra far right border (x=45, y=4–21) ───────────────────────────────
  if (px === 45 && py >= 4 && py <= 21) {
    return { u: 1.0, v: (py - 4) / 17, shade: 0.72 }
  }
  // Fallback (should not be reached for active pixels)
  return { u: 0, v: 0, shade: 1.0 }
}

/** Compute a palette t-value ∈ [0,1] for a pixel given its (u,v) and pattern. */
function getStripeT(u: number, v: number, pattern: Pattern): number {
  switch (pattern) {
    case 'horizontal': return v
    case 'vertical':   return u
    case 'diagonal':   return (u + v) / 2
    case 'wave':       return Math.min(1, Math.max(0, (v + 0.18 * Math.sin(u * Math.PI * 3)) % 1))
    case 'radial': {
      const du = u - 0.5, dv = v - 0.5
      return Math.min(1, Math.sqrt(du * du + dv * dv) * 1.8)
    }
    case 'checker': {
      const steps = 6
      const cu = Math.floor(u * steps), cv = Math.floor(v * steps)
      return ((cu + cv) % 2 === 0 ? u : 1 - u)
    }
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Pride Cape & Elytra Studio' },
      { name: 'description', content: 'Design and download a combined pride cape + elytra texture for Minecraft Java Edition.' },
    ],
  }),
  component: CapeStudio,
})

// ─── Template mask loader ──────────────────────────────────────────────────────
// Returns a Set of "x,y" strings for every opaque pixel in the template.
// Falls back to the hard-coded region list if the image can't load.

function useTemplateMask() {
  const [mask, setMask] = useState<Set<string> | null>(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, img.width, img.height).data
      const s = new Set<string>()
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const a = data[(y * img.width + x) * 4 + 3]
          if (a > 0) s.add(`${x},${y}`)
        }
      }
      setMask(s)
    }
    img.onerror = () => setMask(buildFallbackMask())
    img.src = '/templet.png'
  }, [])

  return mask
}

/** Hard-coded fallback covering every region from the template analysis. */
function buildFallbackMask(): Set<string> {
  const s = new Set<string>()
  const add = (x: number, y: number) => s.add(`${x},${y}`)
  // Cape top strip
  for (let y = 0; y <= 3; y++) for (let x = 0; x <= 21; x++) add(x, y)
  // Cape body rows (y=4–15): full width x=0–21
  for (let y = 4; y <= 15; y++) for (let x = 0; x <= 21; x++) add(x, y)
  // Cape bottom strip
  for (let x = 0; x <= 21; x++) add(x, 16)
  // Elytra top strip
  for (let y = 0; y <= 3; y++) for (let x = 22; x <= 45; x++) add(x, y)
  // Elytra body rows (y=4–20): full width x=22–45
  for (let y = 4; y <= 20; y++) for (let x = 22; x <= 45; x++) add(x, y)
  // Elytra bottom strip
  for (let x = 22; x <= 45; x++) add(x, 21)
  return s
}

// ─── Main component ───────────────────────────────────────────────────────────

function CapeStudio() {
  const mask = useTemplateMask()

  const [flagId, setFlagId]           = useState('pride')
  const [pattern, setPattern]         = useState<Pattern>('horizontal')
  const [customColors, setCustomColors] = useState(addedColorDefaults.slice(0, 6))
  const preset = flags.find(f => f.id === flagId) ?? flags[0]
  const [editedColors, setEditedColors] = useState(preset.colors)
  const flag = { ...preset, colors: flagId === 'custom' ? customColors : editedColors }
  const colors = flag.colors.length ? flag.colors : ['#E40303', '#004DFF']

  // Build the full 64×32 pixel map from the mask + current settings.
  // Each entry is either a hex color string or null (transparent).
  const texturePixels = useMemo<(string | null)[]>(() => {
    const result: (string | null)[] = new Array(64 * 32).fill(null)
    const activeMask = mask ?? buildFallbackMask()
    activeMask.forEach(key => {
      const [x, y] = key.split(',').map(Number)
      const { u, v, shade } = getPixelUV(x, y)
      const t = getStripeT(u, v, pattern)
      const base = samplePalette(colors, t)
      const final = shade >= 1
        ? lighten(base, (shade - 1) * 0.5)
        : darken(base, 1 - shade)
      result[y * 64 + x] = final
    })
    return result
  }, [mask, colors, pattern])

  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  // Paint the preview canvas whenever texturePixels changes
  useEffect(() => {
    const canvas = previewCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 64, 32)
    texturePixels.forEach((color, i) => {
      if (!color) return
      const x = i % 64
      const y = Math.floor(i / 64)
      ctx.fillStyle = color
      ctx.fillRect(x, y, 1, 1)
    })
  }, [texturePixels])

  function chooseFlag(id: string) {
    const next = flags.find(f => f.id === id) ?? flags[0]
    setFlagId(id)
    if (id !== 'custom') setEditedColors(next.colors)
  }

  function updateColor(index: number, color: string) {
    const up = (arr: string[]) => arr.map((c, i) => i === index ? color : c)
    if (flagId === 'custom') setCustomColors(up)
    else setEditedColors(up)
  }

  function addColor() {
    if (colors.length >= 12) { toast.error('A palette can have up to 12 colors.'); return }
    const next = [...colors, addedColorDefaults[colors.length % addedColorDefaults.length]]
    if (flagId === 'custom') setCustomColors(next)
    else setEditedColors(next)
  }

  function removeColor(index: number) {
    if (colors.length <= 2) { toast.error('Keep at least two colors in your palette.'); return }
    const next = colors.filter((_, i) => i !== index)
    if (flagId === 'custom') setCustomColors(next)
    else setEditedColors(next)
  }

  function downloadTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    if (!ctx) { toast.error('Your browser could not create the texture.'); return }
    ctx.imageSmoothingEnabled = false
    texturePixels.forEach((color, i) => {
      if (!color) return
      ctx.fillStyle = color
      ctx.fillRect(i % 64, Math.floor(i / 64), 1, 1)
    })
    canvas.toBlob(blob => {
      if (!blob) { toast.error('The texture could not be exported.'); return }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pride-cape-elytra-${flag.id}-${pattern}.png`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Your combined 64 × 32 cape + elytra texture is ready.')
    }, 'image/png')
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <a href="#top" className="flex items-center gap-3" aria-label="Pride Cape Studio home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-xl text-primary-foreground">✳</span>
          <span className="font-semibold tracking-tight">Pride Cape <span className="font-normal text-muted-foreground">Studio</span></span>
        </a>
        <span className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Texture lab · 1.20+
        </span>
      </header>

      <section id="top" className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:pt-14">
        <div className="flex flex-col justify-center">
          <div className="mb-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            <Sparkles size={14} /> Made to be seen
          </div>
          <h1 className="max-w-xl font-serif text-5xl font-medium leading-[1.04] tracking-[-0.045em] sm:text-6xl">
            Wear your colors, <em className="text-primary">your way.</em>
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">
            Design your palette once — download a single texture that covers both your cape and elytra.
          </p>

          <div className="mt-9 space-y-7">
            {/* Palette picker */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Pick your colors</h2>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">01 / palette</span>
              </div>
              <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                {flags.map(item => (
                  <button key={item.id} type="button" onClick={() => chooseFlag(item.id)}
                    className={`group rounded-xl border p-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${flagId === item.id ? 'border-primary bg-card shadow-sm ring-1 ring-primary/30' : 'border-border bg-card/60 hover:border-foreground/25'}`}
                    aria-pressed={flagId === item.id}>
                    <span className="mb-2 flex h-3 overflow-hidden rounded-full">
                      {(item.id === 'custom' ? customColors : item.colors).map((c, i) =>
                        <span key={i} className="flex-1" style={{ backgroundColor: c }} />
                      )}
                    </span>
                    <span className="flex items-center justify-between text-xs font-semibold">
                      {item.name}{flagId === item.id && <Check size={13} className="text-primary" />}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">{item.note}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Color editor */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Edit palette</h2>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">03 / colors</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/60 p-3">
                {colors.map((color, index) => (
                  <div key={`${flag.id}-${index}`} className="group relative">
                    <label className="block h-10 w-10 cursor-pointer overflow-hidden rounded-lg border border-foreground/15 shadow-sm transition-transform hover:scale-105" title={`Change color ${index + 1}`}>
                      <span className="block h-full w-full" style={{ backgroundColor: color }} />
                      <input aria-label={`Color ${index + 1}`} type="color" value={color}
                        onChange={e => updateColor(index, e.target.value)}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                    </label>
                    <button type="button" onClick={() => removeColor(index)} aria-label={`Remove color ${index + 1}`}
                      className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm group-hover:flex">
                      <X size={11} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addColor} aria-label="Add a color"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-foreground/30 text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                  <Plus size={17} />
                </button>
                <span className="ml-auto text-[10px] text-muted-foreground">Tap a swatch to edit · up to 12</span>
              </div>
            </div>

            {/* Pattern picker */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Choose a pattern</h2>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">02 / layout</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {patterns.map(item => (
                  <button key={item.id} type="button" onClick={() => setPattern(item.id)}
                    aria-pressed={pattern === item.id}
                    className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium transition-all hover:-translate-y-0.5 active:scale-[0.98] ${pattern === item.id ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-card hover:border-foreground/25'}`}>
                    <span className="text-base leading-none">{item.glyph}</span>
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button type="button" onClick={downloadTexture}
            className="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] sm:w-fit">
            <ArrowDownToLine size={18} />
            Download cape + elytra texture
            <ChevronDown size={15} className="rotate-[-90deg] opacity-70" />
          </button>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            PNG · 64 × 32 pixels · Cape &amp; elytra combined · Java Edition 1.20+
          </p>
        </div>

        {/* Preview panel */}
        <div className="relative flex min-h-[430px] flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-border bg-[#e8e0d3] px-6 py-10 sm:min-h-[540px] dark:bg-[#302a32]">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(var(--foreground) 0.6px, transparent 0.6px)', backgroundSize: '18px 18px' }} />

          <div className="relative mb-6 flex w-full max-w-sm items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/60">Live preview</span>
            <span className="rounded-full border border-foreground/15 bg-background/60 px-2.5 py-1 font-mono text-[10px] text-foreground/70">Cape + Elytra · 64 × 32</span>
          </div>

          {/* The preview IS the 64×32 canvas, scaled up with pixelated rendering */}
          <div className="relative flex flex-col items-center gap-5">
            {/* Cape preview — shows the cape portion (x=0–22) */}
            <div className="flex flex-col items-center">
              <span className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-foreground/45">Cape</span>
              <div className="mb-[-1px] h-2.5 w-14 rounded-t-full border-x border-t border-foreground/15 bg-[#736d70]" />
              <div className="overflow-hidden rounded-b-sm border border-foreground/20 shadow-[0_16px_32px_-12px_rgba(25,15,25,0.5)]"
                style={{ width: 'min(55vw,280px)' }}>
                <canvas
                  ref={previewCanvasRef}
                  width={64}
                  height={32}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: 'auto',
                    imageRendering: 'pixelated',
                  }}
                  aria-label={`${flag.name} cape and elytra texture preview`}
                />
              </div>
            </div>

            {/* Label */}
            <div className="flex items-center gap-2 rounded-full border border-foreground/15 bg-background/55 px-3 py-1.5 text-xs text-foreground/75">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[0] }} />
              {flag.name} · {pattern}
            </div>
          </div>

          <div className="relative mt-8 flex items-center gap-3 text-center text-xs text-foreground/55">
            <span className="h-px w-8 bg-foreground/20" />
            Your colors, your story
            <span className="h-px w-8 bg-foreground/20" />
          </div>
        </div>
      </section>
      <footer className="border-t border-border/70 px-5 py-5 text-center text-xs text-muted-foreground">
        Made with pride, one pixel at a time.
      </footer>
    </main>
  )
}
