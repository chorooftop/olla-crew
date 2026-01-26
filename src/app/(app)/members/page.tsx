"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { fetchAuthInfo } from "@/lib/auth";
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
  schedule: { scheduled_at: string | null }[] | null;
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
  const [withdrawFilter, setWithdrawFilter] = useState("ACTIVE");
  const [sortOption, setSortOption] = useState("attendance_asc");
  const [adminRole, setAdminRole] = useState<"ROOT" | "ADMIN" | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editJoinedAt, setEditJoinedAt] = useState("");
  const [editRole, setEditRole] = useState("MEMBER");
  const [editMemo, setEditMemo] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawingMember, setWithdrawingMember] = useState<Member | null>(
    null
  );
  const [withdrawing, setWithdrawing] = useState(false);

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
      .select("member_id,schedule:schedules(scheduled_at)")
      .order("scheduled_at", {
        ascending: false,
        foreignTable: "schedules",
      });

    if (logError) {
      toast.error("출석 기록을 불러오지 못했습니다.");
      setLoading(false);
      return;
    }

    const latestMap: Record<string, string> = {};
    (logData as AttendanceLog[]).forEach((log) => {
      const key = String(log.member_id);
      const scheduledAt = log.schedule?.[0]?.scheduled_at;
      if (!latestMap[key] && scheduledAt) {
        latestMap[key] = scheduledAt;
      }
    });

    setMembers(memberData as Member[]);
    setLatestAttendance(latestMap);
    setLoading(false);
  };

  useEffect(() => {
    const load = async () => {
      const info = await fetchAuthInfo();
      if (info) {
        setAdminRole(info.role);
      }
      void loadMembers();
    };
    void load();
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

  const toDateInputValue = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  };

  const openEditDialog = (member: Member) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditBirthDate(toDateInputValue(member.birth_date));
    setEditJoinedAt(toDateInputValue(member.joined_at));
    setEditRole(member.role ?? "MEMBER");
    setEditMemo(member.memo ?? "");
    setEditOpen(true);
  };

  const handleUpdateMember = async () => {
    if (!editingMember) return;
    if (!editName.trim()) {
      toast.error("이름을 입력해 주세요.");
      return;
    }
    setSavingEdit(true);
    const payload: Partial<Member> = {
      name: editName.trim(),
      birth_date: editBirthDate || null,
      joined_at: editJoinedAt
        ? new Date(editJoinedAt).toISOString()
        : editingMember.joined_at,
      memo: editMemo.trim() || null,
    };
    if (adminRole === "ROOT") {
      payload.role = editRole;
    }
    const { error } = await supabase
      .from("members")
      .update(payload)
      .eq("id", editingMember.id);
    if (error) {
      toast.error("멤버 정보 수정에 실패했습니다.");
      setSavingEdit(false);
      return;
    }
    toast.success("멤버 정보가 수정되었습니다.");
    setSavingEdit(false);
    setEditOpen(false);
    setEditingMember(null);
    void loadMembers();
  };

  const openWithdrawDialog = (member: Member) => {
    setWithdrawingMember(member);
    setWithdrawOpen(true);
  };

  const handleWithdrawMember = async () => {
    if (!withdrawingMember) return;
    setWithdrawing(true);
    const { error } = await supabase
      .from("members")
      .update({ withdrawn_at: new Date().toISOString() })
      .eq("id", withdrawingMember.id);
    if (error) {
      toast.error("탈퇴 처리에 실패했습니다.");
      setWithdrawing(false);
      return;
    }
    toast.success("멤버가 탈퇴 처리되었습니다.");
    setWithdrawing(false);
    setWithdrawOpen(false);
    setWithdrawingMember(null);
    void loadMembers();
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
      role: adminRole === "ROOT" ? newRole : "MEMBER",
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

  const getDateTime = (value?: string | null) =>
    value ? new Date(value).getTime() : NaN;

  const getAttendanceOrJoined = (member: Member) => {
    return latestAttendance[String(member.id)] ?? member.joined_at ?? null;
  };

  const getDaysSince = (value?: string | null) => {
    if (!value) return null;
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return null;
    const diffMs = Date.now() - time;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
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
    .filter((member) => {
      if (withdrawFilter === "ALL") return true;
      if (withdrawFilter === "WITHDRAWN") return Boolean(member.withdrawn_at);
      return !member.withdrawn_at;
    })
    .sort((a, b) => {
      const joinedA = getDateTime(a.joined_at);
      const joinedB = getDateTime(b.joined_at);
      const attendanceA = getDateTime(
        latestAttendance[String(a.id)] ?? a.joined_at ?? null
      );
      const attendanceB = getDateTime(
        latestAttendance[String(b.id)] ?? b.joined_at ?? null
      );

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
      <header className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                  {adminRole === "ROOT" ? (
                    <select
                      id="new-role"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={newRole}
                      onChange={(event) => setNewRole(event.target.value)}
                    >
                      <option value="MEMBER">MEMBER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  ) : (
                    <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      MEMBER (ROOT만 변경 가능)
                    </div>
                  )}
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
        <div>
          <div className="text-sm text-muted-foreground">
              총 멤버: {members.length}명
          </div>
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
              className="w-full rounded-md border bg-background px-3 py-2 text-sm sm:w-[140px]"
              value={withdrawFilter}
              onChange={(event) => setWithdrawFilter(event.target.value)}
            >
              <option value="ACTIVE">탈퇴 아님</option>
              <option value="WITHDRAWN">탈퇴</option>
              <option value="ALL">전체</option>
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
        {filteredMembers.map((member) => {
          const latestAttendanceDate = latestAttendance[String(member.id)] ?? null;
          const fallbackDate = getAttendanceOrJoined(member);
          const daysSince = getDaysSince(fallbackDate);
          const needsAttention =
            !latestAttendanceDate && typeof daysSince === "number" && daysSince >= 30;

          return (
          <Card
            key={member.id}
            className={needsAttention ? "border-destructive/70" : undefined}
          >
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{member.name}</CardTitle>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>생년월일: {formatDate(member.birth_date)}</span>
                  <span>가입일: {formatDate(member.joined_at)}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {member.role && (
                  <Badge
                    variant={member.role === "ADMIN" ? "default" : "secondary"}
                  >
                    {member.role}
                  </Badge>
                )}
                {member.withdrawn_at && (
                  <Badge variant="secondary">탈퇴</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm">
                최근 출석일:{" "}
                <span className="font-medium">
                  {latestAttendanceDate ? formatDate(latestAttendanceDate) : "미참여"}
                </span>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="text-xs text-muted-foreground">관리자 메모</div>
                <p className="mt-1 whitespace-pre-line">
                  {member.memo || "메모 없음"}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                    <MemoEditor member={member} onSave={handleSaveMemo} />
                  </DialogContent>
                </Dialog>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => openEditDialog(member)}
                >
                  정보 수정
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => openWithdrawDialog(member)}
                  disabled={Boolean(member.withdrawn_at)}
                >
                  {member.withdrawn_at ? "탈퇴됨" : "탈퇴 처리"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
        })}
      </div>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMember ? `${editingMember.name} 정보 수정` : "정보 수정"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-name">
                이름
              </label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                placeholder="이름 입력"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-birth">
                생년월일
              </label>
              <Input
                id="edit-birth"
                type="date"
                value={editBirthDate}
                onChange={(event) => setEditBirthDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-joined">
                가입일
              </label>
              <Input
                id="edit-joined"
                type="date"
                value={editJoinedAt}
                onChange={(event) => setEditJoinedAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-role">
                권한
              </label>
              {adminRole === "ROOT" ? (
                <select
                  id="edit-role"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={editRole}
                  onChange={(event) => setEditRole(event.target.value)}
                >
                  <option value="MEMBER">MEMBER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              ) : (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {editingMember?.role ?? "MEMBER"} (ROOT만 변경 가능)
                </div>
              )}
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
                placeholder="관리자 메모"
              />
            </div>
            <Button
              className="h-12 w-full text-base"
              onClick={handleUpdateMember}
              disabled={savingEdit}
            >
              {savingEdit ? "저장 중..." : "저장하기"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>멤버 탈퇴 처리</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p>
              {withdrawingMember?.name ?? "해당 멤버"}를 탈퇴 처리하시겠어요?
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setWithdrawOpen(false)}
              >
                취소
              </Button>
              <Button
                className="w-full"
                variant="destructive"
                onClick={handleWithdrawMember}
                disabled={withdrawing}
              >
                {withdrawing ? "처리 중..." : "탈퇴 처리"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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

