"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Schedule = {
  id: number;
  title: string;
  type: string | null;
  scheduled_at: string;
  location: string | null;
  memo: string | null;
  created_by: number | null;
  created_at: string | null;
};

type Member = {
  id: number;
  name: string;
};

const CATEGORY_OPTIONS = [
  { value: "REGULAR", label: "정모" },
  { value: "FLASH", label: "번개" },
] as const;

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

export default function CalendarPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, settype] = useState<string>(
    CATEGORY_OPTIONS[0].value
  );
  const [scheduledAt, setScheduledAt] = useState("");
  const [location, setLocation] = useState("");
  const [memo, setMemo] = useState("");
  const [createdBy, setCreatedBy] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const loadSchedules = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("schedules")
      .select(
        "id,title,type,scheduled_at,location,memo,created_by,created_at"
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

  useEffect(() => {
    const loadMembers = async () => {
      const { data } = await supabase
        .from("members")
        .select("id,name")
        .order("name");
      const list = (data as Member[]) ?? [];
      setMembers(list);
      setCreatedBy(list[0]?.id ?? null);
    };

    void loadMembers();
    void loadSchedules();
  }, []);

  const resetForm = () => {
    setTitle("");
    settype(CATEGORY_OPTIONS[0].value);
    setScheduledAt("");
    setLocation("");
    setMemo("");
    setCreatedBy(members[0]?.id ?? null);
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

    setCreating(true);
    const payload = {
      title: title.trim(),
      type,
      scheduled_at: new Date(scheduledAt).toISOString(),
      location: location.trim() || null,
      memo: memo.trim() || null,
      created_by: createdBy,
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

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">모임 일정 관리</h1>
            <p className="text-sm text-muted-foreground">
              정모/번개 일정을 등록하고 관리하세요.
            </p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="h-10">일정 추가</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 일정 등록</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="schedule-title">
                    일정 제목
                  </label>
                  <Input
                    id="schedule-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="예: 토요 정모"
                  />
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
                  <label className="text-sm font-medium" htmlFor="schedule-time">
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
                    htmlFor="schedule-location"
                  >
                    장소
                  </label>
                  <Input
                    id="schedule-location"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="예: 더클라임 강남"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="schedule-memo">
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
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="schedule-created-by"
                  >
                    작성자
                  </label>
                  <select
                    id="schedule-created-by"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={createdBy ?? ""}
                    onChange={(event) =>
                      setCreatedBy(event.target.value ? Number(event.target.value) : null)
                    }
                  >
                    {members.length === 0 && (
                      <option value="">등록된 멤버 없음</option>
                    )}
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
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
      </header>

      {loading && (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          일정을 불러오는 중...
        </div>
      )}

      {!loading && schedules.length === 0 && (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          등록된 일정이 없습니다.
        </div>
      )}

      <div className="space-y-4">
        {schedules.map((schedule) => {
          const categoryLabel =
            CATEGORY_OPTIONS.find((option) => option.value === schedule.type)
              ?.label ?? schedule.type ?? "미분류";
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
                {schedule.location && <div>장소: {schedule.location}</div>}
                {schedule.memo && (
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                    <div className="text-xs text-muted-foreground">메모</div>
                    <p className="mt-1 whitespace-pre-line">{schedule.memo}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

