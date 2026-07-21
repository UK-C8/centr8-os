import { Card } from "@/components/ui/Card";
import { type BadgeColor } from "@/components/ui/Badge";

const ICON_BG: Record<BadgeColor, string> = {
  neutral: "bg-neutral-200 text-neutral-700",
  info: "bg-info-100 text-info-600",
  warning: "bg-warning-100 text-warning-600",
  danger: "bg-danger-100 text-danger-600",
  success: "bg-success-100 text-success-600",
  ai: "bg-ai-100 text-ai-600",
};

// Reference (iodash template) pairs each stat with a mini sparkline trend
// line — dropped here since there's no time-series data behind it (no
// historical snapshots table) and a fabricated trend would misrepresent
// real numbers, same rule this app applies to AI-generated content.
export function StatCard({
  icon,
  value,
  label,
  color = "primary",
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color?: BadgeColor | "primary";
}) {
  return (
    <Card padding="sm" className="flex items-center gap-4">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${
          color === "primary" ? "bg-primary-100 text-primary-700" : ICON_BG[color]
        }`}
      >
        {icon}
      </div>
      <div>
        <p className="text-h2 font-semibold text-neutral-950">{value}</p>
        <p className="text-small text-neutral-600">{label}</p>
      </div>
    </Card>
  );
}
