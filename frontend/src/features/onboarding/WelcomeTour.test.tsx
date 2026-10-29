import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Bell, Sparkles } from 'lucide-react'
import WelcomeTour from './WelcomeTour'
import type { TourStep } from './tourSteps'

vi.mock('focus-trap-react', () => ({ default: ({ children }: { children: React.ReactNode }) => children }))

const steps: TourStep[] = [
  { id: 'welcome', icon: Sparkles, title: 'Welcome', body: 'Hello' },
  { id: 'bell', target: 'notifications', icon: Bell, title: 'Notifications', body: 'Updates' },
]

afterEach(() => {
  document.body.innerHTML = ''
})

describe('<WelcomeTour />', () => {
  it('steps forward and back with buttons and arrow keys, and announces each step', () => {
    const target = document.createElement('button')
    target.dataset.tour = 'notifications'
    target.getBoundingClientRect = () => ({ top: 10, left: 900, right: 940, bottom: 50, width: 40, height: 40, x: 900, y: 10, toJSON: () => ({}) }) as DOMRect
    document.body.appendChild(target)
    const onComplete = vi.fn()
    render(<WelcomeTour steps={steps} onComplete={onComplete} onDismiss={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: 'Welcome' })).toBeInTheDocument()
    expect(screen.getByText('Step 1 of 2: Welcome')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeInTheDocument()
    expect(screen.getByText('Step 2 of 2: Notifications')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByRole('dialog', { name: 'Welcome' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('a step whose target has gone shows without a spotlight instead of failing', () => {
    render(<WelcomeTour steps={[steps[1]]} onComplete={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeInTheDocument()
  })

  it('the close button and Skip both dismiss', () => {
    const onDismiss = vi.fn()
    render(<WelcomeTour steps={steps} onComplete={vi.fn()} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close tour' }))
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }))
    expect(onDismiss).toHaveBeenCalledTimes(2)
  })
})
