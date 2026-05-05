"use client";

import { useSyncExternalStore } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  HelpCircle,
  MousePointerClick,
  RefreshCw,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY = "olla-tutorial-import-dismissed";

const listeners = new Set<() => void>();

function readDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

function persistDismissed() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* noop */
  }
  listeners.forEach((listener) => listener());
}

function subscribeDismissed(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getServerDismissed(): boolean {
  return true;
}

function useDismissedState(): boolean {
  return useSyncExternalStore(
    subscribeDismissed,
    readDismissed,
    getServerDismissed,
  );
}

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenImport: () => void;
};

function TutorialDialog({ open, onOpenChange, onOpenImport }: DialogProps) {
  const handleOpenImport = () => {
    onOpenChange(false);
    onOpenImport();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            소모임 데이터 가져오기 가이드
          </DialogTitle>
        </DialogHeader>

        <div className="-mx-1 flex-1 space-y-3 overflow-y-auto px-1">
          <Step
            index={1}
            title="새로고침으로 최신 데이터 가져오기"
            description="모달 우상단 '새로고침'을 누르면 소모임에서 최신 일정/참석자 정보를 다시 받아옵니다."
          >
            <MockChip>
              <RefreshCw className="size-3.5" />
              새로고침
            </MockChip>
          </Step>

          <Step
            index={2}
            title="기간 필터로 좁히기"
            description="기본은 1주. 더 멀리 보고 싶으면 1달/전체로 변경, '미등록만'으로 아직 등록 안 된 일정만 골라볼 수 있어요."
          >
            <div className="flex flex-wrap gap-1">
              <MockChip variant="muted">1주</MockChip>
              <MockChip>1달</MockChip>
              <MockChip variant="muted">전체</MockChip>
              <MockChip>미등록만</MockChip>
            </div>
          </Step>

          <Step
            index={3}
            title="가져올 일정 선택"
            description="각 일정 좌측 체크박스로 선택. 이미 등록된 일정(녹색 '등록됨' 배지)은 자동으로 비활성화됩니다."
          >
            <div className="rounded-md border bg-background p-2 text-[11px]">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked
                  readOnly
                  className="size-3.5 rounded accent-primary"
                />
                <span className="font-medium">[정모] 강남 더클라임</span>
                <Badge
                  variant="outline"
                  className="ml-auto h-4 px-1 text-[10px]"
                >
                  미등록
                </Badge>
              </div>
            </div>
          </Step>

          <Step
            index={4}
            title="미등록 회원은 회원관리에서 먼저 등록"
            description="참석자 옆에 '등록' 배지가 보이면 클릭해 회원 등록 페이지로 이동. 회원이 등록돼야 자동 출석 처리가 됩니다."
          >
            <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-[11px]">
              <span>김올라</span>
              <Badge
                variant="outline"
                className="ml-auto h-5 gap-1 px-1.5 text-[10px]"
              >
                <UserPlus className="size-3" />
                등록
              </Badge>
            </div>
          </Step>

          <Step
            index={5}
            title="'생성 & 출석처리' 한 번에 끝내기"
            description="하단 버튼을 누르면 선택한 일정이 생성되고, 매칭된 활성 회원은 자동으로 출석 처리됩니다."
          >
            <div className="space-y-1">
              <MockButton>
                <MousePointerClick className="size-3.5" />
                3개 생성 & 출석처리
              </MockButton>
              <div className="flex items-center gap-1 text-[11px] text-emerald-700">
                <CheckCircle2 className="size-3.5" />
                3개 일정 · 12명 출석 처리 완료
              </div>
            </div>
          </Step>
        </div>

        <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            닫기
          </Button>
          <Button type="button" onClick={handleOpenImport} className="gap-1">
            <Download className="size-4" />
            지금 가져오기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type StepProps = {
  index: number;
  title: string;
  description: string;
  children?: React.ReactNode;
};

function Step({ index, title, description, children }: StepProps) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-start gap-2">
        <Badge
          variant="default"
          className="size-5 shrink-0 justify-center rounded-full p-0 text-[11px]"
        >
          {index}
        </Badge>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="text-sm font-semibold">{title}</div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
          {children && <div className="pt-1">{children}</div>}
        </div>
      </div>
    </div>
  );
}

function MockChip({
  children,
  variant = "primary",
}: {
  children: React.ReactNode;
  variant?: "primary" | "muted";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${
        variant === "primary"
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground"
      }`}
    >
      {children}
    </span>
  );
}

function MockButton({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground shadow-sm">
      {children}
    </span>
  );
}

type HelpButtonProps = {
  onClick: () => void;
  className?: string;
};

function HelpButton({ onClick, className }: HelpButtonProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label="가져오기 도움말 열기"
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-background text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        className ?? ""
      }`}
    >
      <HelpCircle className="size-4" />
    </button>
  );
}

type PanelProps = {
  onShowDetail: () => void;
};

function Panel({ onShowDetail }: PanelProps) {
  const dismissed = useDismissedState();

  if (dismissed) return null;

  const handleDismiss = () => {
    persistDismissed();
  };

  const handleOpenDetail = () => {
    persistDismissed();
    onShowDetail();
  };

  return (
    <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              처음 사용하시나요?
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="안내 닫기"
              className="-mt-1 -mr-1 inline-flex size-6 items-center justify-center rounded-md text-amber-700 transition-colors hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-500/20"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <ol className="space-y-1 text-xs text-amber-900/90 dark:text-amber-100/90">
            <QuickStep n={1}>
              <RefreshCw className="size-3" /> <b>새로고침</b>으로 소모임 최신
              데이터 불러오기
            </QuickStep>
            <QuickStep n={2}>
              <MousePointerClick className="size-3" /> 기간 필터로 좁히고{" "}
              <b>일정 선택</b>
            </QuickStep>
            <QuickStep n={3}>
              <UserPlus className="size-3" /> <b>미등록 회원</b>은
              &lsquo;회원관리&rsquo;에서 먼저 등록
            </QuickStep>
            <QuickStep n={4}>
              <CheckCircle2 className="size-3" />{" "}
              <b>&lsquo;N개 생성 &amp; 출석처리&rsquo;</b> 한 번에 끝
            </QuickStep>
          </ol>
          <button
            type="button"
            onClick={handleOpenDetail}
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-200 dark:hover:text-amber-100"
          >
            자세히 보기
            <ArrowRight className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickStep({
  n,
  children,
}: {
  n: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-1.5">
      <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-200/80 text-[10px] font-bold text-amber-900 dark:bg-amber-400/30 dark:text-amber-100">
        {n}
      </span>
      <span className="inline-flex flex-wrap items-center gap-1">
        {children}
      </span>
    </li>
  );
}

export const SomoimImportTutorial = {
  Panel,
  HelpButton,
  Dialog: TutorialDialog,
};
