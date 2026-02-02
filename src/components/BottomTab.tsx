"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, Calendar, CheckCircle2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/members", label: "멤버", icon: Users },
  { href: "/attendance", label: "출석", icon: CheckCircle2 },
  { href: "/calendar", label: "일정", icon: Calendar },
  { href: "/settlement", label: "정산", icon: Calculator },
];

export default function BottomTab() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-primary/10 bg-background/80 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium transition-all touch-target",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "transition-transform duration-200",
                  active ? "h-6 w-6 scale-110" : "h-5 w-5"
                )}
              />
              <span className={active ? "font-semibold" : ""}>{label}</span>
              {active && (
                <span className="absolute -top-0.5 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

