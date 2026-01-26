import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return NextResponse.json(
      { ok: false, message: "토큰이 없습니다." },
      { status: 401 }
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
    .select("id,login_id,role,member_id,member:members(id,name)")
    .eq("auth_token", token)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, message: "유효하지 않은 토큰입니다." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    adminUser: {
      adminUserId: data.id,
      loginId: data.login_id,
      role: data.role,
      memberId: data.member_id,
      name: data.member?.[0]?.name ?? null,
    },
  });
}

