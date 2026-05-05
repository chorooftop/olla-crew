"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Crown,
  RefreshCw,
  Users,
  Calendar as CalendarIcon,
  AlertCircle,
  CheckCircle2,
  UserPlus,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";

import { getAuthToken } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  onUpdated?: () => void;
  adminMemberId?: number | null;
};

type MemberMatch = { id: number; name: string };
type MemberMatches = Map<string, MemberMatch>;
type ScheduleMatches = Set<string>;

function formatStartAt(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "yyyy-MM-dd (EEE) HH:mm", { locale: ko });
}

function formatRsvpAt(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "MM-dd HH:mm", { locale: ko });
}

function formatCapturedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "yyyy-MM-dd HH:mm", { locale: ko });
}

function buildMemberRegisterUrl(nickname: string, userId: string): string {
  const params = new URLSearchParams({
    prefill_name: nickname,
    prefill_external_user_id: userId,
  });
  return `/members?${params.toString()}`;
}

export function SomoimImportDialog({
  open,
  onOpenChange,
  onUpdated,
  adminMemberId,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SomoimSnapshot | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [memberMatches, setMemberMatches] = useState<MemberMatches>(new Map());
  const [scheduleMatches, setScheduleMatches] = useState<ScheduleMatches>(
    new Set(),
  );
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [dateFilter, setDateFilter] = useState<"7d" | "30d" | "all">("7d");
  const [onlyUnregistered, setOnlyUnregistered] = useState(false);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("로그인이 필요합니다.");
      }

      const [snapshotResult, membersResult, schedulesResult] =
        await Promise.all([
          fetch("/api/somoim/events", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }).then(
            (response) =>
              response.json() as Promise<
                | { ok: true; snapshot: SomoimSnapshot }
                | { ok: false; error: string }
              >,
          ),
          supabase
            .from("members")
            .select("id,name,external_user_id")
            .is("withdrawn_at", null)
            .not("external_user_id", "is", null),
          supabase
            .from("schedules")
            .select("external_event_id")
            .not("external_event_id", "is", null),
        ]);

      if (!snapshotResult.ok) {
        throw new Error(
          "error" in snapshotResult
            ? snapshotResult.error
            : "데이터를 가져오지 못했습니다.",
        );
      }

      const memberMap: MemberMatches = new Map();
      const memberRows =
        (membersResult.data as
          | { id: number; name: string; external_user_id: string | null }[]
          | null) ?? [];
      memberRows.forEach((row) => {
        if (row.external_user_id) {
          memberMap.set(row.external_user_id, {
            id: row.id,
            name: row.name,
          });
        }
      });

      const scheduleSet: ScheduleMatches = new Set();
      const scheduleRows =
        (schedulesResult.data as
          | { external_event_id: string | null }[]
          | null) ?? [];
      scheduleRows.forEach((row) => {
        if (row.external_event_id) scheduleSet.add(row.external_event_id);
      });

      setSnapshot(snapshotResult.snapshot);
      setMemberMatches(memberMap);
      setScheduleMatches(scheduleSet);
      setExpanded(new Set());
      setSelectedEvents(new Set());
      setDateFilter("7d");
      setOnlyUnregistered(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setError(message);
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadSnapshot();
  }, [open, loadSnapshot]);

  const toggleExpanded = (eventId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const toggleSelected = (eventId: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const handleBulkCreate = async () => {
    if (!snapshot) return;
    const eligible = snapshot.events.filter(
      (event) =>
        selectedEvents.has(event.event_id) &&
        !scheduleMatches.has(event.event_id) &&
        Boolean(event.start_at),
    );
    if (eligible.length === 0) {
      toast.error("생성할 일정이 없습니다.");
      return;
    }
    setCreating(true);
    const payload = eligible.map((event) => ({
      title: event.title?.trim() || "(제목 없음)",
      type: "REGULAR",
      scheduled_at: event.start_at,
      city: null,
      location: null,
      memo: event.description?.trim() || null,
      created_by: adminMemberId ?? null,
      external_event_id: event.event_id,
    }));
    const { data: insertedRows, error: insertError } = await supabase
      .from("schedules")
      .insert(payload)
      .select("id,external_event_id");
    if (insertError || !insertedRows) {
      toast.error("일정 생성에 실패했습니다.");
      setCreating(false);
      return;
    }

    const inserted =
      (insertedRows as { id: number; external_event_id: string | null }[]) ??
      [];
    const scheduleByEventId = new Map<string, number>();
    for (const row of inserted) {
      if (row.external_event_id) {
        scheduleByEventId.set(row.external_event_id, row.id);
      }
    }

    let attendanceCount = 0;
    if (adminMemberId) {
      const checkedBy = adminMemberId;
      const attendancePayload = eligible.flatMap((event) => {
        const scheduleId = scheduleByEventId.get(event.event_id);
        if (!scheduleId) return [];
        return event.participants
          .map((participant) => memberMatches.get(participant.user_id))
          .filter((match): match is MemberMatch => Boolean(match))
          .map((match) => ({
            member_id: match.id,
            checked_by: checkedBy,
            schedule_id: scheduleId,
            memo: null as string | null,
          }));
      });
      if (attendancePayload.length > 0) {
        const { error: attendanceError } = await supabase
          .from("attendance_logs")
          .insert(attendancePayload);
        if (attendanceError) {
          toast.warning(
            `${inserted.length}개 일정은 생성됐지만 출석 처리에 실패했습니다.`,
          );
          setCreating(false);
          onUpdated?.();
          await loadSnapshot();
          return;
        }
        attendanceCount = attendancePayload.length;
      }
    }

    if (attendanceCount > 0) {
      toast.success(
        `${inserted.length}개 일정 · ${attendanceCount}명 출석 처리 완료`,
      );
    } else {
      toast.success(`${inserted.length}개 일정이 생성되었습니다.`);
    }
    setCreating(false);
    onUpdated?.();
    await loadSnapshot();
  };

  const sortedEvents = useMemo(() => {
    if (!snapshot?.events) return [];
    return [...snapshot.events].sort((a, b) => {
      const ta = a.start_at ? new Date(a.start_at).getTime() : 0;
      const tb = b.start_at ? new Date(b.start_at).getTime() : 0;
      return tb - ta;
    });
  }, [snapshot]);

  const plannedAttendanceCount = useMemo(() => {
    if (!snapshot) return 0;
    let count = 0;
    for (const event of snapshot.events) {
      if (!selectedEvents.has(event.event_id)) continue;
      if (scheduleMatches.has(event.event_id)) continue;
      if (!event.start_at) continue;
      for (const participant of event.participants) {
        if (memberMatches.has(participant.user_id)) count += 1;
      }
    }
    return count;
  }, [snapshot, selectedEvents, scheduleMatches, memberMatches]);

  const filteredEvents = useMemo(() => {
    let base = sortedEvents;
    if (onlyUnregistered) {
      base = base.filter((event) => !scheduleMatches.has(event.event_id));
    }
    if (dateFilter === "all") return base;
    const days = dateFilter === "7d" ? 7 : 30;
    const windowMs = days * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return base.filter((event) => {
      if (!event.start_at) return false;
      const time = new Date(event.start_at).getTime();
      if (Number.isNaN(time)) return false;
      return Math.abs(time - now) <= windowMs;
    });
  }, [sortedEvents, dateFilter, onlyUnregistered, scheduleMatches]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle>소모임 데이터 가져오기</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
          {snapshot ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">
                수집: {formatCapturedAt(snapshot.captured_at)}
              </span>
              <span className="font-medium">
                일정 {snapshot.stats.event_count}개 · 참석{" "}
                {snapshot.stats.total_participants}명
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">
              {loading ? "데이터를 가져오는 중..." : "데이터가 없습니다."}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadSnapshot()}
            disabled={loading}
            className="gap-1"
          >
            <RefreshCw
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            />
            새로고침
          </Button>
        </div>

        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {loading && !snapshot && (
            <div className="space-y-2 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg bg-muted/60"
                />
              ))}
            </div>
          )}

          {error && (
            <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p className="whitespace-pre-wrap break-words">{error}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadSnapshot()}
                disabled={loading}
              >
                다시 시도
              </Button>
            </div>
          )}

          {!loading && !error && snapshot && sortedEvents.length === 0 && (
            <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              가져올 일정이 없습니다.
            </div>
          )}

          {!error && sortedEvents.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1 text-xs">
              <span className="text-muted-foreground">기간:</span>
              {(
                [
                  { value: "7d" as const, label: "1주" },
                  { value: "30d" as const, label: "1달" },
                  { value: "all" as const, label: "전체" },
                ]
              ).map((option) => {
                const active = dateFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDateFilter(option.value)}
                    className={`rounded-md border px-2.5 py-1 transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-accent/40"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
              <span className="mx-1 h-3 w-px bg-border" aria-hidden />
              <button
                type="button"
                onClick={() => setOnlyUnregistered((prev) => !prev)}
                aria-pressed={onlyUnregistered}
                className={`rounded-md border px-2.5 py-1 transition-colors ${
                  onlyUnregistered
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-accent/40"
                }`}
              >
                미등록만
              </button>
              <span className="ml-auto text-muted-foreground">
                {filteredEvents.length}/{sortedEvents.length}
              </span>
            </div>
          )}

          {!error && sortedEvents.length > 0 && filteredEvents.length === 0 && (
            <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              해당 기간 내 일정이 없습니다. 기간 필터를 넓혀 보세요.
            </div>
          )}

          {!error && filteredEvents.length > 0 && (
            <ul className="space-y-2">
              {filteredEvents.map((event) => {
                const matched = scheduleMatches.has(event.event_id);
                const selectable = !matched && Boolean(event.start_at);
                return (
                  <EventCard
                    key={event.event_id}
                    event={event}
                    expanded={expanded.has(event.event_id)}
                    onToggle={() => toggleExpanded(event.event_id)}
                    scheduleMatched={matched}
                    memberMatches={memberMatches}
                    selectable={selectable}
                    selected={selectedEvents.has(event.event_id)}
                    onToggleSelect={() => toggleSelected(event.event_id)}
                  />
                );
              })}
            </ul>
          )}
        </div>

        {sortedEvents.length > 0 && !error && (
          <div className="flex flex-col items-start gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              선택 {selectedEvents.size}개 · 출석 예정{" "}
              {plannedAttendanceCount}명
            </span>
            <Button
              type="button"
              onClick={() => void handleBulkCreate()}
              disabled={creating || selectedEvents.size === 0}
              className="gap-1"
            >
              {creating
                ? "처리 중..."
                : `${selectedEvents.size}개 생성 & 출석처리`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type EventCardProps = {
  event: SomoimEvent;
  expanded: boolean;
  onToggle: () => void;
  scheduleMatched: boolean;
  memberMatches: MemberMatches;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
};

function EventCard({
  event,
  expanded,
  onToggle,
  scheduleMatched,
  memberMatches,
  selectable,
  selected,
  onToggleSelect,
}: EventCardProps) {
  const sortedParticipants = [...event.participants].sort((a, b) => {
    if (a.is_master !== b.is_master) return a.is_master ? -1 : 1;
    const ta = a.rsvp_created ? new Date(a.rsvp_created).getTime() : 0;
    const tb = b.rsvp_created ? new Date(b.rsvp_created).getTime() : 0;
    return ta - tb;
  });

  const matchedCount = event.participants.reduce(
    (n, p) => (p.user_id && memberMatches.has(p.user_id) ? n + 1 : n),
    0,
  );

  return (
    <li
      className={`overflow-hidden rounded-lg border bg-card ${
        selected ? "ring-2 ring-primary/40" : ""
      }`}
    >
      <div className="flex items-start">
        <label
          className={`flex items-center self-stretch pl-3 pr-1 ${
            selectable ? "cursor-pointer" : "cursor-not-allowed"
          }`}
          title={
            selectable
              ? selected
                ? "선택 해제"
                : "선택"
              : scheduleMatched
                ? "이미 등록된 일정"
                : "시간 정보 없음"
          }
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            disabled={!selectable}
            aria-label={`${event.title || "일정"} 선택`}
            className="size-4 rounded border-muted-foreground/40 accent-primary disabled:opacity-40"
          />
        </label>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex flex-1 items-start gap-3 p-3 pl-1 text-left transition-colors hover:bg-accent/40"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{event.title || "제목 없음"}</span>
            {scheduleMatched ? (
              <Badge
                variant="default"
                className="h-5 gap-1 bg-emerald-600 px-1.5 text-[10px] hover:bg-emerald-600"
              >
                <CheckCircle2 className="size-3" />
                등록됨
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="h-5 px-1.5 text-[10px] text-muted-foreground"
              >
                미등록
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="size-3" />
              {formatStartAt(event.start_at)}
            </span>
            <span>·</span>
            <span>주최: {event.host_nickname || "-"}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Users className="size-3" />
            {matchedCount}/{event.participant_count}
          </Badge>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t bg-muted/20 px-3 py-3 text-sm">
          {!scheduleMatched && (
            <div className="rounded-md border border-dashed bg-background px-2.5 py-2 text-xs text-muted-foreground">
              아직 우리 사이트의 일정과 매칭되지 않았습니다. 일정 추가/수정에서
              아래 ID를 붙여넣으세요.
              <div className="mt-1 break-all rounded bg-muted px-2 py-1 font-mono text-[10px]">
                {event.event_id}
              </div>
            </div>
          )}

          {event.description && (
            <div className="rounded-md bg-background px-3 py-2 text-xs whitespace-pre-wrap break-words leading-relaxed">
              {event.description}
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              참석자 ({event.participant_count}명) · 회원 매칭 {matchedCount}명
            </div>
            {sortedParticipants.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                참석자가 없습니다.
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-1.5">
                {sortedParticipants.map((p) => {
                  const matched = p.user_id
                    ? memberMatches.get(p.user_id)
                    : undefined;
                  return (
                    <li
                      key={p.user_id || p.nickname}
                      className="flex items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        {p.is_master && (
                          <Crown className="size-3 shrink-0 text-amber-500" />
                        )}
                        <span className="truncate font-medium">
                          {p.nickname || "(익명)"}
                        </span>
                        {p.banned && (
                          <Badge
                            variant="destructive"
                            className="h-4 px-1 text-[10px]"
                          >
                            차단
                          </Badge>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-muted-foreground">
                          {formatRsvpAt(p.rsvp_created)}
                        </span>
                        {matched ? (
                          <Badge
                            variant="default"
                            className="h-5 gap-1 bg-emerald-600 px-1.5 text-[10px] hover:bg-emerald-600"
                            title={`회원: ${matched.name}`}
                          >
                            <CheckCircle2 className="size-3" />
                            {matched.name}
                          </Badge>
                        ) : (
                          <a
                            href={buildMemberRegisterUrl(
                              p.nickname,
                              p.user_id,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Badge
                              variant="outline"
                              className="h-5 cursor-pointer gap-1 px-1.5 text-[10px] hover:bg-accent"
                            >
                              <UserPlus className="size-3" />
                              등록
                            </Badge>
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
