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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Member = {
  id: number;
  name: string;
  birth_date: string | null;
  joined_at: string | null;
  role: string | null;
  memo: string | null;
  withdrawn_at: string | null;
};

type AttendanceLog = {
  member_id: number;
  attendance_date: string;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("ko-KR");
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [latestAttendance, setLatestAttendance] = useState<Record<string, string>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBirthDate, setNewBirthDate] = useState("");
  const [newJoinedAt, setNewJoinedAt] = useState("");
  const [newRole, setNewRole] = useState("MEMBER");
  const [newMemo, setNewMemo] = useState("");
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [sortOption, setSortOption] = useState("joined_desc");

  const loadMembers = async () => {
    setLoading(true);
    const { data: memberData, error: memberError } = await supabase
      .from("members")
      .select("id,name,birth_date,joined_at,role,memo,withdrawn_at")
      .order("joined_at", { ascending: false });

    if (memberError) {
      toast.error("멤버 목록을 불러오지 못했습니다.");
      setLoading(false);
      return;
    }

    const { data: logData, error: logError } = await supabase
      .from("attendance_logs")
      .select("member_id,attendance_date")
      .order("attendance_date", { ascending: false });

    if (logError) {
      toast.error("출석 기록을 불러오지 못했습니다.");
      setLoading(false);
      return;
    }

    const latestMap: Record<string, string> = {};
    (logData as AttendanceLog[]).forEach((log) => {
      const key = String(log.member_id);
      if (!latestMap[key]) {
        latestMap[key] = log.attendance_date;
      }
    });

    setMembers(memberData as Member[]);
    setLatestAttendance(latestMap);
    setLoading(false);
  };

  useEffect(() => {
    void loadMembers();
  }, []);

  const handleSaveMemo = async (memberId: number, memo: string) => {
    const { error } = await supabase
      .from("members")
      .update({ memo })
      .eq("id", memberId);

    if (error) {
      toast.error("메모 저장에 실패했습니다.");
      return false;
    }

    setMembers((prev) =>
      prev.map((member) =>
        member.id === memberId ? { ...member, memo } : member
      )
    );
    toast.success("메모가 수정되었습니다.");
    return true;
  };

  const resetNewMemberForm = () => {
    setNewName("");
    setNewBirthDate("");
    setNewJoinedAt("");
    setNewRole("MEMBER");
    setNewMemo("");
  };

  const handleCreateMember = async () => {
    if (!newName.trim()) {
      toast.error("이름을 입력해 주세요.");
      return;
    }

    setCreating(true);
    const payload = {
      name: newName.trim(),
      birth_date: newBirthDate || null,
      joined_at: newJoinedAt
        ? new Date(newJoinedAt).toISOString()
        : new Date().toISOString(),
      role: newRole,
      memo: newMemo.trim() || null,
      withdrawn_at: null,
    };

    const { error } = await supabase.from("members").insert(payload);
    if (error) {
      toast.error("멤버 추가에 실패했습니다.");
      setCreating(false);
      return;
    }

    toast.success("멤버가 추가되었습니다.");
    setCreating(false);
    setAddOpen(false);
    resetNewMemberForm();
    void loadMembers();
  };

  const filteredMembers = members
    .filter((member) => {
      const keyword = query.trim().toLowerCase();
      if (!keyword) return true;
      return member.name.toLowerCase().includes(keyword);
    })
    .filter((member) => {
      if (roleFilter === "ALL") return true;
      return member.role === roleFilter;
    })
    .sort((a, b) => {
      const getTime = (value?: string | null) =>
        value ? new Date(value).getTime() : NaN;
      const joinedA = getTime(a.joined_at);
      const joinedB = getTime(b.joined_at);
      const attendanceA = getTime(latestAttendance[String(a.id)]);
      const attendanceB = getTime(latestAttendance[String(b.id)]);

      const compareDates = (left: number, right: number, ascending: boolean) => {
        const leftValid = Number.isFinite(left);
        const rightValid = Number.isFinite(right);
        if (!leftValid && !rightValid) return 0;
        if (!leftValid) return 1;
        if (!rightValid) return -1;
        return ascending ? left - right : right - left;
      };

      switch (sortOption) {
        case "joined_asc":
          return compareDates(joinedA, joinedB, true);
        case "attendance_desc":
          return compareDates(attendanceA, attendanceB, false);
        case "attendance_asc":
          return compareDates(attendanceA, attendanceB, true);
        case "joined_desc":
        default:
          return compareDates(joinedA, joinedB, false);
      }
    });

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">멤버 리스트</h1>
            <p className="text-sm text-muted-foreground">
              최근 출석일과 관리자 메모를 함께 확인하세요.
            </p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="h-10">멤버 추가</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 멤버 등록</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="new-name">
                    이름
                  </label>
                  <Input
                    id="new-name"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="이름 입력"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="new-birth">
                    생년월일
                  </label>
                  <Input
                    id="new-birth"
                    type="date"
                    value={newBirthDate}
                    onChange={(event) => setNewBirthDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="new-joined">
                    가입일
                  </label>
                  <Input
                    id="new-joined"
                    type="date"
                    value={newJoinedAt}
                    onChange={(event) => setNewJoinedAt(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="new-role">
                    권한
                  </label>
                  <select
                    id="new-role"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={newRole}
                    onChange={(event) => setNewRole(event.target.value)}
                  >
                    <option value="MEMBER">MEMBER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="new-memo">
                    메모
                  </label>
                  <Textarea
                    id="new-memo"
                    rows={4}
                    value={newMemo}
                    onChange={(event) => setNewMemo(event.target.value)}
                    placeholder="관리자 메모를 입력하세요."
                  />
                </div>
                <Button
                  className="h-12 w-full text-base"
                  onClick={handleCreateMember}
                  disabled={creating}
                >
                  {creating ? "등록 중..." : "멤버 등록"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="text-sm text-muted-foreground">
            총 멤버: {members.length}명
          </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm sm:w-[140px]"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option value="ALL">전체</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MEMBER">MEMBER</option>
            </select>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm sm:w-[180px]"
              value={sortOption}
              onChange={(event) => setSortOption(event.target.value)}
            >
              <option value="joined_desc">가입일 최신순</option>
              <option value="joined_asc">가입일 오래된순</option>
              <option value="attendance_desc">출석일 최신순</option>
              <option value="attendance_asc">출석일 오래된순</option>
            </select>
            <Input
              placeholder="멤버 이름 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="sm:w-[200px]"
            />
          </div>
        </div>
      </header>

      {loading && (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          멤버 정보를 불러오는 중...
        </div>
      )}

      {!loading && members.length === 0 && (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          등록된 멤버가 없습니다.
        </div>
      )}

      <div className="space-y-4">
        {!loading && members.length > 0 && filteredMembers.length === 0 && (
          <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
            검색된 멤버가 없습니다.
          </div>
        )}
        {filteredMembers.map((member) => (
          <Card key={member.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{member.name}</CardTitle>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>생년월일: {formatDate(member.birth_date)}</span>
                  <span>가입일: {formatDate(member.joined_at)}</span>
                </div>
              </div>
              {member.role && (
                <Badge variant={member.role === "ADMIN" ? "default" : "secondary"}>
                  {member.role}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm">
                최근 출석일:{" "}
                <span className="font-medium">
                  {formatDate(latestAttendance[String(member.id)])}
                </span>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="text-xs text-muted-foreground">관리자 메모</div>
                <p className="mt-1 whitespace-pre-line">
                  {member.memo || "메모 없음"}
                </p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    메모 수정
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{member.name} 메모 수정</DialogTitle>
                  </DialogHeader>
                  <MemoEditor
                    member={member}
                    onSave={handleSaveMemo}
                  />
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MemoEditor({
  member,
  onSave,
}: {
  member: Member;
  onSave: (memberId: number, memo: string) => Promise<boolean>;
}) {
  const [memo, setMemo] = useState(member.memo ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave(member.id, memo.trim());
    setSaving(false);
    if (!ok) return;
  };

  return (
    <div className="space-y-4">
      <Textarea
        rows={5}
        value={memo}
        onChange={(event) => setMemo(event.target.value)}
        placeholder="관리자 메모를 입력하세요."
      />
      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? "저장 중..." : "저장하기"}
      </Button>
    </div>
  );
}

