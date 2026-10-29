/** `data-tour` value of a sidebar link, e.g. navTarget('/dashboard/customers') → "nav:/dashboard/customers". */
export const navTarget = (path: string) => `nav:${path}`

/**
 * The element marked `data-tour="<id>"` if it can be shown, else null — a missing, hidden,
 * zero-size or off-canvas target (e.g. the sidebar slid away on a phone) means that tour step is
 * skipped. A target merely scrolled out of view vertically (lower down a long sidebar) still
 * counts: the tour scrolls it into view.
 */
export function findVisibleTarget(id: string, root: ParentNode = document): HTMLElement | null {
  const el = root.querySelector<HTMLElement>(`[data-tour="${CSS.escape(id)}"]`)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  if (rect.right <= 0 || rect.left >= window.innerWidth) return null
  const style = window.getComputedStyle(el)
  if (style.visibility === 'hidden' || style.display === 'none') return null
  return el
}

/** Selector for an open dialog / drawer that the tour must wait for (its own UI excluded). */
const OPEN_DIALOG = '[role="dialog"]:not([data-onboarding-tour]), [role="alertdialog"], [aria-modal="true"]:not([data-onboarding-tour])'

export const isAnyDialogOpen = (root: ParentNode = document) => root.querySelector(OPEN_DIALOG) !== null
