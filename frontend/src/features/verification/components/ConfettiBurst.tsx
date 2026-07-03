import { useEffect, useRef } from 'react'

interface Props {
  /** How long new firecracker bursts keep firing (ms). Particles finish falling after this. */
  durationMs?: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rot: number
  vr: number
  life: number
  maxLife: number
  shape: 0 | 1
}

const COLORS = ['#4EAFFF', '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#FACC15']

/**
 * Full-screen, click-through canvas that fires a few firecracker-style
 * confetti bursts and then goes quiet. Mount it to celebrate, unmount when done.
 */
export default function ConfettiBurst({ durationMs = 3500 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
    }
    resize()
    window.addEventListener('resize', resize)

    const particles: Particle[] = []

    const burst = (fx: number, fy: number, count: number) => {
      const x = canvas.width * fx
      const y = canvas.height * fy
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 4 + Math.random() * 9
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4,
          size: (4 + Math.random() * 5) * dpr,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          life: 0,
          maxLife: 70 + Math.random() * 50,
          shape: Math.random() < 0.5 ? 0 : 1,
        })
      }
    }

    // Firecracker sequence
    burst(0.5, 0.35, 90)
    const timers = [
      setTimeout(() => burst(0.2, 0.45, 70), 350),
      setTimeout(() => burst(0.8, 0.45, 70), 700),
      setTimeout(() => burst(0.5, 0.28, 80), 1200),
      setTimeout(() => burst(0.35, 0.5, 60), 1800),
      setTimeout(() => burst(0.65, 0.4, 60), 2400),
    ].filter((_, i) => (i + 1) * 500 < durationMs + 500)

    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life++
        p.vy += 0.18 // gravity
        p.vx *= 0.985
        p.x += p.vx * dpr
        p.y += p.vy * dpr
        p.rot += p.vr
        const alpha = Math.max(0, 1 - p.life / p.maxLife)
        if (alpha <= 0 || p.y > canvas.height + 20 * dpr) {
          particles.splice(i, 1)
          continue
        }
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        if (p.shape === 0) {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        } else {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
      if (now - start < durationMs || particles.length > 0) {
        raf = requestAnimationFrame(tick)
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
      window.removeEventListener('resize', resize)
    }
  }, [durationMs])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] h-full w-full"
    />
  )
}
