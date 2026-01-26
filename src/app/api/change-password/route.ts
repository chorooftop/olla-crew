import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const body = await request.json();
  const currentPassword = String(body?.currentPassword ?? "");
  const nextPassword = String(body?.nextPassword ?? "");
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token || !currentPassword || !nextPassword) {
    return NextResponse.json(
      { ok: false, message: "요청 정보가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { ok: false, message: "Supabase 설정이 필요합니다." },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase
    .from("admin_user")
    .select("id,password")
    .eq("auth_token", token)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, message: "사용자 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const isValid = await bcrypt.compare(currentPassword, data.password);
  if (!isValid) {
    return NextResponse.json(
      { ok: false, message: "현재 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  const hashed = await bcrypt.hash(nextPassword, 10);
  const { error: updateError } = await supabase
    .from("admin_user")
    .update({ password: hashed })
    .eq("id", data.id);

  if (updateError) {
    return NextResponse.json(
      { ok: false, message: "비밀번호 변경에 실패했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

