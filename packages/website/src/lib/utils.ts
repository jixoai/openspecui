/**
 * jixoai class-merge utility (registry/files/lib/utils.ts).
 * `cn()` is class-string HYGIENE: clsx joins conditionals,
 * tailwind-merge dedupes conflicting utilities inside one string.
 * It is NOT a cascade or specificity mechanism — override behavior
 * comes from the layer law (see the css-architecture spec).
 *
 * hue-injection awareness (2026-08-27, hue-injection-utilities
 * change): the theme's @utility intent layer (jx-hue-* slots,
 * jx-pair-*) is registered as a dedupe group — literal class names,
 * a closed set by design (see the theme sheet) — so later intent
 * classes replace earlier ones exactly like the arbitrary-property
 * form. Cross-form mixing (jx-hue-error + [--jx-tonal:…]) is NOT
 * dedupable: the rule is one form per slot in a class list.
 */
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// the AdditionalClassGroupIds generic (tailwind-merge >= 3.6) keeps
// the closed set type-checked — a future drift in these ids fails
// compilation instead of hiding behind a cast
const twMerge = extendTailwindMerge<'jx-hue' | 'jx-pair'>({
  extend: {
    classGroups: {
      'jx-hue': [
        'jx-hue-primary',
        'jx-hue-neutral',
        'jx-hue-error',
        'jx-hue-success',
        'jx-hue-warning',
        'jx-hue-info',
      ],
      'jx-pair': ['jx-pair-destructive'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
