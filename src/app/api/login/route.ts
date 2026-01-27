import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(request: Request) {
  const body = await request.json();
  const id = String(body?.id ?? "");
  const password = String(body?.password ?? "");

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
    .select("id,login_id,password,role,member_id,member:members(id,name)")
    .eq("login_id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  const isValid = await bcrypt.compare(password, data.password);
  if (!isValid) {
    return NextResponse.json(
      { ok: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  const token = crypto.randomUUID();
  const { error: tokenError } = await supabase
    .from("admin_user")
    .update({ auth_token: token })
    .eq("id", data.id);

  if (tokenError) {
    return NextResponse.json(
      { ok: false, message: "토큰 발급에 실패했습니다." },
      { status: 500 }
    );
  }

  const member = (data as { member?: { name?: string } | { name?: string }[] })
    .member;
  const memberName = Array.isArray(member)
    ? member[0]?.name ?? null
    : member?.name ?? null;

  return NextResponse.json({
    ok: true,
    token,
    adminUser: {
      adminUserId: data.id,
      loginId: data.login_id,
      role: data.role,
      memberId: data.member_id,
      name: memberName,
    },
  });
}

