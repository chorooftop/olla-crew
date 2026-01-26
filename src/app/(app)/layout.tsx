import AuthGuard from "@/components/AuthGuard";
import BottomTab from "@/components/BottomTab";
import TopBar from "@/components/TopBar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20">
        <TopBar />
        <main className="mx-auto w-full max-w-lg px-4 py-6">{children}</main>
        <BottomTab />
      </div>
    </AuthGuard>
  );
}

