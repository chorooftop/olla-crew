import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

const inputPath = process.argv[2] ?? "./data/members.csv";
const absolutePath = path.resolve(process.cwd(), inputPath);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.");
  process.exit(1);
}

if (!fs.existsSync(absolutePath)) {
  console.error(`CSV 파일을 찾을 수 없습니다: ${absolutePath}`);
  process.exit(1);
}

const csv = fs.readFileSync(absolutePath, "utf8");
const records = parse(csv, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

if (!records.length) {
  console.error("CSV에 데이터가 없습니다.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const rows = records.map((row) => {
  const name = String(row.name ?? "").trim();
  const joinedAtRaw = String(row.joined_at ?? "").trim();
  const joinedAt = joinedAtRaw ? `${joinedAtRaw}T00:00:00Z` : null;

  return {
    name,
    joined_at: joinedAt,
  };
});

const invalidRows = rows.filter((row) => !row.name);
if (invalidRows.length) {
  console.error("name 값이 비어있는 행이 있습니다. 입력 데이터를 확인해 주세요.");
  process.exit(1);
}

const chunkSize = 500;
let inserted = 0;

for (let i = 0; i < rows.length; i += chunkSize) {
  const chunk = rows.slice(i, i + chunkSize);
  const { error } = await supabase.from("members").insert(chunk);
  if (error) {
    console.error("삽입 중 오류가 발생했습니다:", error.message);
    process.exit(1);
  }
  inserted += chunk.length;
  console.log(`Inserted ${inserted}/${rows.length}`);
}

console.log("완료!");

