"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Member = {
  id: number;
  name: string;
};

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("ko-KR");
}

export default function AttendancePage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [open, setOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    const payload = {
      member_id: selectedMember.id,
      checked_by: selectedMember.id,
      attendance_date: toDateKey(selectedDate),
      memo: memo.trim() || null,
    };

    const { error } = await supabase.from("attendance_logs").insert(payload);
    if (error) {
      toast.error("출석 체크에 실패했습니다.");
      setSaving(false);
      return;
    }

    toast.success(`${selectedMember.name} 출석 완료!`);
    setSaving(false);
    setOpen(false);
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
          <div className="text-sm font-medium">출석 날짜</div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start">
                  {formatDateLabel(selectedDate)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              className="shrink-0"
              onClick={() => setSelectedDate(new Date())}
            >
              오늘 선택
            </Button>
          </div>
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
        {filteredMembers.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between rounded-lg border bg-card p-4"
          >
            <div className="text-sm font-medium">{member.name}</div>
            <Button
              className="h-12 px-6 text-base"
              onClick={() => openDialog(member)}
            >
              출석
            </Button>
          </div>
        ))}
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
              {saving ? "저장 중..." : "출석 등록"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

