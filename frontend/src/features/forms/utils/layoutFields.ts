import type { FormField } from '../types'

/**
 * Groups consecutive half-width fields into pairs so they can be rendered
 * side-by-side. Full-width fields (and unpaired halves) stay as single items.
 *
 * Returns an array of rows:
 *  - { kind: 'full',  field }
 *  - { kind: 'half',  fields: [a, b] }   ← always exactly 2
 *  - { kind: 'half',  fields: [a] }      ← trailing unpaired half
 */
export type FieldRow =
  | { kind: 'full'; field: FormField }
  | { kind: 'half'; fields: FormField[] }

export function layoutFields(fields: FormField[]): FieldRow[] {
  const rows: FieldRow[] = []
  let i = 0
  while (i < fields.length) {
    const f = fields[i]
    if (f.width === 'half') {
      const pair: FormField[] = [f]
      if (i + 1 < fields.length && fields[i + 1].width === 'half') {
        pair.push(fields[i + 1])
        i += 2
      } else {
        i += 1
      }
      rows.push({ kind: 'half', fields: pair })
    } else {
      rows.push({ kind: 'full', field: f })
      i += 1
    }
  }
  return rows
}
