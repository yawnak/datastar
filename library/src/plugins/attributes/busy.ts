// Icon: material-symbols:hourglass-outline
// Slug: Marks an element busy while an expression is true.
// Description: While the expression is true the element is aria-busy and aria-disabled, ignores clicks (mouse, Enter, Space), pulses after a moment, and eases back when it's done; screen readers hear a message after a second.

// A button whose action is on its way:
//
// - `data-busy="$saving"`: this element, while the expression is true.
// - `data-busy-rows="{resend: $pendingResend, revoke: $pendingRevoke}"`,
//   on a list: each value is a row's id (or false), and the button busy is
//   `[data-act="<key>"]` inside that row (`[data-row="<id>"]`). One
//   expression for a whole list, instead of one per row's button.
//
// Busy means:
//
// - `aria-busy` and `aria-disabled`, for styles and screen readers. Not
//   `disabled`, which drops focus and hides it from screen readers; not
//   `pointer-events: none`, which drops its hover on the click.
// - No second press: its clicks are stopped before anything else hears
//   them (a capturing listener on the element runs first; a list's
//   handler, further up, never sees them), whether from a mouse, Enter or
//   Space. `@get`'s default would instead abort the first request and send
//   again.
// - A pulse once it has been busy `PULSE_AFTER_MS` (sooner would only
//   flicker), none with reduced motion; eased back from wherever the pulse
//   was when it's done (a removed CSS animation would snap).
// - After `ANNOUNCE_AFTER_MS`, a polite live region on the page,
//   `#busy-status`, says its `data-message` ("Working…" by default):
//   `aria-busy` on a button is mostly not announced. The region must be in
//   the page from the start, or screen readers may miss it.
//
// The opacities are the starting point; the page's styles give the busy
// element its look (`[aria-busy='true']`).

import { attribute } from '@engine'
import { effect } from '@engine/signals'

const PULSE_AFTER_MS = 400
const ANNOUNCE_AFTER_MS = 1000
const FADED = 0.8
const DIPPED = 0.45
const STATUS_ID = 'busy-status'

const still = matchMedia('(prefers-reduced-motion: reduce)')
/** How many busy elements are being announced: the last one clears it. */
let announcing = 0
/** Busy elements, and what makes each one not busy again. */
const releases = new WeakMap<Element, () => void>()

const guard = (evt: Event) => {
  evt.preventDefault()
  evt.stopImmediatePropagation()
}

/** Makes `el` busy, until `release(el)`. */
const hold = (el: HTMLElement) => {
  if (releases.has(el)) return
  el.setAttribute('aria-busy', 'true')
  el.setAttribute('aria-disabled', 'true')
  el.addEventListener('click', guard, true)
  el.animate([{ opacity: 1 }, { opacity: FADED }], {
    duration: 120,
    easing: 'ease-out',
  })
  const pulse = still.matches
    ? undefined
    : el.animate([{ opacity: FADED }, { opacity: DIPPED }, { opacity: FADED }], {
        duration: 1400,
        delay: PULSE_AFTER_MS,
        iterations: Number.POSITIVE_INFINITY,
        easing: 'ease-in-out',
      })
  let announced = false
  const announce = setTimeout(() => {
    const status = document.getElementById(STATUS_ID)
    if (!status) return
    announced = true
    announcing += 1
    status.textContent = status.dataset.message || 'Working…'
  }, ANNOUNCE_AFTER_MS)

  releases.set(el, () => {
    // Read while the pulse still applies: where it is now.
    const from = Number(getComputedStyle(el).opacity)
    pulse?.cancel()
    el.removeAttribute('aria-busy')
    el.removeAttribute('aria-disabled')
    el.removeEventListener('click', guard, true)
    if (from < 1) {
      el.animate([{ opacity: from }, { opacity: 1 }], {
        duration: 160,
        easing: 'ease-out',
      })
    }
    clearTimeout(announce)
    if (announced) {
      announcing = Math.max(0, announcing - 1)
      const status = document.getElementById(STATUS_ID)
      if (status && announcing === 0) status.textContent = ''
    }
  })
}

const release = (el: Element) => {
  const done = releases.get(el)
  if (!done) return
  releases.delete(el)
  done()
}

attribute({
  name: 'busy',
  requirement: {
    key: 'denied',
    value: 'must',
  },
  returnsValue: true,
  apply({ el, rx }) {
    const cleanup = effect(() => {
      if (rx()) hold(el)
      else release(el)
    })
    return () => {
      cleanup()
      release(el)
    }
  },
})

attribute({
  name: 'busy-rows',
  requirement: {
    key: 'denied',
    value: 'must',
  },
  returnsValue: true,
  apply({ el, rx }) {
    let held = new Set<HTMLElement>()
    const cleanup = effect(() => {
      const busy = (rx() ?? {}) as Record<string, unknown>
      const now = new Set<HTMLElement>()
      for (const [act, row] of Object.entries(busy)) {
        if (typeof row !== 'string' || row === '') continue
        for (const item of el.querySelectorAll<HTMLElement>('[data-row]')) {
          if (item.getAttribute('data-row') !== row) continue
          for (const button of item.querySelectorAll<HTMLElement>('[data-act]')) {
            if (button.getAttribute('data-act') === act) now.add(button)
          }
        }
      }
      for (const button of held) if (!now.has(button)) release(button)
      for (const button of now) hold(button)
      held = now
    })
    return () => {
      cleanup()
      for (const button of held) release(button)
    }
  },
})
