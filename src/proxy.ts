import { auth } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const role = (req.auth?.user as { role?: string } | undefined)?.role;
  const { pathname } = req.nextUrl;
  const isAuthPage = pathname.startsWith("/login");
  const isApiAuth = pathname.startsWith("/api/auth");
  const isCron = pathname.startsWith("/api/cron");
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (isApiAuth || isCron) return NextResponse.next();
  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
  if (isLoggedIn && isAdminRoute && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
