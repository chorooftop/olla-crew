"use client";

import { useEffect, useMemo, useState } from "react";
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

type Member = {
  id: number;
  name: string;
};

type Schedule = {
  id: number;
  title: string;
  type: string | null;
  scheduled_at: string;
  location: string | null;
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
    ? schedule.scheduled_at
    : date.toLocaleString("ko-KR", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
  return `${schedule.title} / ${dateLabel}`;
}

export default function AttendancePage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(
    null
  );
  const [open, setOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [adminName, setAdminName] = useState<string>("관리자");
  const [adminMemberId, setAdminMemberId] = useState<number | null>(null);
  const [attendanceMap, setAttendanceMap] = useState<Record<number, number>>(
    {}
  );
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceList, setAttendanceList] = useState<
    { id: number; member: { id: number; name: string } | null }[]
  >([]);

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
        .select("id,name")
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
      start.setDate(start.getDate() - 30);
      const end = new Date(now);
      end.setDate(end.getDate() + 90);

      const { data, error } = await supabase
        .from("schedules")
        .select("id,title,type,scheduled_at,location")
        .gte("scheduled_at", start.toISOString())
        .lte("scheduled_at", end.toISOString())
        .order("scheduled_at", { ascending: true });

      if (error) {
        toast.error("일정 정보를 불러오지 못했습니다.");
        setSchedules([]);
        setSelectedScheduleId(null);
        return;
      }

      const nowTime = now.getTime();
      const items = (data as Schedule[]).sort((a, b) => {
        const diffA = Math.abs(new Date(a.scheduled_at).getTime() - nowTime);
        const diffB = Math.abs(new Date(b.scheduled_at).getTime() - nowTime);
        if (diffA !== diffB) return diffA - diffB;
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      });
      setSchedules(items);
      setSelectedScheduleId(items[0]?.id ?? null);
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
      (data as {
        id: number;
        member: { id: number; name: string } | { id: number; name: string }[] | null;
      }[] | null) ?? [];
    setAttendanceList(
      normalized.map((row) => ({
        id: row.id,
        member: Array.isArray(row.member) ? row.member[0] ?? null : row.member,
      }))
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

  const filteredMembers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return members;
    return members.filter((member) =>
      member.name.toLowerCase().includes(keyword)
    );
  }, [members, query]);

  const openDialog = (member: Member) => {
    setSelectedMember(member);
    setMemo("");
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedMember) return;
    if (!selectedScheduleId) {
      toast.error("먼저 출석을 등록할 일정을 선택해 주세요.");
      return;
    }
    if (!adminMemberId) {
      toast.error("로그인 정보를 확인할 수 없습니다.");
      return;
    }
    setSaving(true);
    const existingLogId = attendanceMap[selectedMember.id];

    if (existingLogId) {
      const { error } = await supabase
        .from("attendance_logs")
        .delete()
        .eq("id", existingLogId);
      if (error) {
        toast.error("출석 해제에 실패했습니다.");
        setSaving(false);
        return;
      }
      toast.success(`${selectedMember.name} 출석 해제 완료!`);
    } else {
      const payload = {
        member_id: selectedMember.id,
        checked_by: adminMemberId,
        schedule_id: selectedScheduleId,
        memo: memo.trim() || null,
      };

      const { error } = await supabase.from("attendance_logs").insert(payload);
      if (error) {
        toast.error("출석 체크에 실패했습니다.");
        setSaving(false);
        return;
      }
      toast.success(`${selectedMember.name} 출석 완료!`);
    }

    setSaving(false);
    setOpen(false);
    setMemo("");
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

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">출석 체크</h1>
        <p className="text-sm text-muted-foreground">
          멤버를 검색하고 출석을 등록하세요.
        </p>
      </header>

      <div className="space-y-3">
        <div className="space-y-2">
          <div className="text-sm font-medium">일정 선택</div>
          {schedules.length === 0 ? (
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              등록된 일정이 없습니다.
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {schedules.map((schedule) => {
                const active = schedule.id === selectedScheduleId;
                return (
                  <button
                    key={schedule.id}
                    type="button"
                    onClick={() => setSelectedScheduleId(schedule.id)}
                    className={
                      active
                        ? "shrink-0 rounded-full border border-primary bg-primary/10 px-3 py-2 text-left text-xs font-medium text-primary"
                        : "shrink-0 rounded-full border px-3 py-2 text-left text-xs text-muted-foreground"
                    }
                  >
                    {formatScheduleLabel(schedule)}
                  </button>
                );
              })}
            </div>
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
        </div>
        <Input
          placeholder="멤버 이름 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {loading && (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          멤버 정보를 불러오는 중...
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
          return (
          <div
            key={member.id}
            className="flex items-center justify-between rounded-lg border bg-card p-4"
          >
            <div className="text-sm font-medium">{member.name}</div>
            <Button
              className="h-12 px-6 text-base"
              onClick={() => openDialog(member)}
              variant={attended ? "secondary" : "default"}
            >
              {attended ? "출석 해제" : "출석하기"}
            </Button>
          </div>
        );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedMember ? `${selectedMember.name} 출석 체크` : "출석 체크"}
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
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving
                ? "처리 중..."
                : attendanceMap[selectedMember?.id ?? 0]
                ? "출석 해제하기"
                : "출석하기"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemoveAttendance(row.id)}
                  >
                    출석 해제
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

