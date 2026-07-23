import * as React from "react";
import Link, { type LinkProps } from "next/link";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// shadcn architecture (cva + Radix Slot) restyled against DESIGN_SYSTEM.md
// §5 tokens instead of shadcn's default oklch palette: primary =
// primary-600 bg / neutral-50 text, hover primary-700. Secondary =
// neutral-50 bg, neutral-300 border, neutral-950 text. Focus = primary-600
// 2px outline, never the browser default. "danger" isn't in §5's component
// conventions (only primary/secondary are defined there) — added for
// reject/delete-style actions using §2's danger-600 semantic token, since
// inventing an ad hoc red would violate §6's "never freehand colors." No
// danger-700 hover shade is defined anywhere in the doc, so hover uses
// opacity on danger-600 rather than guessing a darker hex.
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-sm px-4 py-2 text-body-medium font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary: "bg-primary-600 text-neutral-50 hover:bg-primary-700 disabled:bg-primary-100 disabled:text-neutral-400",
        secondary:
          "bg-neutral-50 border border-neutral-300 text-neutral-950 hover:bg-neutral-100 disabled:text-neutral-400",
        danger: "bg-danger-600 text-neutral-50 hover:bg-danger-600/90 disabled:bg-danger-100 disabled:text-neutral-400",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

type ButtonAsButton = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { href?: undefined; asChild?: boolean };
// Navigation actions ("View all", "Back") were rendering as bare underlined
// text — inconsistent with every other action in the app being a real
// button. Rather than duplicate the button styling at each call site, Button
// renders as a Next.js Link when given `href`, same classes either way.
type ButtonAsLink = Omit<LinkProps, "className"> &
  VariantProps<typeof buttonVariants> & { className?: string; children?: React.ReactNode };

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant, className, ...rest } = props;
  const classes = cn(buttonVariants({ variant }), className);

  if ("href" in rest && rest.href !== undefined) {
    const { href, ...linkRest } = rest as Omit<ButtonAsLink, "variant" | "className">;
    return (
      <Link href={href} className={classes} {...linkRest}>
        {props.children}
      </Link>
    );
  }

  const { asChild, ...buttonRest } = rest as Omit<ButtonAsButton, "variant" | "className">;
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={classes} {...buttonRest} />;
}
