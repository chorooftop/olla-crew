"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AttendanceRow = {
  id: number;
  attendance_date: string;
  memo: string | null;
  member: { id: number; name: string } | null;
};

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("ko-KR");
}

export default function CalendarPage() {
  const [logsByDate, setLogsByDate] = useState<Record<string, AttendanceRow[]>>(
    {}
  );
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("id,attendance_date,memo,member:members(id,name)")
        .order("attendance_date", { ascending: false });

      if (error) {
        toast.error("출석 기록을 불러오지 못했습니다.");
        setLoading(false);
        return;
      }

      const map: Record<string, AttendanceRow[]> = {};
      (data as AttendanceRow[]).forEach((log) => {
        const key = log.attendance_date;
        if (!map[key]) map[key] = [];
        map[key].push(log);
      });
      setLogsByDate(map);
      setLoading(false);
    };

    void loadLogs();
  }, []);

  const attendanceDates = useMemo(() => {
    return Object.keys(logsByDate).map((dateKey) => new Date(dateKey));
  }, [logsByDate]);

  const selectedKey = selectedDate ? toDateKey(selectedDate) : "";
  const selectedLogs = selectedKey ? logsByDate[selectedKey] ?? [] : [];

  const handleSelect = (date?: Date) => {
    if (!date) return;
    setSelectedDate(date);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">출석 캘린더</h1>
        <p className="text-sm text-muted-foreground">
          날짜를 눌러 출석 기록을 확인하세요.
        </p>
      </header>

      <div className="rounded-lg border bg-card p-3">
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            출석 기록을 불러오는 중...
          </div>
        ) : (
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            modifiers={{ hasAttendance: attendanceDates }}
            modifiersClassNames={{ hasAttendance: "attendance-day" }}
          />
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDate
                ? `${selectedDate.toLocaleDateString("ko-KR")} 출석 명단`
                : "출석 명단"}
            </DialogTitle>
          </DialogHeader>
          {selectedLogs.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              출석 기록이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {selectedLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border bg-muted/40 p-3 text-sm"
                >
                  <div className="font-medium">
                    {log.member?.name ?? "알 수 없음"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    출석일: {formatDateLabel(log.attendance_date)}
                  </div>
                  {log.memo && (
                    <p className="mt-2 whitespace-pre-line text-sm">{log.memo}</p>
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

