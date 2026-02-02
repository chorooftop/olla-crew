"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Beer,
  Calculator,
  Check,
  Coffee,
  Copy,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Member = {
  id: number;
  name: string;
  withdrawn_at: string | null;
};

type Round = {
  id: number;
  title: string;
  cost: string;
  participants: string[];
  useAlcohol: boolean;
  alcoholCost: string;
  beverageCost: string;
  drinkers: string[];
};

const ACCOUNT_INFO_PRESETS: string[] = [
  "카카오뱅크 3333-07-7386978 (조옥상)",
  "신한 110-390-580353 (장준호)",
  "카카오페이증권 020-07-639441 (강성일)",
  "국민 695002-01-192704 (이규찬)",
];
const CUSTOM_ACCOUNT_VALUE = "__custom__";

const createRound = (id: number, members: string[]): Round => ({
  id,
  title: `${id}차 장소`,
  cost: "",
  participants: [...members],
  useAlcohol: false,
  alcoholCost: "",
  beverageCost: "",
  drinkers: [...members],
});

export default function SettlementPage() {
  const [members, setMembers] = useState<string[]>([]);
  const [newMemberName, setNewMemberName] = useState("");
  const [rounds, setRounds] = useState<Round[]>([createRound(1, [])]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [copied, setCopied] = useState(false);
  const initializedRef = useRef(false);
  const prevMembersRef = useRef<string[]>([]);
  const [accountInfo, setAccountInfo] = useState<string>("");
  const [accountSelection, setAccountSelection] = useState<string>("");

  const applyMembers = (nextMembers: string[], initialize = false) => {
    if (initialize) {
      setRounds([createRound(1, nextMembers)]);
    } else {
      setRounds((prevRounds) => {
        const prevMembers = prevMembersRef.current;
        return prevRounds.map((round) => {
          const hasAllPrev =
            prevMembers.length > 0 &&
            prevMembers.every((name) => round.participants.includes(name)) &&
            round.participants.length === prevMembers.length;
          if (hasAllPrev) {
            return {
              ...round,
              participants: [...nextMembers],
              drinkers: [...nextMembers],
            };
          }
          return {
            ...round,
            participants: round.participants.filter((p) =>
              nextMembers.includes(p),
            ),
            drinkers: round.drinkers.filter((d) => nextMembers.includes(d)),
          };
        });
      });
    }
    setMembers(nextMembers);
    prevMembersRef.current = nextMembers;
  };

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    const { data, error } = await supabase
      .from("members")
      .select("id,name,withdrawn_at")
      .order("name");

    if (error) {
      toast.error("멤버 정보를 불러오지 못했습니다.");
      setLoadingMembers(false);
      return;
    }

    const activeMembers = (data as Member[])
      .filter((member) => !member.withdrawn_at)
      .map((member) => member.name);

    applyMembers(activeMembers, !initializedRef.current);
    initializedRef.current = true;
    setLoadingMembers(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line
    void loadMembers();
  }, [loadMembers]);

  const addMember = () => {
    const trimmed = newMemberName.trim();
    if (!trimmed) return;
    if (members.includes(trimmed)) {
      toast.message("이미 등록된 이름입니다.");
      return;
    }
    const updatedMembers = [...members, trimmed];
    setMembers(updatedMembers);
    prevMembersRef.current = updatedMembers;
    setRounds((prevRounds) =>
      prevRounds.map((round) => ({
        ...round,
        participants: [...round.participants, trimmed],
        drinkers: [...round.drinkers, trimmed],
      })),
    );
    setNewMemberName("");
  };

  const removeMember = (name: string) => {
    const updatedMembers = members.filter((member) => member !== name);
    setMembers(updatedMembers);
    prevMembersRef.current = updatedMembers;
    setRounds((prevRounds) =>
      prevRounds.map((round) => ({
        ...round,
        participants: round.participants.filter((p) => p !== name),
        drinkers: round.drinkers.filter((d) => d !== name),
      })),
    );
  };

  const addRound = () => {
    setRounds((prevRounds) => {
      const nextId =
        prevRounds.length > 0
          ? Math.max(...prevRounds.map((r) => r.id)) + 1
          : 1;
      return [...prevRounds, createRound(nextId, members)];
    });
  };

  const removeRound = (id: number) => {
    setRounds(rounds.filter((round) => round.id !== id));
  };

  const updateRound = (
    id: number,
    field: keyof Round,
    value: Round[keyof Round],
  ) => {
    setRounds(
      rounds.map((round) =>
        round.id === id ? { ...round, [field]: value } : round,
      ),
    );
  };

  const toggleParticipant = (roundId: number, memberName: string) => {
    setRounds(
      rounds.map((round) => {
        if (round.id !== roundId) return round;
        const isParticipating = round.participants.includes(memberName);
        if (isParticipating) {
          return {
            ...round,
            participants: round.participants.filter((p) => p !== memberName),
            drinkers: round.drinkers.filter((d) => d !== memberName),
          };
        }
        return {
          ...round,
          participants: [...round.participants, memberName],
          drinkers: [...round.drinkers, memberName],
        };
      }),
    );
  };

  const toggleDrinker = (roundId: number, memberName: string) => {
    setRounds(
      rounds.map((round) => {
        if (round.id !== roundId) return round;
        const isDrinker = round.drinkers.includes(memberName);
        return {
          ...round,
          drinkers: isDrinker
            ? round.drinkers.filter((d) => d !== memberName)
            : [...round.drinkers, memberName],
        };
      }),
    );
  };

  const selectAll = (roundId: number) => {
    setRounds(
      rounds.map((round) =>
        round.id === roundId
          ? { ...round, participants: [...members], drinkers: [...members] }
          : round,
      ),
    );
  };

  const deselectAll = (roundId: number) => {
    setRounds(
      rounds.map((round) =>
        round.id === roundId
          ? { ...round, participants: [], drinkers: [] }
          : round,
      ),
    );
  };

  const floorTo10 = (num: number) => Math.floor(num / 10) * 10;

  const result = useMemo(() => {
    const summary: Record<string, number> = {};
    members.forEach((member) => (summary[member] = 0));

    rounds.forEach((round) => {
      const totalCost = parseInt(round.cost, 10) || 0;
      const count = round.participants.length;
      if (totalCost <= 0 || count === 0) return;

      if (round.useAlcohol) {
        const alcoholCost = parseInt(round.alcoholCost, 10) || 0;
        const beverageCost = parseInt(round.beverageCost, 10) || 0;
        const foodCost = Math.max(totalCost - alcoholCost - beverageCost, 0);
        const foodPerPerson = foodCost / count;

        const drinkerCount = round.drinkers.length;
        const alcoholPerDrinker =
          drinkerCount > 0 ? alcoholCost / drinkerCount : 0;

        const nonDrinkers = round.participants.filter(
          (participant) => !round.drinkers.includes(participant),
        );
        const nonDrinkerCount = nonDrinkers.length;
        const beveragePerNonDrinker =
          nonDrinkerCount > 0 ? beverageCost / nonDrinkerCount : 0;

        round.participants.forEach((participant) => {
          summary[participant] += foodPerPerson;
          if (round.drinkers.includes(participant)) {
            summary[participant] += alcoholPerDrinker;
          } else {
            summary[participant] += beveragePerNonDrinker;
          }
        });
      } else {
        const perPerson = totalCost / count;
        round.participants.forEach((participant) => {
          summary[participant] += perPerson;
        });
      }
    });

    const finalSummary = Object.entries(summary)
      .map(([name, total]) => ({
        name,
        total: floorTo10(total),
        originalTotal: total,
      }))
      .sort((a, b) => a.total - b.total);

    const grandTotal = finalSummary.reduce((acc, cur) => acc + cur.total, 0);

    return { finalSummary, grandTotal };
  }, [members, rounds]);

  const buildCopyText = () => {
    let text = `🧗 [정산 내역]\n\n`;
    rounds.forEach((round, index) => {
      const cost = parseInt(round.cost, 10) || 0;
      if (cost <= 0) return;
      text += `${index + 1}차: ${round.title}\n`;
      text += `💰 전체금액: ${cost.toLocaleString("ko-KR")}원 (${round.participants.length}명)\n`;
      if (round.useAlcohol) {
        const alcohol = parseInt(round.alcoholCost, 10) || 0;
        const beverage = parseInt(round.beverageCost, 10) || 0;
        if (alcohol > 0) {
          text += `   - 🍺술값: ${alcohol.toLocaleString("ko-KR")}원 (N빵)\n`;
        }
        if (beverage > 0) {
          text += `   - 🥤음료: ${beverage.toLocaleString("ko-KR")}원 (N빵)\n`;
        }
      }
      text += `------------------\n`;
    });

    text += `\n✅ 최종 입금 금액\n`;
    result.finalSummary.forEach((item) => {
      if (item.total > 0) {
        text += `${item.name}: ${item.total.toLocaleString("ko-KR")}원\n`;
      }
    });
    const trimmedAccount = accountInfo.trim();
    if (trimmedAccount) {
      text += `\n🏦 ${trimmedAccount}\n`;
    }
    text += `\n재밌었습니다! 🙌`;
    return text;
  };

  const copyToClipboard = async () => {
    const text = buildCopyText();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("복사에 실패했습니다. 텍스트를 직접 선택해주세요.");
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">정산</h1>
        <p className="text-sm text-muted-foreground">
          참석 멤버와 지출 내역을 입력하면 자동으로 N빵 결과를 계산합니다.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>활성 멤버: {members.length}명</span>
          <Button
            variant="outline"
            size="sm"
            onClick={loadMembers}
            disabled={loadingMembers}
          >
            {loadingMembers ? "불러오는 중..." : "멤버 새로고침"}
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-lg">정산 계좌</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">계좌정보 선택</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={accountSelection}
              onChange={(event) => {
                const value = event.target.value;
                setAccountSelection(value);
                if (value === CUSTOM_ACCOUNT_VALUE) {
                  setAccountInfo("");
                  return;
                }
                setAccountInfo(value);
              }}
            >
              <option value="">선택 안 함</option>
              {ACCOUNT_INFO_PRESETS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
              <option value={CUSTOM_ACCOUNT_VALUE}>직접 입력</option>
            </select>
          </div>
          {accountSelection === CUSTOM_ACCOUNT_VALUE && (
            <div className="space-y-2">
              <label className="text-sm font-medium">직접 입력</label>
              <Input
                placeholder="예: 국민 123-456-789012 (홍길동)"
                value={accountInfo}
                onChange={(event) => setAccountInfo(event.target.value)}
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            정산 내용 복사하기에 계좌정보가 함께 포함됩니다.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">참여자 관리</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="이름 입력 (예: 옥상)"
              value={newMemberName}
              onChange={(event) => setNewMemberName(event.target.value)}
              onKeyDown={(event) => {
                if (
                  (event.nativeEvent as { isComposing?: boolean }).isComposing
                ) {
                  return;
                }
                if (event.key === "Enter") addMember();
              }}
            />
            <Button onClick={addMember}>추가</Button>
          </div>
          {members.length === 0 ? (
            <div className="rounded-lg border bg-muted/40 px-3 py-3 text-center text-sm text-muted-foreground">
              등록된 멤버가 없습니다.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <span
                  key={member}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-3 py-1 text-sm"
                >
                  {member}
                  <button
                    type="button"
                    onClick={() => removeMember(member)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`${member} 삭제`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {rounds.map((round, index) => (
          <Card key={round.id} className="border border-border/70">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  #{index + 1}차
                </div>
                <CardTitle className="text-lg">{round.title}</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => removeRound(round.id)}
                aria-label="라운드 삭제"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Input
                  placeholder="장소 (예: 삼겹살집)"
                  value={round.title}
                  onChange={(event) =>
                    updateRound(round.id, "title", event.target.value)
                  }
                />
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="전체 결제 금액"
                  value={
                    round.cost ? Number(round.cost).toLocaleString("ko-KR") : ""
                  }
                  onChange={(event) => {
                    const rawValue = event.target.value.replace(/,/g, "");
                    if (/^\d*$/.test(rawValue)) {
                      updateRound(round.id, "cost", rawValue);
                    }
                  }}
                />
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={round.useAlcohol}
                    onChange={(event) =>
                      updateRound(round.id, "useAlcohol", event.target.checked)
                    }
                  />
                  <span className="flex items-center gap-1">
                    <Beer className="h-4 w-4" />
                    술/음료 분리 계산
                  </span>
                </label>

                {round.useAlcohol && (
                  <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="전체 술값"
                      value={
                        round.alcoholCost
                          ? Number(round.alcoholCost).toLocaleString("ko-KR")
                          : ""
                      }
                      onChange={(event) => {
                        const rawValue = event.target.value.replace(/,/g, "");
                        if (/^\d*$/.test(rawValue)) {
                          updateRound(round.id, "alcoholCost", rawValue);
                        }
                      }}
                    />
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="전체 음료값"
                      value={
                        round.beverageCost
                          ? Number(round.beverageCost).toLocaleString("ko-KR")
                          : ""
                      }
                      onChange={(event) => {
                        const rawValue = event.target.value.replace(/,/g, "");
                        if (/^\d*$/.test(rawValue)) {
                          updateRound(round.id, "beverageCost", rawValue);
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      전체금액에서 술/음료 값을 뺀 나머지는 식사비로 공통
                      배분됩니다.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>참석자 선택 ({round.participants.length}명)</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectAll(round.id)}
                    >
                      전체 선택
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deselectAll(round.id)}
                    >
                      전체 해제
                    </Button>
                  </div>
                </div>
                {members.length === 0 ? (
                  <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    먼저 참여자를 등록해 주세요.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                    {members.map((member) => {
                      const isActive = round.participants.includes(member);
                      const isDrinker = round.drinkers.includes(member);
                      return (
                        <div key={member} className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => toggleParticipant(round.id, member)}
                            className={cn(
                              "rounded-lg border px-2 py-2.5 text-sm font-medium transition-all touch-target",
                              isActive
                                ? "border-primary bg-primary/10 text-primary shadow-sm"
                                : "border-border/70 text-muted-foreground hover:bg-muted/40 hover:border-primary/30",
                            )}
                          >
                            {member}
                          </button>
                          {round.useAlcohol && isActive && (
                            <button
                              type="button"
                              onClick={() => toggleDrinker(round.id, member)}
                              className={cn(
                                "flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs transition-all",
                                isDrinker
                                  ? "border-warning bg-warning/20 text-warning-foreground"
                                  : "border-border/70 text-muted-foreground hover:bg-muted/40",
                              )}
                            >
                              {isDrinker ? (
                                <Beer className="h-3.5 w-3.5" />
                              ) : (
                                <Coffee className="h-3.5 w-3.5" />
                              )}
                              {isDrinker ? "술" : "음료"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        variant="outline"
        className="h-12 w-full gap-2 border-dashed"
        onClick={addRound}
      >
        <Plus className="h-4 w-4" />
        새로운 N차 추가하기
      </Button>

      <Card className="border-primary/40 overflow-hidden shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2 card-header-gradient">
          <Calculator className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">최종 정산 결과</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {result.finalSummary.filter((item) => item.total > 0).length === 0 ? (
            <div className="rounded-lg border bg-background px-3 py-3 text-center text-sm text-muted-foreground">
              아직 정산할 내용이 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {result.finalSummary.map(
                (item) =>
                  item.total > 0 && (
                    <div
                      key={item.name}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-semibold text-primary">
                        {item.total.toLocaleString("ko-KR")}원
                      </span>
                    </div>
                  ),
              )}
              <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold">
                <span>총 합계</span>
                <span>{result.grandTotal.toLocaleString("ko-KR")}원</span>
              </div>
            </div>
          )}

          <Button
            className="w-full gap-2"
            variant={copied ? "default" : "secondary"}
            onClick={copyToClipboard}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                복사 완료!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                정산 내용 복사하기
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            * 10원 단위 절사 처리되었습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
