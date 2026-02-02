"use client";

import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { fetchAuthInfo } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";

type Schedule = {
  id: number;
  title: string;
  type: string | null;
  scheduled_at: string;
  city: string | null;
  location: string | null;
  memo: string | null;
  created_by: number | null;
  created_at: string | null;
};

type ScheduleAttendance = {
  id: number;
  member: { id: number; name: string } | null;
  memo: string | null;
};

const CATEGORY_OPTIONS = [
  { value: "REGULAR", label: "정모" },
  { value: "FLASH", label: "벙" },
  { value: "EVENT", label: "이벤트" },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  REGULAR: "정모",
  FLASH: "벙",
  EVENT: "이벤트",
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

export default function CalendarPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, settype] = useState<string>(CATEGORY_OPTIONS[0].value);
  const [scheduledAt, setScheduledAt] = useState("");
  const [city, setCity] = useState("");
  const [location, setLocation] = useState("");
  const [memo, setMemo] = useState("");
  const [creating, setCreating] = useState(false);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [adminName, setAdminName] = useState<string>("관리자");
  const [adminMemberId, setAdminMemberId] = useState<number | null>(null);
  const [manualTitle, setManualTitle] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState<string>(CATEGORY_OPTIONS[0].value);
  const [editScheduledAt, setEditScheduledAt] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editManualTitle, setEditManualTitle] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingSchedule, setDeletingSchedule] = useState<Schedule | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceSchedule, setAttendanceSchedule] = useState<Schedule | null>(
    null,
  );
  const [attendanceList, setAttendanceList] = useState<ScheduleAttendance[]>(
    [],
  );
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [listFilterOpen, setListFilterOpen] = useState(false);
  const [listFilter, setListFilter] = useState("UPCOMING");
  const [listSort, setListSort] = useState("PAST_FIRST");
  const [calendarBaseMonth, setCalendarBaseMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [dayDetailTitle, setDayDetailTitle] = useState("");
  const [dayDetailSchedules, setDayDetailSchedules] = useState<Schedule[]>([]);

  type DayButtonProps = ComponentProps<typeof CalendarDayButton>;

  const loadSchedules = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("schedules")
      .select(
        "id,title,type,scheduled_at,city,location,memo,created_by,created_at",
      )
      .order("scheduled_at", { ascending: false });

    if (error) {
      toast.error("일정 목록을 불러오지 못했습니다.");
      setLoading(false);
      return;
    }

    setSchedules(data as Schedule[]);
    setLoading(false);
  };

  const toDateKey = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  };

  const schedulesByDate = schedules.reduce<Record<string, Schedule[]>>(
    (acc, schedule) => {
      const key = toDateKey(schedule.scheduled_at);
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(schedule);
      return acc;
    },
    {},
  );

  const currentMonth = calendarBaseMonth;
  const todayKey = toDateKey(new Date().toISOString());
  const listSchedules = schedules
    .filter((schedule) => {
      if (listFilter === "ALL") return true;
      const dateKey = toDateKey(schedule.scheduled_at);
      if (!todayKey || !dateKey) return false;
      if (listFilter === "PAST") {
        return dateKey < todayKey;
      }
      return dateKey >= todayKey;
    })
    .sort((a, b) => {
      const timeA = new Date(a.scheduled_at).getTime();
      const timeB = new Date(b.scheduled_at).getTime();
      if (listSort === "FUTURE_FIRST") {
        return timeB - timeA;
      }
      return timeA - timeB;
    });

  const openDayDetail = (date: Date, daySchedules: Schedule[]) => {
    if (daySchedules.length === 0) return;
    setDayDetailTitle(
      date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    );
    setDayDetailSchedules(daySchedules);
    setDayDetailOpen(true);
  };

  useEffect(() => {
    const load = async () => {
      const info = await fetchAuthInfo();
      if (info) {
        setAdminName(info.name ?? "관리자");
        setAdminMemberId(info.memberId);
      }
    };
    void load();
    void loadSchedules();
  }, []);

  const resetForm = () => {
    setTitle("");
    settype(CATEGORY_OPTIONS[0].value);
    setScheduledAt("");
    setCity("");
    setLocation("");
    setMemo("");
    setManualTitle(false);
  };

  const buildTitle = (
    typeValue: string,
    cityValue: string,
    locationValue: string,
  ) => {
    const typeLabel = CATEGORY_LABELS[typeValue] ?? typeValue ?? "일정";
    const cityLabel = cityValue.trim();
    const locationLabel = locationValue.trim();
    if (!cityLabel && !locationLabel) {
      return `[${typeLabel}]`;
    }
    if (cityLabel && locationLabel) {
      return `[${typeLabel}] ${cityLabel} - ${locationLabel}`;
    }
    return `[${typeLabel}] ${cityLabel || locationLabel}`;
  };

  useEffect(() => {
    if (manualTitle) return;
    setTitle(buildTitle(type, city, location));
  }, [type, city, location, manualTitle]);

  const toDateTimeInput = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  };

  const openEditDialog = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setEditTitle(schedule.title);
    setEditType(schedule.type ?? CATEGORY_OPTIONS[0].value);
    setEditScheduledAt(toDateTimeInput(schedule.scheduled_at));
    setEditCity(schedule.city ?? "");
    setEditLocation(schedule.location ?? "");
    setEditMemo(schedule.memo ?? "");
    setEditManualTitle(false);
    setEditOpen(true);
  };

  useEffect(() => {
    if (editManualTitle) return;
    setEditTitle(buildTitle(editType, editCity, editLocation));
  }, [editType, editCity, editLocation, editManualTitle]);

  const handleUpdateSchedule = async () => {
    if (!editingSchedule) return;
    if (!editTitle.trim()) {
      toast.error("일정 제목을 입력해 주세요.");
      return;
    }
    if (!editScheduledAt) {
      toast.error("모임 일시를 선택해 주세요.");
      return;
    }

    setSavingEdit(true);
    const payload = {
      title: editTitle.trim(),
      type: editType,
      scheduled_at: new Date(editScheduledAt).toISOString(),
      city: editCity.trim() || null,
      location: editLocation.trim() || null,
      memo: editMemo.trim() || null,
    };

    const { error } = await supabase
      .from("schedules")
      .update(payload)
      .eq("id", editingSchedule.id);
    if (error) {
      toast.error("일정 수정에 실패했습니다.");
      setSavingEdit(false);
      return;
    }
    toast.success("일정이 수정되었습니다.");
    setSavingEdit(false);
    setEditOpen(false);
    setEditingSchedule(null);
    void loadSchedules();
  };

  const openDeleteDialog = (schedule: Schedule) => {
    setDeletingSchedule(schedule);
    setDeleteOpen(true);
  };

  const openAttendanceDialog = async (schedule: Schedule) => {
    setAttendanceSchedule(schedule);
    setAttendanceOpen(true);
    setAttendanceLoading(true);
    const { data, error } = await supabase
      .from("attendance_logs")
      .select("id,memo,member:members!attendance_logs_member_id_fkey(id,name)")
      .eq("schedule_id", schedule.id);
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
            memo: string | null;
            member:
              | { id: number; name: string }
              | { id: number; name: string }[]
              | null;
          }[]
        | null) ?? [];
    setAttendanceList(
      normalized.map((row) => ({
        id: row.id,
        memo: row.memo,
        member: Array.isArray(row.member)
          ? (row.member[0] ?? null)
          : row.member,
      })),
    );
    setAttendanceLoading(false);
  };

  const handleDeleteSchedule = async () => {
    if (!deletingSchedule) return;
    setDeleting(true);
    const { error } = await supabase
      .from("schedules")
      .delete()
      .eq("id", deletingSchedule.id);
    if (error) {
      toast.error("일정 삭제에 실패했습니다.");
      setDeleting(false);
      return;
    }
    toast.success("일정이 삭제되었습니다.");
    setDeleting(false);
    setDeleteOpen(false);
    setDeletingSchedule(null);
    void loadSchedules();
  };

  const handleCreateSchedule = async () => {
    if (!title.trim()) {
      toast.error("일정 제목을 입력해 주세요.");
      return;
    }
    if (!scheduledAt) {
      toast.error("모임 일시를 선택해 주세요.");
      return;
    }
    if (!adminMemberId) {
      toast.error("로그인 정보를 확인할 수 없습니다.");
      return;
    }

    setCreating(true);
    const payload = {
      title: title.trim(),
      type,
      scheduled_at: new Date(scheduledAt).toISOString(),
      city: city.trim() || null,
      location: location.trim() || null,
      memo: memo.trim() || null,
      created_by: adminMemberId,
    };

    const { error } = await supabase.from("schedules").insert(payload);
    if (error) {
      toast.error("일정 등록에 실패했습니다.");
      setCreating(false);
      return;
    }

    toast.success("일정이 등록되었습니다.");
    setCreating(false);
    setAddOpen(false);
    resetForm();
    void loadSchedules();
  };

  const handleLoadLatestSchedule = async () => {
    setLoadingLatest(true);
    const { data, error } = await supabase
      .from("schedules")
      .select("title,type,city,location,memo")
      .eq("type", type)
      .order("scheduled_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      toast.error("최신 일정을 불러오지 못했습니다.");
      setLoadingLatest(false);
      return;
    }
    if (!data) {
      toast.message("해당 유형의 일정이 없습니다.");
      setLoadingLatest(false);
      return;
    }

    setTitle(data.title ?? "");
    setCity(data.city ?? "");
    setLocation(data.location ?? "");
    setMemo(data.memo ?? "");
    setManualTitle(false);
    setLoadingLatest(false);
  };

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">모임 일정 관리</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-md border">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                className="rounded-none"
                onClick={() => setViewMode("list")}
              >
                리스트
              </Button>
              <Button
                variant={viewMode === "calendar" ? "default" : "ghost"}
                size="sm"
                className="rounded-none"
                onClick={() => setViewMode("calendar")}
              >
                캘린더
              </Button>
            </div>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="h-10">일정 추가</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>새 일정 등록</DialogTitle>
                </DialogHeader>
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    최신 일정 불러오기
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLoadLatestSchedule}
                    disabled={loadingLatest}
                  >
                    {loadingLatest ? "불러오는 중..." : "불러오기"}
                  </Button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium"
                      htmlFor="schedule-title"
                    >
                      일정 제목
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        id="schedule-title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="예: [정모] 강남 - 더클라임"
                        disabled={!manualTitle}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="sm:w-28"
                        onClick={() => setManualTitle((prev) => !prev)}
                      >
                        {manualTitle ? "자동 입력" : "수동 수정"}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium"
                      htmlFor="schedule-type"
                    >
                      일정 유형
                    </label>
                    <select
                      id="schedule-type"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={type}
                      onChange={(event) => settype(event.target.value)}
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium"
                      htmlFor="schedule-time"
                    >
                      모임 일시
                    </label>
                    <Input
                      id="schedule-time"
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(event) => setScheduledAt(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium"
                      htmlFor="schedule-city"
                    >
                      장소
                    </label>
                    <Input
                      id="schedule-city"
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      placeholder="예: 강남"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium"
                      htmlFor="schedule-location"
                    >
                      암장
                    </label>
                    <Input
                      id="schedule-location"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      placeholder="예: 더클라임"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium"
                      htmlFor="schedule-memo"
                    >
                      메모
                    </label>
                    <Textarea
                      id="schedule-memo"
                      rows={4}
                      value={memo}
                      onChange={(event) => setMemo(event.target.value)}
                      placeholder="공지사항, 준비물 등"
                    />
                  </div>
                  <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                    작성자: {adminName}
                  </div>
                  <Button
                    className="h-12 w-full text-base"
                    onClick={handleCreateSchedule}
                    disabled={creating}
                  >
                    {creating ? "등록 중..." : "일정 등록"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

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

      {!loading && schedules.length === 0 && (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          등록된 일정이 없습니다.
        </div>
      )}

      {viewMode === "calendar" ? (
        <div className="space-y-3">
          <div className="rounded-xl border bg-card p-4 shadow-sm card-interactive">
            <Calendar
              mode="single"
              selected={undefined}
              month={currentMonth}
              onMonthChange={(date) => {
                setCalendarBaseMonth(startOfMonth(date));
              }}
              className="w-full max-w-full [--cell-size:--spacing(11)] sm:[--cell-size:--spacing(10)]"
              classNames={{
                root: "w-full max-w-full",
                months: "w-full flex flex-col gap-4",
                month: "w-full",
                weekdays: "flex",
                weekday:
                  "text-muted-foreground rounded-md flex-1 font-medium text-sm select-none",
              }}
              formatters={{
                formatCaption: (date) =>
                  `${date.getFullYear()}년 ${date.getMonth() + 1}월`,
                formatWeekdayName: (date) =>
                  date.toLocaleString("ko-KR", { weekday: "short" }),
              }}
              components={{
                DayButton: (props: DayButtonProps) => {
                  const date = props.day.date;
                  const offset = date.getTimezoneOffset() * 60000;
                  const key = new Date(date.getTime() - offset)
                    .toISOString()
                    .slice(0, 10);
                  const daySchedules = schedulesByDate[key] ?? [];
                  const hasSchedules = daySchedules.length > 0;

                  return (
                    <CalendarDayButton
                      {...props}
                      onClick={() => openDayDetail(date, daySchedules)}
                      className={hasSchedules ? "ring-2 ring-primary/30 ring-offset-1" : ""}
                    >
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center">
                        <span className="text-sm font-medium">
                          {date.getDate()}
                        </span>
                        {hasSchedules && (
                          <span className="text-[10px] font-medium text-primary">
                            {daySchedules.length}개
                          </span>
                        )}
                      </div>
                    </CalendarDayButton>
                  );
                },
              }}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">필터/정렬</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setListFilterOpen((prev) => !prev)}
                className="h-8 gap-1 px-2 text-xs text-muted-foreground"
              >
                {listFilterOpen ? "닫기" : "펼치기"}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    listFilterOpen ? "rotate-180" : ""
                  }`}
                />
              </Button>
            </div>
            <div
              className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out ${
                listFilterOpen
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0"
              }`}
              aria-hidden={!listFilterOpen}
            >
              <div className="min-h-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm sm:w-[160px]"
                    value={listFilter}
                    onChange={(event) => setListFilter(event.target.value)}
                  >
                    <option value="UPCOMING">오늘 이후</option>
                    <option value="PAST">지난 일정</option>
                    <option value="ALL">전체</option>
                  </select>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm sm:w-[160px]"
                    value={listSort}
                    onChange={(event) => setListSort(event.target.value)}
                  >
                    <option value="PAST_FIRST">과거 순</option>
                    <option value="FUTURE_FIRST">미래 순</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          {listSchedules.map((schedule) => {
            const categoryLabel =
              CATEGORY_OPTIONS.find((option) => option.value === schedule.type)
                ?.label ??
              schedule.type ??
              "미분류";
            return (
              <Card key={schedule.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{schedule.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="text-xs text-muted-foreground">
                    유형: {categoryLabel}
                  </div>
                  <div>일시: {formatDateTime(schedule.scheduled_at)}</div>
                  {schedule.city && <div>장소: {schedule.city}</div>}
                  {schedule.location && <div>암장: {schedule.location}</div>}
                  {schedule.memo && (
                    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                      <div className="text-xs text-muted-foreground">메모</div>
                      <p className="mt-1 whitespace-pre-line">
                        {schedule.memo}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => openEditDialog(schedule)}
                    >
                      일정 수정
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => openDeleteDialog(schedule)}
                    >
                      일정 삭제
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => openAttendanceDialog(schedule)}
                  >
                    출석자 리스트 확인하기
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Dialog open={dayDetailOpen} onOpenChange={setDayDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dayDetailTitle}</DialogTitle>
          </DialogHeader>
          {dayDetailSchedules.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              등록된 일정이 없습니다.
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              {dayDetailSchedules.map((schedule) => (
                <div key={schedule.id} className="rounded-lg border p-3">
                  <div className="font-medium">{schedule.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(schedule.scheduled_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? `${editingSchedule.title} 수정` : "일정 수정"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-title">
                일정 제목
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  disabled={!editManualTitle}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="sm:w-28"
                  onClick={() => setEditManualTitle((prev) => !prev)}
                >
                  {editManualTitle ? "자동 입력" : "수동 수정"}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-type">
                일정 유형
              </label>
              <select
                id="edit-type"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={editType}
                onChange={(event) => setEditType(event.target.value)}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-time">
                모임 일시
              </label>
              <Input
                id="edit-time"
                type="datetime-local"
                value={editScheduledAt}
                onChange={(event) => setEditScheduledAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-city">
                장소
              </label>
              <Input
                id="edit-city"
                value={editCity}
                onChange={(event) => setEditCity(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-location">
                암장
              </label>
              <Input
                id="edit-location"
                value={editLocation}
                onChange={(event) => setEditLocation(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-memo">
                메모
              </label>
              <Textarea
                id="edit-memo"
                rows={4}
                value={editMemo}
                onChange={(event) => setEditMemo(event.target.value)}
              />
            </div>
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              작성자: {adminName}
            </div>
            <Button
              className="h-12 w-full text-base"
              onClick={handleUpdateSchedule}
              disabled={savingEdit}
            >
              {savingEdit ? "저장 중..." : "수정 저장"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>일정 삭제</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p>
              {deletingSchedule?.title ?? "해당 일정"}을(를) 삭제하시겠어요?
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setDeleteOpen(false)}
              >
                취소
              </Button>
              <Button
                className="w-full"
                variant="destructive"
                onClick={handleDeleteSchedule}
                disabled={deleting}
              >
                {deleting ? "삭제 중..." : "삭제하기"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={attendanceOpen} onOpenChange={setAttendanceOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {attendanceSchedule
                ? `${attendanceSchedule.title} 출석자`
                : "출석자 리스트"}
            </DialogTitle>
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
                <div key={row.id} className="rounded-lg border bg-muted/40 p-2">
                  <div className="font-medium">
                    {row.member?.name ?? "알 수 없음"}
                  </div>
                  {row.memo && (
                    <div className="text-xs text-muted-foreground">
                      {row.memo}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
