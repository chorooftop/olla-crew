import AuthGuard from "@/components/AuthGuard";
import BottomTab from "@/components/BottomTab";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20">
        <main className="mx-auto w-full max-w-lg px-4 py-6">{children}</main>
        <BottomTab />
      </div>
    </AuthGuard>
  );
}

