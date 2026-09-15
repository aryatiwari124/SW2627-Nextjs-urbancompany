import { db } from "../prisma/db";

const BASE_URL = "http://localhost:3006";

interface TestCaseResult {
  suite: string;
  test: string;
  expectedStatus: number;
  actualStatus: number;
  expectedCode?: string;
  actualCode?: string;
  passed: boolean;
  notes?: string;
}

const testResults: TestCaseResult[] = [];

async function apiRequest(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    cookie?: string;
    rawBody?: string;
  } = {}
) {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = { ...(options.headers || {}) };
  if (options.cookie) {
    headers["Cookie"] = options.cookie;
  }
  if (!headers["Content-Type"] && (options.body !== undefined || options.rawBody !== undefined)) {
    headers["Content-Type"] = "application/json";
  }

  let bodyContent: string | undefined;
  if (options.rawBody !== undefined) {
    bodyContent = options.rawBody;
  } else if (options.body !== undefined) {
    bodyContent = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: bodyContent,
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

function record(
  suite: string,
  test: string,
  expectedStatus: number,
  res: { status: number; json: any },
  expectedCode?: string
) {
  const passed =
    res.status === expectedStatus &&
    (!expectedCode || res.json?.code === expectedCode);
  testResults.push({
    suite,
    test,
    expectedStatus,
    actualStatus: res.status,
    expectedCode,
    actualCode: res.json?.code,
    passed,
    notes: !passed ? JSON.stringify(res.json) : undefined,
  });
}

async function runAll() {
  console.log("=== HARDENED INPUT VALIDATION & CONCURRENCY TEST SUITE ===");

  // Seed / ensure test users
  const loginAnanya = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { email: "ananya@gmail.com", password: "password123" },
  });
  const ananyaCookie = loginAnanya.sessionCookie!;

  const loginPriya = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { email: "priya@gmail.com", password: "password123" },
  });
  const priyaCookie = loginPriya.sessionCookie!;

  // -------------------------------------------------------------
  // SUITE 1: /api/auth/signup Input Validation
  // -------------------------------------------------------------
  console.log("\n[Suite 1] Testing /api/auth/signup input validation...");

  // 1.1 Malformed JSON body
  const r1_1 = await apiRequest("/api/auth/signup", {
    method: "POST",
    rawBody: "{ bad_json: ",
  });
  record("Signup", "Malformed JSON body returns 400", 400, r1_1, "VALIDATION_ERROR");

  // 1.2 Missing email
  const r1_2 = await apiRequest("/api/auth/signup", {
    method: "POST",
    body: { password: "Password123", name: "Test User", role: "CUSTOMER", address: "123 Street" },
  });
  record("Signup", "Missing email returns 400", 400, r1_2, "VALIDATION_ERROR");

  // 1.3 Invalid email format (no domain)
  const r1_3 = await apiRequest("/api/auth/signup", {
    method: "POST",
    body: { email: "notanemail", password: "Password123", name: "Test User", role: "CUSTOMER", address: "123 Street" },
  });
  record("Signup", "Invalid email format returns 400", 400, r1_3, "VALIDATION_ERROR");

  // 1.4 SQL injection in email
  const r1_4 = await apiRequest("/api/auth/signup", {
    method: "POST",
    body: { email: "' OR '1'='1' --", password: "Password123", name: "Test User", role: "CUSTOMER", address: "123 Street" },
  });
  record("Signup", "SQL injection in email rejected with 400", 400, r1_4, "VALIDATION_ERROR");

  // 1.5 Weak password (less than 8 chars)
  const r1_5 = await apiRequest("/api/auth/signup", {
    method: "POST",
    body: { email: "valid1@test.com", password: "short", name: "Test User", role: "CUSTOMER", address: "123 Street" },
  });
  record("Signup", "Short password (<8 chars) returns 400", 400, r1_5, "VALIDATION_ERROR");

  // 1.6 Weak password (letters only, no numbers)
  const r1_6 = await apiRequest("/api/auth/signup", {
    method: "POST",
    body: { email: "valid2@test.com", password: "onlylettershere", name: "Test User", role: "CUSTOMER", address: "123 Street" },
  });
  record("Signup", "Weak password (no numbers) returns 400", 400, r1_6, "VALIDATION_ERROR");

  // 1.7 Invalid role (e.g. ADMIN)
  const r1_7 = await apiRequest("/api/auth/signup", {
    method: "POST",
    body: { email: "valid3@test.com", password: "Password123", name: "Test User", role: "ADMIN", address: "123 Street" },
  });
  record("Signup", "Invalid role returns 400", 400, r1_7, "VALIDATION_ERROR");

  // 1.8 Customer without required address
  const r1_8 = await apiRequest("/api/auth/signup", {
    method: "POST",
    body: { email: "valid4@test.com", password: "Password123", name: "Test User", role: "CUSTOMER" },
  });
  record("Signup", "Customer missing address returns 400", 400, r1_8, "VALIDATION_ERROR");

  // 1.9 Professional without required phone
  const r1_9 = await apiRequest("/api/auth/signup", {
    method: "POST",
    body: { email: "valid5@test.com", password: "Password123", name: "Test Pro", role: "PROFESSIONAL" },
  });
  record("Signup", "Professional missing phone returns 400", 400, r1_9, "VALIDATION_ERROR");

  // 1.10 Extremely long string payload (>1000 chars)
  const r1_10 = await apiRequest("/api/auth/signup", {
    method: "POST",
    body: { email: "valid6@test.com", password: "Password123", name: "A".repeat(2000), role: "CUSTOMER", address: "123 Street" },
  });
  record("Signup", "Oversized name string returns 400", 400, r1_10, "VALIDATION_ERROR");

  // 1.11 Duplicate email registration
  const r1_11 = await apiRequest("/api/auth/signup", {
    method: "POST",
    body: { email: "ananya@gmail.com", password: "Password123", name: "Ananya Clone", role: "CUSTOMER", address: "123 Street" },
  });
  record("Signup", "Duplicate email returns 409 ACCOUNT_EXISTS", 409, r1_11, "ACCOUNT_EXISTS");

  // -------------------------------------------------------------
  // SUITE 2: /api/auth/login Input Validation
  // -------------------------------------------------------------
  console.log("\n[Suite 2] Testing /api/auth/login input validation...");

  // 2.1 Malformed JSON
  const r2_1 = await apiRequest("/api/auth/login", {
    method: "POST",
    rawBody: "invalid-json",
  });
  record("Login", "Malformed JSON body returns 400", 400, r2_1, "VALIDATION_ERROR");

  // 2.2 Missing password
  const r2_2 = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { email: "ananya@gmail.com" },
  });
  record("Login", "Missing password returns 400", 400, r2_2, "VALIDATION_ERROR");

  // 2.3 Missing email
  const r2_3 = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { password: "password123" },
  });
  record("Login", "Missing email returns 400", 400, r2_3, "VALIDATION_ERROR");

  // 2.4 Non-existent email -> 401 with generic message
  const r2_4 = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { email: "nonexistent@gmail.com", password: "password123" },
  });
  record("Login", "Non-existent user returns generic 401 INVALID_CREDENTIALS", 401, r2_4, "INVALID_CREDENTIALS");

  // 2.5 Wrong password -> 401 with generic message
  const r2_5 = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { email: "ananya@gmail.com", password: "wrongpassword" },
  });
  record("Login", "Wrong password returns generic 401 INVALID_CREDENTIALS", 401, r2_5, "INVALID_CREDENTIALS");

  // 2.6 SQL injection in login
  const r2_6 = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { email: "' OR '1'='1' --", password: "' OR '1'='1'" },
  });
  record("Login", "SQL injection in login returns generic 401 without 500 leak", 401, r2_6, "INVALID_CREDENTIALS");

  // -------------------------------------------------------------
  // SUITE 3: /api/customer Input Validation & Authorization
  // -------------------------------------------------------------
  console.log("\n[Suite 3] Testing /api/customer input validation & auth...");

  // 3.1 Unauthenticated
  const r3_1 = await apiRequest("/api/customer");
  record("Customer", "Unauthenticated request returns 401 UNAUTHORIZED", 401, r3_1, "UNAUTHORIZED");

  // 3.2 Authenticated as Professional -> 403
  const r3_2 = await apiRequest("/api/customer", { cookie: priyaCookie });
  record("Customer", "Professional accessing customer route returns 403 FORBIDDEN", 403, r3_2, "FORBIDDEN");

  // 3.3 Malformed id query param (string instead of int)
  const r3_3 = await apiRequest("/api/customer?id=notanid", { cookie: ananyaCookie });
  record("Customer", "Malformed id parameter returns 400", 400, r3_3, "VALIDATION_ERROR");

  // 3.4 Malformed id with SQL injection
  const r3_4 = await apiRequest("/api/customer?id=1;DROP%20TABLE%20users;", { cookie: ananyaCookie });
  record("Customer", "SQL injection in id returns 400", 400, r3_4, "VALIDATION_ERROR");

  // 3.5 Malformed email query param
  const r3_5 = await apiRequest("/api/customer?email=not-an-email", { cookie: ananyaCookie });
  record("Customer", "Malformed email parameter returns 400", 400, r3_5, "VALIDATION_ERROR");

  // 3.6 Cross-customer access attempt
  const r3_6 = await apiRequest("/api/customer?email=arya@gmail.com", { cookie: ananyaCookie });
  record("Customer", "Cross-customer access attempt returns 403 FORBIDDEN", 403, r3_6, "FORBIDDEN");

  // -------------------------------------------------------------
  // SUITE 4: /api/professionals/[id]/calendar Input Validation
  // -------------------------------------------------------------
  console.log("\n[Suite 4] Testing /api/professionals/:id/calendar input validation...");

  // 4.1 Unauthenticated
  const r4_1 = await apiRequest("/api/professionals/15/calendar?date=2026-08-26");
  record("Calendar", "Unauthenticated request returns 401 UNAUTHORIZED", 401, r4_1, "UNAUTHORIZED");

  // 4.2 Malformed professional id (not a positive int)
  const r4_2 = await apiRequest("/api/professionals/abc/calendar?date=2026-08-26", { cookie: ananyaCookie });
  record("Calendar", "Non-numeric professional ID returns 400", 400, r4_2, "VALIDATION_ERROR");

  // 4.3 Negative professional id
  const r4_3 = await apiRequest("/api/professionals/-5/calendar?date=2026-08-26", { cookie: ananyaCookie });
  record("Calendar", "Negative professional ID returns 400", 400, r4_3, "VALIDATION_ERROR");

  // 4.4 Missing date param
  const r4_4 = await apiRequest("/api/professionals/19/calendar", { cookie: ananyaCookie });
  record("Calendar", "Missing date query param returns 400", 400, r4_4, "VALIDATION_ERROR");

  // 4.5 Malformed date string (not YYYY-MM-DD)
  const r4_5 = await apiRequest("/api/professionals/19/calendar?date=tomorrow", { cookie: ananyaCookie });
  record("Calendar", "Malformed date string returns 400", 400, r4_5, "VALIDATION_ERROR");

  // 4.6 Impossible calendar date (Feb 31)
  const r4_6 = await apiRequest("/api/professionals/19/calendar?date=2026-02-31", { cookie: ananyaCookie });
  record("Calendar", "Impossible date (2026-02-31) rejected with 400", 400, r4_6, "VALIDATION_ERROR");

  // 4.7 SQL injection in date
  const r4_7 = await apiRequest("/api/professionals/19/calendar?date=2026-08-26';DROP%20TABLE", { cookie: ananyaCookie });
  record("Calendar", "SQL injection in date param rejected with 400", 400, r4_7, "VALIDATION_ERROR");

  // 4.8 Non-existent professional
  const r4_8 = await apiRequest("/api/professionals/99999/calendar?date=2026-08-26", { cookie: ananyaCookie });
  record("Calendar", "Non-existent professional ID returns 404 NOT_FOUND", 404, r4_8, "NOT_FOUND");

  // -------------------------------------------------------------
  // SUITE 5: /api/bookings/[bookingId]/rebook Input Validation
  // -------------------------------------------------------------
  console.log("\n[Suite 5] Testing /api/bookings/:id/rebook input validation...");

  // Get a valid booking for Ananya
  const custRes = await apiRequest("/api/customer", { cookie: ananyaCookie });
  const ananyaCompleted = custRes.json?.bookings?.find((b: any) => b.status === "COMPLETED");
  const validBookingId = ananyaCompleted.id;

  // 5.1 Unauthenticated
  const r5_1 = await apiRequest(`/api/bookings/${validBookingId}/rebook`, {
    method: "POST",
    body: { date: "2026-08-30", time: "09:00 AM" },
  });
  record("Rebook", "Unauthenticated request returns 401 UNAUTHORIZED", 401, r5_1, "UNAUTHORIZED");

  // 5.2 Malformed booking ID
  const r5_2 = await apiRequest("/api/bookings/invalid-id/rebook", {
    method: "POST",
    cookie: ananyaCookie,
    body: { date: "2026-08-30", time: "09:00 AM" },
  });
  record("Rebook", "Malformed booking ID returns 400", 400, r5_2, "VALIDATION_ERROR");

  // 5.3 Non-existent booking ID
  const r5_3 = await apiRequest("/api/bookings/99999/rebook", {
    method: "POST",
    cookie: ananyaCookie,
    body: { date: "2026-08-30", time: "09:00 AM" },
  });
  record("Rebook", "Non-existent booking ID returns 404 NOT_FOUND", 404, r5_3, "NOT_FOUND");

  // 5.4 Malformed date
  const r5_4 = await apiRequest(`/api/bookings/${validBookingId}/rebook`, {
    method: "POST",
    cookie: ananyaCookie,
    body: { date: "2026-02-31", time: "09:00 AM" },
  });
  record("Rebook", "Impossible date (2026-02-31) returns 400", 400, r5_4, "VALIDATION_ERROR");

  // 5.5 Invalid / unknown slot time
  const r5_5 = await apiRequest(`/api/bookings/${validBookingId}/rebook`, {
    method: "POST",
    cookie: ananyaCookie,
    body: { date: "2026-08-30", time: "12:00 PM" },
  });
  record("Rebook", "Non-standard slot time ('12:00 PM') returns 400", 400, r5_5, "VALIDATION_ERROR");

  // 5.6 Malformed JSON body
  const r5_6 = await apiRequest(`/api/bookings/${validBookingId}/rebook`, {
    method: "POST",
    cookie: ananyaCookie,
    rawBody: "not a json string",
  });
  record("Rebook", "Malformed JSON body returns 400", 400, r5_6, "VALIDATION_ERROR");

  // -------------------------------------------------------------
  // SUITE 6: CONCURRENCY / DOUBLE-BOOKING AIRTIGHT CHECK
  // -------------------------------------------------------------
  console.log("\n[Suite 6] Testing concurrent double-booking race condition...");

  // Pick a fresh slot that is currently OPEN on Priya's calendar:
  // e.g. 2026-08-30 at 07:00 PM
  const concurrentDate = "2026-08-30";
  const concurrentTime = "07:00 PM";

  // Fire two near-simultaneous rebook requests for the same slot with Ananya
  const [resA, resB] = await Promise.all([
    apiRequest(`/api/bookings/${validBookingId}/rebook`, {
      method: "POST",
      cookie: ananyaCookie,
      body: { date: concurrentDate, time: concurrentTime },
    }),
    apiRequest(`/api/bookings/${validBookingId}/rebook`, {
      method: "POST",
      cookie: ananyaCookie,
      body: { date: concurrentDate, time: concurrentTime },
    }),
  ]);

  const statuses = [resA.status, resB.status].sort();
  const concurrencyPassed = statuses[0] === 201 && statuses[1] === 409;

  testResults.push({
    suite: "Concurrency",
    test: "Two simultaneous requests for same slot: exactly one 201 Created and one 409 Conflict",
    expectedStatus: 201,
    actualStatus: statuses[0],
    expectedCode: "SLOT_CONFLICT",
    actualCode: resA.status === 409 ? resA.json?.code : resB.json?.code,
    passed: concurrencyPassed,
    notes: `ReqA Status: ${resA.status}, ReqB Status: ${resB.status}`,
  });

  // Verify only 1 booking exists in the database for this slot
  const proId = ananyaCompleted.professionalId;
  const bookingsInDb = await db.orm.public.Booking
    .where({ professionalId: proId })
    .all();

  const slotBookings = bookingsInDb.filter(
    (b) =>
      b.status !== "CANCELLED" &&
      new Date(b.bookingDate).toISOString().includes("2026-08-30T13:30:00") // 07:00 PM IST is 13:30 UTC
  );

  testResults.push({
    suite: "Concurrency",
    test: "Database level verification: Exactly 1 record created in database for the slot",
    expectedStatus: 1,
    actualStatus: slotBookings.length,
    passed: slotBookings.length === 1,
    notes: `Found ${slotBookings.length} booking(s) in database`,
  });

  // -------------------------------------------------------------
  // REPORT
  // -------------------------------------------------------------
  console.log("\n=======================================================");
  console.log("             COMPREHENSIVE TEST RESULTS                ");
  console.log("=======================================================");

  let totalPassed = 0;
  for (const r of testResults) {
    const mark = r.passed ? "PASS" : "FAIL";
    if (r.passed) totalPassed++;
    console.log(`[${mark}] [${r.suite}] ${r.test}`);
    if (!r.passed) {
      console.log(`       Expected: Status ${r.expectedStatus}, Code: ${r.expectedCode || 'any'}`);
      console.log(`       Actual:   Status ${r.actualStatus}, Code: ${r.actualCode || 'none'}`);
      if (r.notes) console.log(`       Notes:    ${r.notes}`);
    }
  }

  console.log(`\nTOTAL: ${totalPassed}/${testResults.length} PASSED`);

  await db.close();

  if (totalPassed !== testResults.length) {
    process.exit(1);
  }
}

runAll().catch(async (err) => {
  console.error("Test runner failed:", err);
  await db.close();
  process.exit(1);
});
