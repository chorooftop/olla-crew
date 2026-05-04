"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Crown,
  Link2Off,
  RefreshCw,
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
import type { SomoimEvent, SomoimSnapshot } from "@/lib/somoim/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId: number | null;
  scheduleTitle: string;
  externalEventId: string | null;
  adminMemberId: number | null;
  alreadyAttendedMemberIds: Set<number>;
  onAttended?: () => void;
};

type Candidate = {
  user_id: string;
  nickname: string;
  is_master: boolean;
  banned: boolean;
  member_id: number | null;
  member_name: string | null;
  already_attended: boolean;
};

type SnapshotResponse =
  | { ok: true; snapshot: SomoimSnapshot }
  | { ok: false; error: string };

export function AutoAttendanceDialog({
  open,
  onOpenChange,
  scheduleId,
  scheduleTitle,
  externalEventId,
  adminMemberId,
  alreadyAttendedMemberIds,
  onAttended,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const loadCandidates = useCallback(async () => {
    if (!externalEventId) {
      setError("이 일정에 소모임 일정 ID(external_event_id)가 없습니다.");
      setCandidates([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("로그인이 필요합니다.");
      }

      const [snapshotRes, dbRes] = await Promise.all([
        fetch("/api/somoim/events", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }).then((r) => r.json() as Promise<SnapshotResponse>),
        supabase
          .from("members")
          .select("id,name,external_user_id")
          .is("withdrawn_at", null)
          .not("external_user_id", "is", null),
      ]);

      if (!snapshotRes.ok) {
        throw new Error(
          snapshotRes.error || "소모임 데이터를 가져오지 못했습니다.",
        );
      }
      if (dbRes.error) {
        throw new Error("멤버 정보를 불러오지 못했습니다.");
      }

      const event: SomoimEvent | undefined = snapshotRes.snapshot.events.find(
        (e) => e.event_id === externalEventId,
      );
      if (!event) {
        throw new Error(
          "소모임에서 해당 일정을 찾을 수 없습니다. external_event_id를 확인해 주세요.",
        );
      }

      const memberByUserId = new Map<
        string,
        { id: number; name: string }
      >();
      const dbRows =
        (dbRes.data as
          | { id: number; name: string; external_user_id: string | null }[]
          | null) ?? [];
      for (const row of dbRows) {
        if (row.external_user_id) {
          memberByUserId.set(row.external_user_id, {
            id: row.id,
            name: row.name,
          });
        }
      }

      const next: Candidate[] = event.participants.map((p) => {
        const matched = memberByUserId.get(p.user_id);
        return {
          user_id: p.user_id,
          nickname: p.nickname,
          is_master: p.is_master,
          banned: p.banned,
          member_id: matched?.id ?? null,
          member_name: matched?.name ?? null,
          already_attended: matched
            ? alreadyAttendedMemberIds.has(matched.id)
            : false,
        };
      });

      setCandidates(next);
      const defaults = new Set<number>();
      for (const c of next) {
        if (c.member_id && !c.already_attended) {
          defaults.add(c.member_id);
        }
      }
      setSelected(defaults);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setError(message);
      setCandidates([]);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }, [externalEventId, alreadyAttendedMemberIds]);

  useEffect(() => {
    if (!open) return;
    void loadCandidates();
  }, [open, loadCandidates]);

  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => {
      if (a.is_master !== b.is_master) return a.is_master ? -1 : 1;
      const aSelectable = Boolean(a.member_id && !a.already_attended);
      const bSelectable = Boolean(b.member_id && !b.already_attended);
      if (aSelectable !== bSelectable) return aSelectable ? -1 : 1;
      return a.nickname.localeCompare(b.nickname, "ko");
    });
  }, [candidates]);

  const selectableMemberIds = useMemo(() => {
    const set = new Set<number>();
    for (const c of candidates) {
      if (c.member_id && !c.already_attended) set.add(c.member_id);
    }
    return set;
  }, [candidates]);

  const allSelected =
    selectableMemberIds.size > 0 &&
    selectableMemberIds.size === selected.size &&
    [...selectableMemberIds].every((id) => selected.has(id));

  const toggle = (memberId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableMemberIds));
    }
  };

  const handleConfirm = async () => {
    if (!scheduleId) {
      toast.error("일정 정보가 없습니다.");
      return;
    }
    if (!adminMemberId) {
      toast.error("로그인 정보를 확인할 수 없습니다.");
      return;
    }
    if (selected.size === 0) {
      toast.error("출석 처리할 멤버를 선택해 주세요.");
      return;
    }
    setSaving(true);
    const targets = [...selected].filter(
      (id) => !alreadyAttendedMemberIds.has(id),
    );
    if (targets.length === 0) {
      toast.error("이미 모두 출석 처리된 멤버입니다.");
      setSaving(false);
      return;
    }
    const payload = targets.map((memberId) => ({
      member_id: memberId,
      checked_by: adminMemberId,
      schedule_id: scheduleId,
      memo: null,
    }));
    const { error: insertError } = await supabase
      .from("attendance_logs")
      .insert(payload);
    if (insertError) {
      toast.error("출석 처리에 실패했습니다.");
      setSaving(false);
      return;
    }
    toast.success(`${targets.length}명 출석 처리 완료!`);
    setSaving(false);
    onAttended?.();
    onOpenChange(false);
  };

  const totalParticipants = candidates.length;
  const matchedCount = candidates.filter((c) => c.member_id).length;
  const alreadyCount = candidates.filter((c) => c.already_attended).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle>{scheduleTitle} 자동 출석처리</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">소모임 참석자</span>
            <span className="font-medium">
              매칭 {matchedCount}/{totalParticipants}명 · 이미 출석{" "}
              {alreadyCount}명
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadCandidates()}
            disabled={loading}
            className="gap-1"
          >
            <RefreshCw
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            />
            새로고침
          </Button>
        </div>

        {!loading && !error && selectableMemberIds.size > 0 && (
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={toggleAll}
              className="rounded-md border bg-background px-2.5 py-1 text-muted-foreground transition-colors hover:bg-accent/40"
            >
              {allSelected ? "전체 해제" : "전체 선택"}
            </button>
            <span className="text-muted-foreground">
              선택 {selected.size}명
            </span>
          </div>
        )}

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
                onClick={() => void loadCandidates()}
                disabled={loading}
              >
                다시 시도
              </Button>
            </div>
          )}

          {!loading && !error && candidates.length === 0 && (
            <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              참석자가 없습니다.
            </div>
          )}

          {!loading && !error && sortedCandidates.length > 0 && (
            <ul className="space-y-1.5">
              {sortedCandidates.map((c) => {
                const selectable = Boolean(c.member_id && !c.already_attended);
                const isSelected = c.member_id
                  ? selected.has(c.member_id)
                  : false;
                return (
                  <li
                    key={c.user_id}
                    className={`overflow-hidden rounded-lg border ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : selectable
                          ? "bg-card"
                          : "bg-muted/30"
                    }`}
                  >
                    <label
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-sm ${
                        selectable ? "cursor-pointer" : "cursor-not-allowed"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => c.member_id && toggle(c.member_id)}
                          disabled={!selectable}
                          className="size-4 shrink-0 rounded border-muted-foreground/40 accent-primary disabled:opacity-40"
                        />
                        {c.is_master && (
                          <Crown className="size-3.5 shrink-0 text-amber-500" />
                        )}
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">
                            {c.nickname || "(익명)"}
                          </span>
                          {c.member_name && (
                            <span className="truncate text-[11px] text-muted-foreground">
                              회원: {c.member_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {c.banned && (
                          <Badge
                            variant="destructive"
                            className="h-4 px-1 text-[10px]"
                          >
                            차단
                          </Badge>
                        )}
                        {c.already_attended ? (
                          <Badge
                            variant="default"
                            className="h-5 gap-1 bg-emerald-600 px-1.5 text-[10px] hover:bg-emerald-600"
                          >
                            <CheckCircle2 className="size-3" />
                            출석됨
                          </Badge>
                        ) : !c.member_id ? (
                          <Badge
                            variant="outline"
                            className="h-5 gap-1 px-1.5 text-[10px] text-muted-foreground"
                          >
                            <Link2Off className="size-3" />
                            매핑 필요
                          </Badge>
                        ) : null}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">
            {selected.size > 0
              ? `${selected.size}명 선택됨`
              : "출석 처리할 멤버를 선택하세요"}
          </span>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={saving || loading || selected.size === 0}
          >
            {saving ? "처리 중..." : `${selected.size}명 출석하기`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
