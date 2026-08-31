export function decodeToken(token) {
  if (!token || typeof window === "undefined") return null;

  try {
    const payload = token.split(".")[1];
    let base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    return JSON.parse(window.atob(base64));
  } catch {
    return null;
  }
}
