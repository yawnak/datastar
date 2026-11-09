// Icon: material-symbols:rule
// Slug: A field's own words for one of the browser's checks.
// Description: When the field fails the named check, the browser shows this message instead of its own.

// `data-validity:pattern="Use at least one letter or digit."`: when the
// field fails that check, the browser says this instead of its own words
// ("Match the requested format"). The value is the message as written, not
// an expression: the server renders it, in the page's language.
//
// Checks, as their attributes name them:
//
// - `required` (valueMissing), `type` (typeMismatch), `pattern`
//   (patternMismatch), `min` (tooShort, rangeUnderflow), `max` (tooLong,
//   rangeOverflow), `step` (stepMismatch).
//
// The browser still decides what passes; only the words change. Its own
// words are fine where they're clear ("Fill out this field"), so give a
// message only where they aren't.

import { attribute } from '@engine'

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

const checks: Record<string, (keyof ValidityState)[]> = {
  required: ['valueMissing'],
  type: ['typeMismatch'],
  pattern: ['patternMismatch'],
  min: ['tooShort', 'rangeUnderflow'],
  max: ['tooLong', 'rangeOverflow'],
  step: ['stepMismatch'],
}

attribute({
  name: 'validity',
  requirement: {
    key: 'must',
    value: 'must',
  },
  apply({ el, key, value, error }) {
    const failed = checks[key]
    if (!failed) throw error('ValidityCheckUnknown', { key })
    if (!('setCustomValidity' in el)) return
    const field = el as Control

    // A failed check shows this message; a passed one takes it back, if
    // it's still this one (another check's message stays).
    const check = () => {
      if (failed.some((flag) => field.validity[flag])) {
        field.setCustomValidity(value)
      } else if (field.validationMessage === value) {
        field.setCustomValidity('')
      }
    }
    check()
    field.addEventListener('input', check)
    field.addEventListener('change', check)
    return () => {
      field.removeEventListener('input', check)
      field.removeEventListener('change', check)
      if (field.validationMessage === value) field.setCustomValidity('')
    }
  },
})
