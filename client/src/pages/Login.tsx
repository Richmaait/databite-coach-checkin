import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ERROR_MESSAGES: Record<string, string> = {
  google_denied: "Google sign-in was cancelled. Please try again.",
  google_token_failed: "Could not complete Google sign-in. Please try again.",
  google_userinfo_failed: "Could not get your account info from Google. Please try again.",
  google_failed: "Something went wrong with Google sign-in. Please try again.",
  no_email: "Could not get your email from Google. Please try again.",
  not_approved: "Your email is not approved for this app. Contact your manager.",
  db_unavailable: "The system is temporarily unavailable. Please try again later.",
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    if (errorParam) {
      setError(ERROR_MESSAGES[errorParam] || "Something went wrong. Please try again.");
      // Clean URL
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      window.location.href = "/";
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-violet-500/10 blur-[100px] rounded-full" />
      </div>
      <div className="w-full max-w-sm space-y-6 text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 relative z-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">Coach Check-In</h1>
          <p className="mt-2 text-sm text-white/50">
            Sign in to continue
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <div className="space-y-4">
          <Button
            onClick={() => { window.location.href = "/api/auth/google"; }}
            className="w-full bg-white hover:bg-gray-100 text-gray-900 font-medium gap-3"
            size="lg"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </Button>

          {!showEmailLogin && (
            <button
              onClick={() => setShowEmailLogin(true)}
              className="text-sm text-white/30 hover:text-white/60 transition-colors"
            >
              Or sign in with email instead
            </button>
          )}

          {showEmailLogin && (
            <form onSubmit={handleLogin} className="space-y-4 pt-2 border-t border-white/10">
              <Input
                type="email"
                placeholder="you@databite.com.au"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/5 border border-white/10 text-white/80 placeholder:text-white/30 rounded-xl"
              />

              <Button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl"
              >
                {loading ? "Signing in..." : "Sign in with email"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
