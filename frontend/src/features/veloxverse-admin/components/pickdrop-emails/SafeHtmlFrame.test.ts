import { describe, it, expect } from 'vitest'
import { wrapSrcDoc } from './SafeHtmlFrame'

describe('email preview frame', () => {
  const csp = (doc: string) => /Content-Security-Policy" content="([^"]+)"/.exec(doc)?.[1] ?? ''

  it("allows the VeloxVerse logo VeloxVerse's previews load (https, or localhost when run locally)", () => {
    const policy = csp(wrapSrcDoc('<img src="https://app.veloxverse.com/logo.png">'))
    expect(policy).toMatch(/img-src [^;]*https:/)
    expect(policy).toMatch(/img-src [^;]*http:\/\/localhost:\*/)
  })

  it('still blocks scripts and everything else', () => {
    const policy = csp(wrapSrcDoc('<p>x</p>'))
    expect(policy).toContain("default-src 'none'")
    expect(policy).not.toMatch(/script-src/)
  })
})
