import { NextResponse } from "next/server";

import { verifyAuth } from "@/lib/somoim/auth";
import { fetchSomoimSnapshot } from "@/lib/somoim/scrape";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await verifyAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const snapshot = await fetchSomoimSnapshot();
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    console.error("[somoim/events] 수집 실패:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
