"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchAuthInfo, getAuthToken } from "@/lib/auth";

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = getAuthToken();
      if (!token) {
        router.replace("/login");
        return;
      }
      const info = await fetchAuthInfo();
      if (!info) {
        router.replace("/login");
        return;
      }
      setReady(true);
    };
    void checkAuth();
  }, [router, pathname]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        로그인 확인 중...
      </div>
    );
  }

  return <>{children}</>;
}

