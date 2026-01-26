const AUTH_KEY = "olla-auth";
const AUTH_INFO_KEY = "olla-auth-info";
const AUTH_TOKEN_KEY = "olla-auth-token";

export type AuthInfo = {
  adminUserId: number;
  loginId: string;
  memberId: number;
  role: "ROOT" | "ADMIN";
  name: string | null;
};

export function isAuthed() {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    window.localStorage.getItem(AUTH_KEY) === "true" &&
    Boolean(window.localStorage.getItem(AUTH_TOKEN_KEY))
  );
}

export function setAuthed(value: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(AUTH_KEY, value ? "true" : "false");
}

export function setAuthToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  setAuthed(true);
}

export function getAuthToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthInfo(info: AuthInfo) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(AUTH_INFO_KEY, JSON.stringify(info));
  setAuthed(true);
}

export function getAuthInfo(): AuthInfo | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(AUTH_INFO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthInfo;
  } catch {
    return null;
  }
}

export async function fetchAuthInfo(): Promise<AuthInfo | null> {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const response = await fetch("/api/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      return null;
    }
    const info = data.adminUser as AuthInfo;
    setAuthInfo(info);
    return info;
  } catch {
    return null;
  }
}

export function clearAuthed() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(AUTH_KEY);
  window.localStorage.removeItem(AUTH_INFO_KEY);
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

