import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/lib/auth/auth.edge";

const publicRoutes = ["/login"];
const authApiPrefix = "/api/auth";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user?.id;
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
  const isAuthApi = pathname.startsWith(authApiPrefix);
  const isApiHealth = pathname === "/api/v1/health";
  const isApiRoute = pathname.startsWith("/api/");

  if (isAuthApi || isApiHealth) {
    return NextResponse.next();
  }

  if (!isLoggedIn && !isPublicRoute) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
