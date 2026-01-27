"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { setAuthInfo, setAuthToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ollaIcon from "@/app/olla-icon.jpeg";

export default function LoginPage() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!id || !password) {
      toast.error("아이디와 비밀번호를 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        toast.error(data?.message ?? "로그인에 실패했습니다.");
        return;
      }

      setAuthToken(data.token);
      setAuthInfo({
        adminUserId: data.adminUser.adminUserId,
        loginId: data.adminUser.loginId,
        memberId: data.adminUser.memberId,
        role: data.adminUser.role,
        name: data.adminUser.name ?? null,
      });
      setTransitioning(true);
      setTimeout(() => {
        router.replace("/attendance");
      }, 600);
    } catch (error) {
      console.error(error);
      toast.error("로그인 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      {transitioning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/95 backdrop-blur">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/10 to-transparent" />
          <div className="absolute -left-24 top-10 h-72 w-72 animate-pulse rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -right-24 bottom-10 h-72 w-72 animate-pulse rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex flex-col items-center gap-4 text-white">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              <div className="absolute inset-0 rounded-full border border-white/10" />
            </div>
            <div className="flex items-center gap-2 text-sm font-medium tracking-wide text-white/80">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/80" />
              로그인 중...
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/80" />
            </div>
          </div>
        </div>
      )}
      <Card className="w-full max-w-sm overflow-hidden border bg-background/80 shadow-xl">
        <CardHeader className="space-y-3 pb-4">
          <div className="relative flex justify-center">
            <div className="absolute -top-10 h-24 w-24 rounded-full bg-primary/15 blur-2xl" />
            <Image
              src={ollaIcon}
              alt="Olla Crew"
              width={200}
              height={200}
              className="rounded-2xl border shadow-md"
              priority
            />
          </div>
          <div className="text-center">
            <div className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
              OLLA CREW
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="login-id">
                아이디
              </label>
              <Input
                id="login-id"
                value={id}
                onChange={(event) => setId(event.target.value)}
                placeholder="아이디 입력"
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="login-password">
                비밀번호
              </label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="비밀번호 입력"
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              className="h-12 w-full text-base"
              disabled={submitting}
            >
              {submitting ? "로그인 중..." : "로그인"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
