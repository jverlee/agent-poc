"use client";

import { createClient } from "@/lib/supabase/client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

type Step = 0 | 1 | 2 | 3;

function LoginFlow() {
  const [step, setStep] = useState<Step>(0);
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite_token");
  const authError = searchParams.get("error");

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);

    // Save onboarding data to sessionStorage before OAuth redirect
    sessionStorage.setItem("onboarding_phone", phone);
    sessionStorage.setItem("onboarding_company_website", website);

    const supabase = createClient();
    const redirectTo = inviteToken
      ? `${window.location.origin}/auth/callback?invite_token=${inviteToken}`
      : `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  const cardClass =
    "w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 p-8";

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-zinc-950">
      {/* Back button for steps 1-3 */}
      {step > 0 && (
        <button
          onClick={() => setStep((step - 1) as Step)}
          className="absolute left-8 top-8 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          &larr; Back
        </button>
      )}

      {/* Step 0: Landing */}
      {step === 0 && (
        <div className={cardClass}>
          <h1 className="mb-2 text-center text-2xl font-semibold text-zinc-100">
            Workmate
          </h1>
          <p className="mb-8 text-center text-sm text-zinc-500">
            Your AI-powered development companion
          </p>
          <button
            onClick={() => setStep(1)}
            className="w-full rounded-md bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-white"
          >
            Launch your first workmate
          </button>
        </div>
      )}

      {/* Step 1: Phone number */}
      {step === 1 && (
        <div className={cardClass}>
          <h1 className="mb-2 text-center text-2xl font-semibold text-zinc-100">
            What&apos;s your phone number?
          </h1>
          <p className="mb-6 text-center text-sm text-zinc-500">
            We&apos;ll use this to keep you updated
          </p>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
            autoFocus
            className="mb-4 w-full rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
          />
          <button
            onClick={() => setStep(2)}
            disabled={!phone.trim()}
            className="w-full rounded-md bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2: Company website */}
      {step === 2 && (
        <div className={cardClass}>
          <h1 className="mb-2 text-center text-2xl font-semibold text-zinc-100">
            What&apos;s your company website?
          </h1>
          <p className="mb-6 text-center text-sm text-zinc-500">
            Help us personalize your experience
          </p>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.com"
            autoFocus
            className="mb-4 w-full rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
          />
          <button
            onClick={() => setStep(3)}
            disabled={!website.trim()}
            className="w-full rounded-md bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 3: Google OAuth */}
      {step === 3 && (
        <div className={cardClass}>
          <h1 className="mb-2 text-center text-2xl font-semibold text-zinc-100">
            Create your account
          </h1>
          <p className="mb-8 text-center text-sm text-zinc-500">
            {inviteToken
              ? "Sign in to accept your invitation"
              : "Sign in with Google to get started"}
          </p>

          {(error || authError) && (
            <div className="mb-4 rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error || authError?.replace(/_/g, " ")}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-md bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {loading ? "Signing in..." : "Continue with Google"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginFlow />
    </Suspense>
  );
}
