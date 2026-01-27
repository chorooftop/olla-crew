"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clearAuthed, fetchAuthInfo, getAuthToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function TopBar() {
  const router = useRouter();
  const [adminName, setAdminName] = useState<string>("관리자");
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const info = await fetchAuthInfo();
      if (info) {
        setAdminName(info.name ?? "관리자");
      }
    };
    void load();
  }, []);

  const handleChangePassword = async () => {
    const token = getAuthToken();
    if (!token) {
      toast.error("로그인 정보를 확인할 수 없습니다.");
      return;
    }
    if (!currentPassword || !nextPassword) {
      toast.error("현재/새 비밀번호를 입력해 주세요.");
      return;
    }
    if (nextPassword !== confirmPassword) {
      toast.error("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          nextPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        toast.error(data?.message ?? "비밀번호 변경에 실패했습니다.");
        return;
      }
      toast.success("비밀번호가 변경되었습니다.");
      setOpen(false);
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      toast.error("비밀번호 변경 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    clearAuthed();
    toast.success("로그아웃되었습니다.");
    router.replace("/login");
  };

  return (
    <div className="sticky top-0 z-10 border-b bg-muted/60 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-muted/50">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <div className="text-sm">
          <span className="font-medium">{adminName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
              >
                비밀번호 변경
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>비밀번호 변경</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  type="password"
                  placeholder="현재 비밀번호"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
                <Input
                  type="password"
                  placeholder="새 비밀번호"
                  value={nextPassword}
                  onChange={(event) => setNextPassword(event.target.value)}
                />
                <Input
                  type="password"
                  placeholder="새 비밀번호 확인"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <Button
                  className="h-11 w-full"
                  onClick={handleChangePassword}
                  disabled={saving}
                >
                  {saving ? "변경 중..." : "변경하기"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="ghost" onClick={handleLogout}>
            로그아웃
          </Button>
        </div>
      </div>
    </div>
  );
}

