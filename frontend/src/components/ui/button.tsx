import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

/**
 * The button primitive.
 *
 * Structurally this is shadcn/ui — Radix `Slot` for `asChild`, `cva` for the
 * variants — because that part is well made and accessible. The styling is
 * deliberately not shadcn's. Its defaults ship a fully rounded pill, a ring
 * glow and a hover lift, which are exactly the generic component-kit tells
 * this project avoids.
 *
 * So: square-ish corners, no glow, and nothing travels upward on hover. The
 * solid variant warms toward clay and presses down slightly, which is what a
 * physical control does. Depth comes from an inset hairline rather than from
 * a shadow bloomed on every side.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium cursor-pointer select-none ' +
    'transition-[background-color,color,box-shadow,transform] duration-[420ms] ' +
    'ease-(--ease-spring) disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        /* The single primary action on the page. */
        solid:
          'rounded-[4px] bg-bone text-[#17120d] tracking-[-0.006em] ' +
          'hover:bg-clay active:scale-[0.985] ' +
          'disabled:bg-transparent disabled:text-bone-3 disabled:shadow-[inset_0_0_0_1px_var(--color-hair)]',
        /* Secondary, quiet enough not to compete with the primary. */
        outline:
          'rounded-[3px] text-bone-2 shadow-[inset_0_0_0_1px_var(--color-hair)] ' +
          'hover:text-bone hover:shadow-[inset_0_0_0_1px_var(--color-clay-dim)] ' +
          'aria-pressed:text-bone aria-pressed:shadow-[inset_0_0_0_1px_var(--color-clay-dim)]',
        /* A link in everything but markup: underlined by an inset rule. */
        quiet:
          'rounded-none text-bone-2 shadow-[inset_0_-1px_0_0_var(--color-hair)] hover:text-bone',
      },
      size: {
        md: 'px-6 py-[0.8rem] text-[17px]',
        sm: 'px-[0.7rem] py-[0.3rem] text-[0.8125rem]',
        bare: 'px-0 py-1 text-[0.9375rem]',
      },
    },
    defaultVariants: { variant: 'solid', size: 'md' },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export const Button = ({ className, variant, size, asChild = false, ...props }: ButtonProps) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
};

export { buttonVariants };
