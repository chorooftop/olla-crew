const AUTH_KEY = "olla-auth";

export function isAuthed() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(AUTH_KEY) === "true";
}

export function setAuthed(value: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(AUTH_KEY, value ? "true" : "false");
}

export function clearAuthed() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(AUTH_KEY);
}

