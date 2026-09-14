import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isDestinoInternoValido } from "@/lib/auth-redirect";
import { TOKEN_KEY } from "@/lib/constants";
import { isTokenExpired } from "@/lib/jwt";

export function middleware(request: NextRequest) {
  const token = request.cookies.get(TOKEN_KEY)?.value;

  if (token && !isTokenExpired(token)) {
    const redirectParam = request.nextUrl.searchParams.get("redirect");
    const destino = isDestinoInternoValido(redirectParam) ? redirectParam : "/";
    return NextResponse.redirect(new URL(destino, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login"],
};
