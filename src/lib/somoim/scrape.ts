import "server-only";

import type {
  SomoimEvent,
  SomoimGroupMember,
  SomoimParticipant,
  SomoimSnapshot,
} from "./types";

const HOST = "https://sm-members.fcfc-1.com";

const HEADERS: Record<string, string> = {
  accept: "*/*",
  "content-type": "application/json",
  "accept-language": "ko-KR,ko;q=0.9",
  "user-agent": "Somoim/4.1.4.2 CFNetwork/3860.400.51 Darwin/25.3.0",
  priority: "u=3",
};

const EVENT_SUFFIX_RE = /(\d{8})(\d{4})$/;
const REQUEST_TIMEOUT_MS = 30_000;
const ATTENDEE_DELAY_MS = 500;

type RawApiBody = Record<string, unknown>;

type RawApiResponse = {
  res?: number;
  cs?: RawEvent[];
  members?: RawMember[];
  m?: RawMember[];
  me?: RawMember;
  [key: string]: unknown;
};

type RawEvent = {
  id: string;
  at?: string;
  wn?: string;
  wid?: string;
  c?: string;
  ot?: number;
  [key: string]: unknown;
};

type RawMember = {
  mid?: string;
  mn?: string;
  i_m?: string;
  ban?: string;
  os?: string;
  rsvp?: { created?: string } | null;
  [key: string]: unknown;
};

type SomoimEnv = {
  USER_ID: string;
  GID: string;
  PW: string;
  MN: string;
  G_T: number;
};

function readEnv(): SomoimEnv {
  const required = ["SOMOIM_USER_ID", "SOMOIM_GID", "SOMOIM_PW", "SOMOIM_MN"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `소모임 환경변수가 누락되었습니다: ${missing.join(", ")}. olla-crew/.env.local 파일을 확인하세요.`,
    );
  }
  return {
    USER_ID: process.env.SOMOIM_USER_ID as string,
    GID: process.env.SOMOIM_GID as string,
    PW: process.env.SOMOIM_PW as string,
    MN: process.env.SOMOIM_MN as string,
    G_T: Number.parseInt(process.env.SOMOIM_G_T ?? "0", 10) || 0,
  };
}

function baseBody(env: SomoimEnv): RawApiBody {
  return { os: "i1", ver: 599, it: "180000", pw: env.PW, gid: env.GID };
}

async function postJson(
  url: string,
  body: RawApiBody,
  signal: AbortSignal,
): Promise<RawApiResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `소모임 API HTTP 오류 (${response.status} ${response.statusText})`,
    );
  }
  const data = (await response.json()) as RawApiResponse;
  if (data?.res !== 100) {
    throw new Error(
      `소모임 API 응답 오류 (res=${data?.res ?? "?"}). 인증 정보(SOMOIM_PW 등)를 확인하세요.`,
    );
  }
  return data;
}

async function listEvents(
  env: SomoimEnv,
  signal: AbortSignal,
): Promise<RawEvent[]> {
  const body = {
    ...baseBody(env),
    s_t: 0,
    cat: "E",
    g_t: env.G_T,
    mn: env.MN,
  };
  const data = await postJson(
    `${HOST}/articles/select_articles/${env.USER_ID}.json`,
    body,
    signal,
  );
  return Array.isArray(data.cs) ? data.cs : [];
}

async function getAttendees(
  env: SomoimEnv,
  e_d: number,
  e_t: number,
  signal: AbortSignal,
): Promise<RawMember[]> {
  const body = { ...baseBody(env), e_d, e_t };
  const data = await postJson(
    `${HOST}/group_events/get_event_attending_members/${env.USER_ID}.json`,
    body,
    signal,
  );
  return Array.isArray(data.members) ? data.members : [];
}

function parseEventDateTime(eventId: string): { e_d: number; e_t: number } | null {
  const match = EVENT_SUFFIX_RE.exec(eventId);
  if (!match) return null;
  return { e_d: Number.parseInt(match[1], 10), e_t: Number.parseInt(match[2], 10) };
}

function eventIso(e_d: number, e_t: number): string | null {
  if (!e_d) return null;
  const yyyy = Math.floor(e_d / 10000);
  const mm = Math.floor((e_d % 10000) / 100);
  const dd = e_d % 100;
  const hh = Math.floor(e_t / 100);
  const mi = e_t % 100;
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  return `${pad(yyyy, 4)}-${pad(mm)}-${pad(dd)}T${pad(hh)}:${pad(mi)}:00+09:00`;
}

function sanitizeDescription(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.includes("암장비"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeMember(raw: RawMember): SomoimParticipant {
  return {
    user_id: raw.mid ?? "",
    nickname: raw.mn ?? "",
    is_master: raw.i_m === "Y",
    banned: raw.ban === "Y",
    os: raw.os ?? null,
    rsvp_created: raw.rsvp?.created ?? null,
  };
}

function normalizeEvent(event: RawEvent, attendees: RawMember[]): SomoimEvent {
  const parsed = parseEventDateTime(event.id);
  const e_d = parsed?.e_d ?? 0;
  const e_t = parsed?.e_t ?? 0;
  return {
    event_id: event.id,
    title: event.at ?? "",
    host_nickname: event.wn ?? "",
    host_user_id: event.wid ?? "",
    start_at: e_d ? eventIso(e_d, e_t) : null,
    e_d,
    e_t,
    description: sanitizeDescription(event.c ?? ""),
    participant_count: attendees.length,
    participants: attendees.map(normalizeMember),
  };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function fetchSomoimGroupMembers(): Promise<SomoimGroupMember[]> {
  const env = readEnv();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const data = await postJson(
      `${HOST}/group_infos/sync_gi/${env.USER_ID}.json`,
      baseBody(env),
      controller.signal,
    );
    const list = Array.isArray(data.m) ? data.m : [];
    const me = data.me;
    const all = me ? [...list, me] : list;
    const seen = new Set<string>();
    const out: SomoimGroupMember[] = [];
    for (const raw of all) {
      const uid = raw.mid ?? "";
      if (!uid || seen.has(uid)) continue;
      seen.add(uid);
      out.push({
        user_id: uid,
        nickname: raw.mn ?? "",
        is_master: raw.i_m === "Y",
        banned: raw.ban === "Y",
        os: raw.os ?? null,
      });
    }
    return out;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSomoimSnapshot(): Promise<SomoimSnapshot> {
  const env = readEnv();
  const startedAt = new Date();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const eventsRaw = await listEvents(env, controller.signal);
    const normalized: SomoimEvent[] = [];

    for (let i = 0; i < eventsRaw.length; i++) {
      const event = eventsRaw[i];
      const parsed = parseEventDateTime(event.id ?? "");
      if (!parsed) continue;
      const attendees = await getAttendees(
        env,
        parsed.e_d,
        parsed.e_t,
        controller.signal,
      );
      normalized.push(normalizeEvent(event, attendees));
      if (i < eventsRaw.length - 1) {
        await sleep(ATTENDEE_DELAY_MS);
      }
    }

    return {
      captured_at: startedAt.toISOString(),
      group_id: env.GID,
      user_id: env.USER_ID,
      events: normalized,
      stats: {
        event_count: normalized.length,
        total_participants: normalized.reduce(
          (sum, e) => sum + e.participant_count,
          0,
        ),
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}
