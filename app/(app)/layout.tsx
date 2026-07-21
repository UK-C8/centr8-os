import { OrgProvider } from "@/lib/context/OrgContext";
import { AppShell } from "@/components/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrgProvider>
      <AppShell>{children}</AppShell>
    </OrgProvider>
  );
}
