import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = { title: { default: "Panel", template: "%s · Panel Barber Suites" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  return (
    <div className="min-h-dvh">
      <AdminNav email={user.email ?? ""} />
      <main className="px-4 pt-6 pb-28 sm:px-6 lg:ml-60 lg:px-10 lg:pt-10 lg:pb-12">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
