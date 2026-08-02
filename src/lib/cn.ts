export type ClassValue = string | false | null | undefined

export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(' ')
}

/** Color categórico estable por índice (paleta análoga de tokens). */
export function catColor(index: number): string {
  return `var(--color-cat-${(index % 8) + 1})`
}
