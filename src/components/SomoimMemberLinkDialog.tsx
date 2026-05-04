"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Crown,
  Eye,
  EyeOff,
  Link2,
  RefreshCw,
  Search,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { getAuthToken } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SomoimGroupMember } from "@/lib/somoim/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
  onRequestAdd?: (info: { nickname: string; user_id: string }) => void;
};

type DbMember = {
  id: number;
  name: string;
  role: string | null;
  joined_at: string | null;
  external_user_id: string | null;
};

type ApiResponse =
  | {
      ok: true;
      captured_at: string;
      members: SomoimGroupMember[];
    }
  | { ok: false; error: string };

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR");
}

export function SomoimMemberLinkDialog({
  open,
  onOpenChange,
  onUpdated,
  onRequestAdd,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [somoimMembers, setSomoimMembers] = useState<SomoimGroupMember[]>([]);
  const [dbMembers, setDbMembers] = useState<DbMember[]>([]);
  const [step, setStep] = useState<"list" | "pick">("list");
  const [selectedSomoim, setSelectedSomoim] =
    useState<SomoimGroupMember | null>(null);
  const [query, setQuery] = useState("");
  const [pickQuery, setPickQuery] = useState("");
  const [confirming, setConfirming] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showBanned, setShowBanned] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("로그인이 필요합니다.");
      }

      const [apiRes, dbRes] = await Promise.all([
        fetch("/api/somoim/members", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }).then((r) => r.json() as Promise<ApiResponse>),
        supabase
          .from("members")
          .select("id,name,role,joined_at,external_user_id")
          .is("withdrawn_at", null),
      ]);

      if (!apiRes.ok) {
        throw new Error(apiRes.error || "소모임 회원을 불러오지 못했습니다.");
      }

      if (dbRes.error) {
        throw new Error("멤버 목록을 불러오지 못했습니다.");
      }

      setSomoimMembers(apiRes.members);
      setDbMembers((dbRes.data as DbMember[]) ?? []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setError(message);
      setSomoimMembers([]);
      setDbMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setStep("list");
    setSelectedSomoim(null);
    setQuery("");
    setPickQuery("");
    setConfirming(null);
    setShowBanned(false);
    void loadAll();
  }, [open, loadAll]);

  const linkedByUserId = useMemo(() => {
    const map = new Map<string, { id: number; name: string }>();
    for (const m of dbMembers) {
      if (m.external_user_id) {
        map.set(m.external_user_id, { id: m.id, name: m.name });
      }
    }
    return map;
  }, [dbMembers]);

  const sortedSomoim = useMemo(() => {
    return [...somoimMembers].sort((a, b) => {
      const aLinked = linkedByUserId.has(a.user_id) ? 1 : 0;
      const bLinked = linkedByUserId.has(b.user_id) ? 1 : 0;
      if (aLinked !== bLinked) return aLinked - bLinked;
      if (a.is_master !== b.is_master) return a.is_master ? -1 : 1;
      return a.nickname.localeCompare(b.nickname, "ko");
    });
  }, [somoimMembers, linkedByUserId]);

  const bannedCount = useMemo(
    () => somoimMembers.filter((m) => m.banned).length,
    [somoimMembers],
  );

  const filteredSomoim = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const base = showBanned
      ? sortedSomoim
      : sortedSomoim.filter((m) => !m.banned);
    if (!keyword) return base;
    return base.filter((m) => m.nickname.toLowerCase().includes(keyword));
  }, [sortedSomoim, query, showBanned]);

  const unmappedDb = useMemo(() => {
    return dbMembers
      .filter((m) => !m.external_user_id)
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [dbMembers]);

  const filteredDb = useMemo(() => {
    const keyword = pickQuery.trim().toLowerCase();
    if (!keyword) return unmappedDb;
    return unmappedDb.filter((m) => m.name.toLowerCase().includes(keyword));
  }, [unmappedDb, pickQuery]);

  const handleSomoimClick = (m: SomoimGroupMember) => {
    if (linkedByUserId.has(m.user_id)) return;
    setSelectedSomoim(m);
    setPickQuery("");
    setConfirming(null);
    setStep("pick");
  };

  const handleBack = () => {
    setStep("list");
    setSelectedSomoim(null);
    setConfirming(null);
  };

  const handleConfirm = async (memberId: number) => {
    if (!selectedSomoim) return;
    setSaving(true);
    const { error: updateError } = await supabase
      .from("members")
      .update({ external_user_id: selectedSomoim.user_id })
      .eq("id", memberId);
    if (updateError) {
      const isDuplicate = updateError.code === "23505";
      toast.error(
        isDuplicate
          ? "이미 다른 멤버에 연결된 소모임 회원입니다."
          : "연결에 실패했습니다.",
      );
      setSaving(false);
      setConfirming(null);
      void loadAll();
      return;
    }

    setDbMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? { ...m, external_user_id: selectedSomoim.user_id }
          : m,
      ),
    );
    toast.success("연결되었습니다.");
    setSaving(false);
    setConfirming(null);
    setSelectedSomoim(null);
    setStep("list");
    onUpdated?.();
  };

  const linkedCount = linkedByUserId.size;
  const totalSomoim = somoimMembers.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {step === "list" ? (
              "소모임 회원 연결"
            ) : (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 text-base font-semibold hover:underline"
              >
                <ArrowLeft className="size-4" />
                {selectedSomoim?.nickname ?? ""} 연결
              </button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
          <div className="flex flex-col gap-0.5">
            {step === "list" ? (
              <>
                <span className="text-muted-foreground">소모임 회원 풀</span>
                <span className="font-medium">
                  매핑 {linkedCount}/{totalSomoim}명
                </span>
              </>
            ) : (
              <>
                <span className="text-muted-foreground">미매핑 멤버 풀</span>
                <span className="font-medium">{unmappedDb.length}명</span>
              </>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadAll()}
            disabled={loading}
            className="gap-1"
          >
            <RefreshCw
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            />
            새로고침
          </Button>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            {step === "list" ? (
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="소모임 닉네임 검색"
                className="pl-8"
              />
            ) : (
              <Input
                value={pickQuery}
                onChange={(e) => setPickQuery(e.target.value)}
                placeholder="멤버 이름 검색"
                className="pl-8"
              />
            )}
          </div>
          {step === "list" && bannedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowBanned((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/40"
            >
              {showBanned ? (
                <EyeOff className="size-3" />
              ) : (
                <Eye className="size-3" />
              )}
              차단 회원 {showBanned ? "숨기기" : `포함 (${bannedCount})`}
            </button>
          )}
        </div>

        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {loading && (
            <div className="space-y-2 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-lg bg-muted/60"
                />
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p className="whitespace-pre-wrap break-words">{error}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadAll()}
                disabled={loading}
              >
                다시 시도
              </Button>
            </div>
          )}

          {!loading && !error && step === "list" && (
            <SomoimList
              items={filteredSomoim}
              linkedByUserId={linkedByUserId}
              onPick={handleSomoimClick}
              onAdd={
                onRequestAdd
                  ? (m) =>
                      onRequestAdd({
                        nickname: m.nickname,
                        user_id: m.user_id,
                      })
                  : undefined
              }
            />
          )}

          {!loading && !error && step === "pick" && selectedSomoim && (
            <DbList
              items={filteredDb}
              somoimNickname={selectedSomoim.nickname}
              confirming={confirming}
              saving={saving}
              onSelect={(id) => setConfirming(id)}
              onCancel={() => setConfirming(null)}
              onConfirm={handleConfirm}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type SomoimListProps = {
  items: SomoimGroupMember[];
  linkedByUserId: Map<string, { id: number; name: string }>;
  onPick: (m: SomoimGroupMember) => void;
  onAdd?: (m: SomoimGroupMember) => void;
};

function SomoimList({ items, linkedByUserId, onPick, onAdd }: SomoimListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        검색된 소모임 회원이 없습니다.
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {items.map((m) => {
        const linked = linkedByUserId.get(m.user_id);
        const disabled = Boolean(linked);
        return (
          <li
            key={m.user_id}
            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
              disabled
                ? "bg-muted/30 opacity-50"
                : "bg-card hover:bg-accent/40"
            }`}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              {m.is_master && (
                <Crown className="size-3.5 shrink-0 text-amber-500" />
              )}
              <span className="truncate font-medium">
                {m.nickname || "(익명)"}
              </span>
              {m.banned && (
                <Badge
                  variant="destructive"
                  className="h-4 px-1 text-[10px]"
                >
                  차단
                </Badge>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {linked ? (
                <Badge
                  variant="default"
                  className="h-5 gap-1 bg-emerald-600 px-1.5 text-[10px] hover:bg-emerald-600"
                  title={`회원: ${linked.name}`}
                >
                  <CheckCircle2 className="size-3" />
                  {linked.name}
                </Badge>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onPick(m)}
                    className="inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors hover:bg-accent/40"
                  >
                    <Link2 className="size-3" />
                    연결
                  </button>
                  {onAdd && (
                    <button
                      type="button"
                      onClick={() => onAdd(m)}
                      className="inline-flex h-6 items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      <UserPlus className="size-3" />
                      추가
                    </button>
                  )}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type DbListProps = {
  items: DbMember[];
  somoimNickname: string;
  confirming: number | null;
  saving: boolean;
  onSelect: (id: number) => void;
  onCancel: () => void;
  onConfirm: (id: number) => void;
};

function DbList({
  items,
  somoimNickname,
  confirming,
  saving,
  onSelect,
  onCancel,
  onConfirm,
}: DbListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        연결할 미매핑 멤버가 없습니다.
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {items.map((m) => {
        const isConfirming = confirming === m.id;
        return (
          <li
            key={m.id}
            className={`overflow-hidden rounded-lg border ${
              isConfirming ? "border-primary bg-primary/5" : "bg-card"
            }`}
          >
            {!isConfirming ? (
              <button
                type="button"
                onClick={() => onSelect(m.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">{m.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {m.role ?? "MEMBER"} · 가입 {formatDate(m.joined_at)}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="h-5 shrink-0 px-1.5 text-[10px]"
                >
                  선택
                </Badge>
              </button>
            ) : (
              <div className="space-y-2 px-3 py-2.5 text-sm">
                <p>
                  &ldquo;<span className="font-semibold">{m.name}</span>&rdquo;
                  에 소모임 &ldquo;
                  <span className="font-semibold">{somoimNickname}</span>
                  &rdquo; 을 연결할까요?
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onConfirm(m.id)}
                    disabled={saving}
                    className="flex-1"
                  >
                    {saving ? "연결 중..." : "연결"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onCancel}
                    disabled={saving}
                    className="flex-1"
                  >
                    취소
                  </Button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
