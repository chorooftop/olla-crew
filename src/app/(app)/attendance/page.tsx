"use client";

import { useEffect, useMemo, useState } from "react";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { fetchAuthInfo } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AutoAttendanceDialog } from "@/components/AutoAttendanceDialog";

type Member = {
  id: number;
  name: string;
  withdrawn_at: string | null;
};

type SelectedMember = Pick<Member, "id" | "name">;

type Schedule = {
  id: number;
  title: string;
  type: string | null;
  scheduled_at: string;
  location: string | null;
  external_event_id: string | null;
};

type AttendanceLog = {
  id: number;
  member_id: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  REGULAR: "정모",
  FLASH: "벙",
};

function formatScheduleLabel(schedule: Schedule) {
  const date = new Date(schedule.scheduled_at);
  const dateLabel = Number.isNaN(date.getTime())
    ? `${schedule.scheduled_at}`
    : `(${date.toLocaleString("ko-KR", { weekday: "short" })}) ${date.toLocaleString(
        "ko-KR",
        {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        },
      )}`;
  return `${schedule.title} / ${dateLabel}`;
}

export default function AttendancePage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(
    null,
  );
  const [open, setOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<SelectedMember | null>(
    null,
  );
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [adminName, setAdminName] = useState<string>("관리자");
  const [adminMemberId, setAdminMemberId] = useState<number | null>(null);
  const [attendanceMap, setAttendanceMap] = useState<Record<number, number>>(
    {},
  );
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceList, setAttendanceList] = useState<
    { id: number; member: { id: number; name: string } | null }[]
  >([]);
  const [autoOpen, setAutoOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const info = await fetchAuthInfo();
      if (info) {
        setAdminName(info.name ?? "관리자");
        setAdminMemberId(info.memberId);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const loadMembers = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("members")
        .select("id,name,withdrawn_at")
        .order("name");

      if (error) {
        toast.error("멤버 정보를 불러오지 못했습니다.");
        setLoading(false);
        return;
      }

      setMembers(data as Member[]);
      setLoading(false);
    };

    void loadMembers();
  }, []);

  useEffect(() => {
    const loadSchedules = async () => {
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - 3);
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("schedules")
        .select("id,title,type,scheduled_at,location,external_event_id")
        .gte("scheduled_at", start.toISOString())
        .order("scheduled_at", { ascending: true });

      if (error) {
        toast.error("일정 정보를 불러오지 못했습니다.");
        setSchedules([]);
        setSelectedScheduleId(null);
        return;
      }

      const items = (data as Schedule[]).sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() -
          new Date(b.scheduled_at).getTime(),
      );
      const todaySchedules = items.filter((schedule) => {
        const time = new Date(schedule.scheduled_at).getTime();
        return time >= startOfToday.getTime() && time <= endOfToday.getTime();
      });
      const pastSchedules = items
        .filter(
          (schedule) =>
            new Date(schedule.scheduled_at).getTime() < startOfToday.getTime(),
        )
        .sort(
          (a, b) =>
            new Date(b.scheduled_at).getTime() -
            new Date(a.scheduled_at).getTime(),
        );
      const futureSchedules = items.filter(
        (schedule) =>
          new Date(schedule.scheduled_at).getTime() > endOfToday.getTime(),
      );
      const selectedSchedule =
        todaySchedules[0] ?? pastSchedules[0] ?? futureSchedules[0] ?? null;
      setSchedules(items);
      setSelectedScheduleId(selectedSchedule?.id ?? null);
    };

    void loadSchedules();
  }, []);

  useEffect(() => {
    const loadAttendance = async () => {
      if (!selectedScheduleId) {
        setAttendanceMap({});
        setAttendanceCount(0);
        return;
      }
      setAttendanceLoading(true);
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("id,member_id")
        .eq("schedule_id", selectedScheduleId);

      if (error) {
        toast.error("출석 정보를 불러오지 못했습니다.");
        setAttendanceMap({});
        setAttendanceCount(0);
        setAttendanceLoading(false);
        return;
      }

      const map: Record<number, number> = {};
      (data as AttendanceLog[]).forEach((row) => {
        map[row.member_id] = row.id;
      });
      setAttendanceMap(map);
      setAttendanceCount(data?.length ?? 0);
      setAttendanceLoading(false);
    };

    void loadAttendance();
  }, [selectedScheduleId]);

  const loadAttendanceList = async () => {
    if (!selectedScheduleId) return;
    setAttendanceLoading(true);
    const { data, error } = await supabase
      .from("attendance_logs")
      .select("id,member:members!attendance_logs_member_id_fkey(id,name)")
      .eq("schedule_id", selectedScheduleId);
    if (error) {
      toast.error("출석자 정보를 불러오지 못했습니다.");
      setAttendanceList([]);
      setAttendanceLoading(false);
      return;
    }
    const normalized =
      (data as
        | {
            id: number;
            member:
              | { id: number; name: string }
              | { id: number; name: string }[]
              | null;
          }[]
        | null) ?? [];
    setAttendanceList(
      normalized.map((row) => ({
        id: row.id,
        member: Array.isArray(row.member)
          ? (row.member[0] ?? null)
          : row.member,
      })),
    );
    setAttendanceLoading(false);
  };

  const openAttendanceDialog = async () => {
    setAttendanceOpen(true);
    await loadAttendanceList();
  };

  const handleRemoveAttendance = async (logId: number) => {
    const { error } = await supabase
      .from("attendance_logs")
      .delete()
      .eq("id", logId);
    if (error) {
      toast.error("출석 해제에 실패했습니다.");
      return;
    }
    toast.success("출석 해제 완료!");
    await loadAttendanceList();
    if (selectedScheduleId) {
      const { data } = await supabase
        .from("attendance_logs")
        .select("id,member_id")
        .eq("schedule_id", selectedScheduleId);
      const map: Record<number, number> = {};
      (data as AttendanceLog[] | null)?.forEach((row) => {
        map[row.member_id] = row.id;
      });
      setAttendanceMap(map);
      setAttendanceCount(data?.length ?? 0);
    }
  };

  const selectedSchedule = useMemo(
    () => schedules.find((s) => s.id === selectedScheduleId) ?? null,
    [schedules, selectedScheduleId],
  );

  const alreadyAttendedMemberIds = useMemo(
    () =>
      new Set(
        Object.keys(attendanceMap).map((key) => Number(key)),
      ),
    [attendanceMap],
  );

  const filteredMembers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    // 탈퇴자 제외
    const activeMembers = members.filter((member) => !member?.withdrawn_at);
    if (!keyword) return activeMembers;
    return activeMembers.filter((member) =>
      member.name.toLowerCase().includes(keyword),
    );
  }, [members, query]);

  const refreshAttendance = async () => {
    if (!selectedScheduleId) {
      setAttendanceMap({});
      setAttendanceCount(0);
      return;
    }
    const { data } = await supabase
      .from("attendance_logs")
      .select("id,member_id")
      .eq("schedule_id", selectedScheduleId);
    const map: Record<number, number> = {};
    (data as AttendanceLog[] | null)?.forEach((row) => {
      map[row.member_id] = row.id;
    });
    setAttendanceMap(map);
    setAttendanceCount(data?.length ?? 0);
  };

  const openMemoDialog = async (member: Member) => {
    const logId = attendanceMap[member.id];
    if (!logId) {
      toast.error("출석 기록이 없습니다.");
      return;
    }
    setSelectedMember(member);
    setMemo("");
    setOpen(true);
    setSaving(true);
    const { data, error } = await supabase
      .from("attendance_logs")
      .select("memo")
      .eq("id", logId)
      .single();
    if (error) {
      toast.error("메모 정보를 불러오지 못했습니다.");
    } else {
      setMemo((data?.memo as string | null) ?? "");
    }
    setSaving(false);
  };

  const openMemoDialogForLog = async (
    member: { id: number; name: string },
    logId: number,
  ) => {
    setSelectedMember(member);
    setMemo("");
    setOpen(true);
    setSaving(true);
    const { data, error } = await supabase
      .from("attendance_logs")
      .select("memo")
      .eq("id", logId)
      .single();
    if (error) {
      toast.error("메모 정보를 불러오지 못했습니다.");
    } else {
      setMemo((data?.memo as string | null) ?? "");
    }
    setSaving(false);
  };

  const handleCheckAttendance = async (member: Member) => {
    if (!selectedScheduleId) {
      toast.error("먼저 출석을 등록할 일정을 선택해 주세요.");
      return;
    }
    if (!adminMemberId) {
      toast.error("로그인 정보를 확인할 수 없습니다.");
      return;
    }
    if (attendanceMap[member.id]) {
      toast.message("이미 출석 처리된 멤버입니다.");
      return;
    }
    setSaving(true);
    const payload = {
      member_id: member.id,
      checked_by: adminMemberId,
      schedule_id: selectedScheduleId,
      memo: null,
    };

    const { error } = await supabase.from("attendance_logs").insert(payload);
    if (error) {
      toast.error("출석 체크에 실패했습니다.");
      setSaving(false);
      return;
    }
    toast.success(`${member.name} 출석 완료!`);

    setSaving(false);
    await refreshAttendance();
  };

  const handleRemoveAttendanceForMember = async (member: Member) => {
    const logId = attendanceMap[member.id];
    if (!logId) return;
    const { error } = await supabase
      .from("attendance_logs")
      .delete()
      .eq("id", logId);
    if (error) {
      toast.error("출석 해제에 실패했습니다.");
      return;
    }
    toast.success(`${member.name} 출석 해제 완료!`);
    await refreshAttendance();
  };

  const handleMemoSave = async () => {
    if (!selectedMember) return;
    const logId = attendanceMap[selectedMember.id];
    if (!logId) {
      toast.error("출석 기록이 없습니다.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("attendance_logs")
      .update({ memo: memo.trim() || null })
      .eq("id", logId);
    if (error) {
      toast.error("메모 저장에 실패했습니다.");
      setSaving(false);
      return;
    }
    toast.success("메모 저장 완료!");
    setSaving(false);
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">출석 체크</h1>
      </header>

      <div className="space-y-3">
        <div className="space-y-2">
          <div className="text-sm font-medium">일정 선택</div>
          {schedules.length === 0 ? (
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              등록된 일정이 없습니다.
            </div>
          ) : (
            <>
              {/* Mobile: dropdown select */}
              <div className="block sm:hidden">
                <select
                  className="h-12 w-full rounded-lg border bg-background px-3 text-sm touch-target"
                  value={selectedScheduleId ?? ""}
                  onChange={(event) => setSelectedScheduleId(Number(event.target.value))}
                >
                  {schedules.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {formatScheduleLabel(schedule)}
                    </option>
                  ))}
                </select>
              </div>
              {/* Tablet+: horizontal chip buttons */}
              <div className="hidden sm:flex gap-2 overflow-x-auto pb-2">
                {schedules.map((schedule) => {
                  const active = schedule.id === selectedScheduleId;
                  return (
                    <button
                      key={schedule.id}
                      type="button"
                      onClick={() => setSelectedScheduleId(schedule.id)}
                      className={`shrink-0 rounded-full border px-4 py-2.5 text-left text-sm font-medium transition-all touch-target ${
                        active
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:bg-muted"
                      }`}
                    >
                      {formatScheduleLabel(schedule)}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>출석 체크 담당자: {adminName}</span>
          <button
            type="button"
            className="rounded-full border px-2 py-0.5 text-xs"
            onClick={openAttendanceDialog}
          >
            출석 인원: {attendanceLoading ? "..." : attendanceCount}명
          </button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setAutoOpen(true)}
            disabled={
              !selectedSchedule || !selectedSchedule.external_event_id
            }
            title={
              selectedSchedule?.external_event_id
                ? "소모임 참석자 일괄 출석처리"
                : "이 일정에 소모임 일정 ID(external_event_id)가 연결되어 있어야 합니다"
            }
          >
            <Wand2 className="size-3.5" />
            자동 출석처리
          </Button>
        </div>
        <Input
          placeholder="멤버 이름 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {loading && (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
            <div className="space-y-2">
              <div className="h-3 w-44 animate-pulse rounded-full bg-muted/60" />
              <div className="h-2 w-28 animate-pulse rounded-full bg-muted/40" />
            </div>
          </div>
        </div>
      )}

      {!loading && filteredMembers.length === 0 && (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          검색된 멤버가 없습니다.
        </div>
      )}

      <div className="space-y-3">
        {filteredMembers.map((member) => {
          const attended = Boolean(attendanceMap[member.id]);
          const initial = member.name.charAt(0);
          return (
            <div
              key={member.id}
              className={`flex items-center justify-between rounded-xl border bg-card p-4 transition-all card-interactive animate-fade-in ${
                attended ? "border-success bg-success-soft" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                  attended
                    ? "bg-success text-success-foreground"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {initial}
                </div>
                <div>
                  <div className="text-sm font-medium">{member.name}</div>
                  {attended && (
                    <div className="text-xs text-success-foreground/80">출석 완료</div>
                  )}
                </div>
              </div>
              {attended ? (
                <div className="flex gap-2">
                  <Button
                    className="h-11 px-4 text-sm touch-target"
                    variant="secondary"
                    onClick={() => handleRemoveAttendanceForMember(member)}
                  >
                    해제
                  </Button>
                  <Button
                    className="h-11 px-4 text-sm touch-target"
                    variant="outline"
                    onClick={() => openMemoDialog(member)}
                  >
                    메모
                  </Button>
                </div>
              ) : (
                <Button
                  className="h-11 px-5 text-sm touch-target"
                  onClick={() => handleCheckAttendance(member)}
                >
                  출석하기
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedMember ? `${selectedMember.name} 메모` : "메모"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">메모</div>
              <Textarea
                rows={4}
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder="특이사항을 입력하세요."
              />
            </div>
            <Button
              className="h-12 w-full text-base"
              onClick={handleMemoSave}
              disabled={saving}
            >
              {saving ? "처리 중..." : "저장하기"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AutoAttendanceDialog
        open={autoOpen}
        onOpenChange={setAutoOpen}
        scheduleId={selectedScheduleId}
        scheduleTitle={selectedSchedule?.title ?? "선택된 일정"}
        externalEventId={selectedSchedule?.external_event_id ?? null}
        adminMemberId={adminMemberId}
        alreadyAttendedMemberIds={alreadyAttendedMemberIds}
        onAttended={() => {
          void refreshAttendance();
        }}
      />
      <Dialog open={attendanceOpen} onOpenChange={setAttendanceOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>출석자 리스트</DialogTitle>
          </DialogHeader>
          {attendanceLoading ? (
            <div className="text-sm text-muted-foreground">
              출석자 정보를 불러오는 중...
            </div>
          ) : attendanceList.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              출석 기록이 없습니다.
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {attendanceList.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between rounded-lg border bg-muted/40 p-2"
                >
                  <div className="font-medium">
                    {row.member?.name ?? "알 수 없음"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveAttendance(row.id)}
                    >
                      출석 해제
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        row.member &&
                        openMemoDialogForLog(
                          { id: row.member.id, name: row.member.name },
                          row.id,
                        )
                      }
                      disabled={!row.member}
                    >
                      메모
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
