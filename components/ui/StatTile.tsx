import { type BadgeColor } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export function StatTile({
  label,
  value,
  color = "neutral",
}: {
  label: string;
  value: string | number;
  color?: BadgeColor;
}) {
  return (
    <Card color={color} padding="sm">
      <p className="text-small text-neutral-600">{label}</p>
      <p className="mt-1 text-h1 font-semibold text-neutral-950">{value}</p>
    </Card>
  );
}
