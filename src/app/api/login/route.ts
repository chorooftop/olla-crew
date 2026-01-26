import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const id = String(body?.id ?? "");
  const password = String(body?.password ?? "");

  const envId = process.env.AUTH_ID ?? "";
  const envPw = process.env.AUTH_PW ?? "";

  if (!envId || !envPw) {
    return NextResponse.json(
      { ok: false, message: "서버 인증 설정이 필요합니다." },
      { status: 500 }
    );
  }

  if (id !== envId || password !== envPw) {
    return NextResponse.json(
      { ok: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}

