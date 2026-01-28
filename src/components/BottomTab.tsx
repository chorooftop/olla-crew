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
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-muted/60 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur supports-[backdrop-filter]:bg-muted/50">
      <div className="mx-auto flex max-w-lg items-center justify-around px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 text-xs font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

