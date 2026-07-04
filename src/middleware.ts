import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/lib/auth/auth.edge";

const publicRoutes = ["/login", "/signup", "/invite", "/suspended", "/platform-login"];
const authApiPrefix = "/api/auth";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isLoggedIn = !!session?.user?.id;
  const sessionType = session?.user?.sessionType;
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
  const isAuthApi = pathname.startsWith(authApiPrefix);
  const isApiHealth = pathname === "/api/v1/health";
  const isApiOpenApi = pathname === "/api/v1/openapi";
  const isApiRoute = pathname.startsWith("/api/");
  const isPlatformRoute = pathname.startsWith("/platform");
  const isManifest = pathname === "/manifest.json" || pathname.startsWith("/icons/");

  if (isAuthApi || isApiHealth || isApiOpenApi || isManifest) {
    return NextResponse.next();
  }

  if (pathname === "/platform-admin" || pathname.startsWith("/platform-admin/")) {
    const target = pathname.replace(/^\/platform-admin/, "/platform") || "/platform";
    return NextResponse.redirect(new URL(target, req.nextUrl.origin));
  }

  if (isPlatformRoute) {
    if (pathname === "/platform-login") {
      if (isLoggedIn && sessionType === "platform") {
        return NextResponse.redirect(new URL("/platform", req.nextUrl.origin));
      }
      return NextResponse.next();
    }

    if (!isLoggedIn || sessionType !== "platform") {
      const loginUrl = new URL("/platform-login", req.nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
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

  if (isLoggedIn && sessionType === "platform" && !isPlatformRoute) {
    return NextResponse.redirect(new URL("/platform", req.nextUrl.origin));
  }

  if (isLoggedIn && (sessionType === "organization" || !sessionType)) {
    const orgStatus = session?.user?.organizationStatus;
    if (
      (orgStatus === "SUSPENDED" || orgStatus === "CANCELLED") &&
      pathname !== "/suspended"
    ) {
      return NextResponse.redirect(new URL("/suspended", req.nextUrl.origin));
    }

    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\..*).*)"],
};
