"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      if (redirectPath) {
        router.push(redirectPath);
      } else if (data.user.role === "PROFESSIONAL") {
        router.push("/professional");
      } else {
        router.push("/customer");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (quickEmail: string) => {
    setEmail(quickEmail);
    setPassword("password123");
  };

  return (
    <div className="auth-shell">
      <Link href="/" className="auth-logo-row">
        <span className="auth-logo-mark">U</span>
        <span className="auth-logo-name">Urban Company</span>
      </Link>

      <div className="auth-card">
        <h1 className="auth-card-title">Welcome back</h1>
        <p className="auth-card-sub">
          Don&apos;t have an account?{" "}
          <Link href="/signup">Create one now</Link>
        </p>

        {error && (
          <div className="auth-error">
            <svg className="auth-error-icon" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="auth-demo-box">
          <div className="auth-demo-label">Demo accounts — password: password123</div>
          <div className="auth-demo-grid">
            <button type="button" onClick={() => handleQuickLogin("ananya@gmail.com")} className="auth-demo-btn">
              <span className="auth-demo-name">Ananya Sharma</span>
              <span className="auth-demo-role">Customer</span>
            </button>
            <button type="button" onClick={() => handleQuickLogin("arya@gmail.com")} className="auth-demo-btn">
              <span className="auth-demo-name">Arya Kumar</span>
              <span className="auth-demo-role">Customer</span>
            </button>
            <button type="button" onClick={() => handleQuickLogin("priya@gmail.com")} className="auth-demo-btn">
              <span className="auth-demo-name">Priya S.</span>
              <span className="auth-demo-role">Professional</span>
            </button>
            <button type="button" onClick={() => handleQuickLogin("rahul@gmail.com")} className="auth-demo-btn">
              <span className="auth-demo-name">Rahul M.</span>
              <span className="auth-demo-role">Professional</span>
            </button>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="email" className="auth-label">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              placeholder="name@example.com"
            />
          </div>
          <div className="auth-field">
            <label htmlFor="password" className="auth-label">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loading} className="auth-submit">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="auth-shell">
        <div className="auth-card" style={{ textAlign: "center", color: "var(--uc-text-secondary)" }}>Loading…</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
