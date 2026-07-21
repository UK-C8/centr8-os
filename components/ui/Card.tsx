import Link from "next/link";
import { cardAccentClass, type BadgeColor } from "@/components/ui/Badge";

// DESIGN_SYSTEM.md §5: neutral-50 background, neutral-300 border (or
// shadow-sm), radius-md. Was being hand-typed identically at every call
// site (Dashboard, Projects, Sprints, Health, AI draft, login) — Prompt
// 0.6's checkpoint flagged that as "consistent by discipline, not by
// construction." These three cover every shape a card took across the app:
// static (Card), a whole card that navigates (CardLink), a whole card that
// runs a click handler (CardButton, e.g. "open this sprint's board").
const BASE = "rounded-md border border-neutral-300 bg-neutral-50 shadow-sm";
const PADDING = { sm: "p-4", md: "p-6" } as const;
const INTERACTIVE = "text-left transition-shadow hover:shadow-md";

type CardProps = {
  color?: BadgeColor;
  padding?: keyof typeof PADDING;
  className?: string;
  children: React.ReactNode;
};

export function Card({ color, padding = "md", className = "", children }: CardProps) {
  return (
    <div className={`${BASE} ${PADDING[padding]} ${color ? cardAccentClass(color) : ""} ${className}`}>
      {children}
    </div>
  );
}

export function CardLink({ href, color, padding = "md", className = "", children }: CardProps & { href: string }) {
  return (
    <Link
      href={href}
      className={`block ${BASE} ${PADDING[padding]} ${INTERACTIVE} ${color ? cardAccentClass(color) : ""} ${className}`}
    >
      {children}
    </Link>
  );
}

export function CardButton({
  onClick,
  color,
  padding = "md",
  className = "",
  children,
}: CardProps & { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full ${BASE} ${PADDING[padding]} ${INTERACTIVE} ${color ? cardAccentClass(color) : ""} ${className}`}
    >
      {children}
    </button>
  );
}
