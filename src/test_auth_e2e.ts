import http from "node:http";

const BASE_URL = "http://localhost:3005";

interface TestResult {
  name: string;
  passed: boolean;
  details?: any;
}

const results: TestResult[] = [];

async function request(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    cookie?: string;
  } = {}
) {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = { ...(options.headers || {}) };
  if (options.cookie) {
    headers["Cookie"] = options.cookie;
  }
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}

  const setCookie = res.headers.get("set-cookie");
  let sessionCookie: string | undefined;
  if (setCookie) {
    const match = setCookie.match(/uc_session_token=[^;]+/);
    if (match) sessionCookie = match[0];
  }

  return {
    status: res.status,
    headers: res.headers,
    json,
    text,
    sessionCookie,
  };
}

async function runTests() {
  console.log("=== Starting Urban Company Auth & Authorization Tests ===");

  // 1. Unauthenticated GET /api/customer -> 401
  const test1 = await request("/api/customer");
  results.push({
    name: "1. Unauthenticated GET /api/customer returns 401",
    passed: test1.status === 401,
    details: { status: test1.status, body: test1.json },
  });

  // 2. Unauthenticated GET /api/professionals/15/calendar -> 401
  const test2 = await request("/api/professionals/15/calendar?date=2026-08-26");
  results.push({
    name: "2. Unauthenticated GET /api/professionals/:id/calendar returns 401",
    passed: test2.status === 401,
    details: { status: test2.status, body: test2.json },
  });

  // 3. Unauthenticated POST /api/bookings/1/rebook -> 401
  const test3 = await request("/api/bookings/1/rebook", {
    method: "POST",
    body: { date: "2026-08-26", time: "02:00 PM" },
  });
  results.push({
    name: "3. Unauthenticated POST /api/bookings/:id/rebook returns 401",
    passed: test3.status === 401,
    details: { status: test3.status, body: test3.json },
  });

  // 4. Customer Login (ananya@gmail.com) -> 200 + session cookie
  const test4 = await request("/api/auth/login", {
    method: "POST",
    body: { email: "ananya@gmail.com", password: "password123" },
  });
  const ananyaCookie = test4.sessionCookie;
  results.push({
    name: "4. Customer Login succeeds with session cookie",
    passed: test4.status === 200 && !!ananyaCookie && test4.json?.user?.role === "CUSTOMER",
    details: { status: test4.status, user: test4.json?.user, hasCookie: !!ananyaCookie },
  });

  // 5. GET /api/auth/me with Ananya's cookie -> 200 Ananya
  const test5 = await request("/api/auth/me", { cookie: ananyaCookie });
  results.push({
    name: "5. GET /api/auth/me returns authenticated customer",
    passed: test5.status === 200 && test5.json?.user?.email === "ananya@gmail.com",
    details: { status: test5.status, user: test5.json?.user },
  });

  // 6. GET /api/customer with Ananya's cookie -> 200 Ananya's bookings
  const test6 = await request("/api/customer", { cookie: ananyaCookie });
  const ananyaBookings = test6.json?.bookings || [];
  results.push({
    name: "6. Authenticated Customer GET /api/customer returns own data",
    passed: test6.status === 200 && test6.json?.customer?.email === "ananya@gmail.com" && ananyaBookings.length > 0,
    details: { status: test6.status, customer: test6.json?.customer?.name, bookingCount: ananyaBookings.length },
  });

  // 7. Customer Mismatched Access: Ananya trying to access Arya's data via query param -> 403 Forbidden
  const test7 = await request("/api/customer?email=arya@gmail.com", { cookie: ananyaCookie });
  results.push({
    name: "7. Customer access to other customer data returns 403 Forbidden",
    passed: test7.status === 403,
    details: { status: test7.status, body: test7.json },
  });

  // 8. Cross-customer re-booking attempt:
  // Login as Arya
  const aryaLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: "arya@gmail.com", password: "password123" },
  });
  const aryaCookie = aryaLogin.sessionCookie;
  const aryaData = await request("/api/customer", { cookie: aryaCookie });
  const aryaBooking = aryaData.json?.bookings?.find((b: any) => b.status === "COMPLETED");

  // Ananya attempts to rebook Arya's booking -> 403 Forbidden
  let test8Passed = false;
  if (aryaBooking) {
    const test8 = await request(`/api/bookings/${aryaBooking.id}/rebook`, {
      method: "POST",
      cookie: ananyaCookie,
      body: { date: "2026-08-27", time: "02:00 PM" },
    });
    test8Passed = test8.status === 403;
    results.push({
      name: "8. Customer rebooking another user's booking returns 403 Forbidden",
      passed: test8Passed,
      details: { status: test8.status, body: test8.json },
    });
  }

  // 9. Customer re-booking own completed booking -> 201 Created
  const ananyaCompletedBooking = ananyaBookings.find((b: any) => b.status === "COMPLETED");
  if (ananyaCompletedBooking) {
    const test9 = await request(`/api/bookings/${ananyaCompletedBooking.id}/rebook`, {
      method: "POST",
      cookie: ananyaCookie,
      body: { date: "2026-08-28", time: "02:00 PM" },
    });
    results.push({
      name: "9. Customer re-booking own completed booking returns 201 Created",
      passed: test9.status === 201,
      details: { status: test9.status, newBookingId: test9.json?.booking?.id },
    });
  }

  // 10. Professional Login (priya@gmail.com) -> 200 + cookie
  const test10 = await request("/api/auth/login", {
    method: "POST",
    body: { email: "priya@gmail.com", password: "password123" },
  });
  const priyaCookie = test10.sessionCookie;
  results.push({
    name: "10. Professional Login succeeds with role PROFESSIONAL",
    passed: test10.status === 200 && test10.json?.user?.role === "PROFESSIONAL",
    details: { status: test10.status, user: test10.json?.user },
  });

  // 11. Professional calling /api/customer -> 403 Forbidden
  const test11 = await request("/api/customer", { cookie: priyaCookie });
  results.push({
    name: "11. Professional calling GET /api/customer returns 403 Forbidden",
    passed: test11.status === 403,
    details: { status: test11.status, body: test11.json },
  });

  // 12. Authenticated calendar access -> 200 OK
  const priyaProId = test10.json?.user?.professionalId;
  const test12 = await request(`/api/professionals/${priyaProId}/calendar?date=2026-08-26`, {
    cookie: priyaCookie,
  });
  results.push({
    name: "12. Authenticated user viewing calendar returns 200 OK",
    passed: test12.status === 200 && test12.json?.slots?.length === 5,
    details: { status: test12.status, slotCount: test12.json?.slots?.length },
  });

  // 13. Signup new Customer
  const uniqueEmail = `cust_${Date.now()}@example.com`;
  const test13 = await request("/api/auth/signup", {
    method: "POST",
    body: {
      name: "Test Customer",
      email: uniqueEmail,
      password: "password123",
      role: "CUSTOMER",
      address: "MG Road, Bengaluru",
    },
  });
  results.push({
    name: "13. Customer Signup creates user and returns session cookie",
    passed: test13.status === 201 && !!test13.sessionCookie,
    details: { status: test13.status, user: test13.json?.user },
  });

  // 14. Signup new Professional
  const uniqueProEmail = `pro_${Date.now()}@example.com`;
  const test14 = await request("/api/auth/signup", {
    method: "POST",
    body: {
      name: "Test Pro",
      email: uniqueProEmail,
      password: "password123",
      role: "PROFESSIONAL",
      phone: "9998887776",
    },
  });
  results.push({
    name: "14. Professional Signup creates User and Professional record",
    passed: test14.status === 201 && !!test14.sessionCookie && !!test14.json?.user?.professionalId,
    details: { status: test14.status, user: test14.json?.user },
  });

  // 15. Logout -> clears session cookie
  const test15 = await request("/api/auth/logout", {
    method: "POST",
    cookie: ananyaCookie,
  });
  const logoutCookieCleared = test15.headers.get("set-cookie")?.includes("Max-Age=0") || test15.headers.get("set-cookie")?.includes("uc_session_token=;");
  results.push({
    name: "15. Logout endpoint clears session cookie",
    passed: test15.status === 200 && !!logoutCookieCleared,
    details: { status: test15.status, setCookie: test15.headers.get("set-cookie") },
  });

  console.log("\n================ TEST SUMMARY ================");
  let allPassed = true;
  for (const r of results) {
    const mark = r.passed ? "PASS" : "FAIL";
    if (!r.passed) allPassed = false;
    console.log(`[${mark}] ${r.name}`);
    if (!r.passed) {
      console.log("   Details:", JSON.stringify(r.details, null, 2));
    }
  }

  console.log(`\nTOTAL: ${results.filter(r => r.passed).length}/${results.length} PASSED`);
  if (!allPassed) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
