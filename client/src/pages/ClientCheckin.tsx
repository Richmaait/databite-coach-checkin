import { useState } from "react";
import { trpc } from "@/lib/trpc";

const DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

export default function ClientCheckin() {
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState<{
    clientName: string;
    coachName: string;
    dayOfWeek: string;
    alreadySubmitted: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkinMutation = trpc.clientCheckins.clientSelfCheckin.useMutation({
    onSuccess: (data) => {
      setSubmitted(data);
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
      setSubmitted(null);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setSubmitted(null);
    checkinMutation.mutate({ clientName: name.trim() });
  }

  // Get Melbourne day/date for display
  const melbNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Australia/Melbourne" }),
  );
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const todayLabel = `${dayNames[melbNow.getDay()]}, ${melbNow.getDate()} ${monthNames[melbNow.getMonth()]}`;
  const isWeekend = melbNow.getDay() === 0 || melbNow.getDay() === 6;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-6">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-violet-500/5 blur-[128px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-fuchsia-500/5 blur-[128px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/databite-wordmark.png"
            alt="Databite"
            className="h-8 brightness-0 invert opacity-80 mx-auto mb-3"
          />
          <h1 className="text-2xl font-bold text-white/90">
            Client Check-In
          </h1>
          <p className="text-sm text-white/40 mt-1">{todayLabel}</p>
        </div>

        {isWeekend ? (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4">&#127774;</div>
            <h2 className="text-lg font-semibold text-white/80 mb-2">
              It&apos;s the weekend!
            </h2>
            <p className="text-sm text-white/40">
              Check-ins are available Monday to Friday. Enjoy your time off.
            </p>
          </div>
        ) : submitted ? (
          <div className="bg-white/5 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
              <svg
                className="w-8 h-8 text-emerald-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-emerald-200 mb-2">
              {submitted.alreadySubmitted
                ? "Already Checked In!"
                : "Check-In Complete!"}
            </h2>
            <p className="text-sm text-white/50 mb-4">
              {submitted.alreadySubmitted
                ? `You've already checked in for ${DAY_LABELS[submitted.dayOfWeek] ?? submitted.dayOfWeek}.`
                : `Thanks ${submitted.clientName.split(" ")[0]}! Your ${DAY_LABELS[submitted.dayOfWeek] ?? submitted.dayOfWeek} check-in has been recorded.`}
            </p>
            <p className="text-xs text-white/30">
              Coach: {submitted.coachName}
            </p>
            <button
              onClick={() => {
                setSubmitted(null);
                setName("");
              }}
              className="mt-6 text-sm text-violet-400 hover:text-violet-300 transition-colors"
            >
              Submit another check-in
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8"
          >
            <p className="text-sm text-white/50 mb-6">
              Enter your name below to confirm your check-in for today.
            </p>

            <div className="mb-5">
              <label
                htmlFor="clientName"
                className="block text-xs text-white/40 uppercase tracking-wider font-medium mb-2"
              >
                Your Name
              </label>
              <input
                id="clientName"
                type="text"
                placeholder="e.g. John Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base text-white/90 placeholder-white/20 outline-none focus:border-violet-500/40 focus:bg-white/[0.07] transition-all"
              />
            </div>

            {error && (
              <div className="mb-5 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!name.trim() || checkinMutation.isPending}
              className="w-full py-3.5 rounded-xl font-semibold text-base transition-all
                bg-gradient-to-r from-violet-500 to-fuchsia-500
                hover:from-violet-400 hover:to-fuchsia-400
                disabled:opacity-40 disabled:cursor-not-allowed
                text-white shadow-lg shadow-violet-500/20"
            >
              {checkinMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Checking in...
                </span>
              ) : (
                "Check In"
              )}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-white/20 mt-6">
          Databite Coaching
        </p>
      </div>
    </div>
  );
}
