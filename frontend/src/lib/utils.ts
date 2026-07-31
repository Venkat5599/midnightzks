import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones.
 *
 * `clsx` handles the conditional syntax; `twMerge` resolves the conflicts —
 * without it, `cn('px-4', 'px-6')` emits both and the winner is decided by
 * stylesheet order rather than by call order.
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
