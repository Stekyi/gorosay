import { TopBar } from "@/components/layout/TopBar";
import { auth } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <TopBar />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </SessionProvider>
  );
}
