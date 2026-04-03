"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ onClose, onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendOtp() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, next: window.location.href }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) { setError(data.error); return; }
    setStep("otp");
  }

  async function verifyOtp() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, token: otp }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) { setError(data.error); return; }

    // Refresh the client session
    const supabase = createClient();
    await supabase.auth.getSession();
    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-8">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#555] hover:text-white transition-colors text-lg"
        >✕</button>

        {/* Logo */}
        <div className="mb-6">
          <div className="text-[#00ff41] font-mono text-xl font-bold mb-1">HACKUGC</div>
          <div className="text-white font-mono text-sm">
            {step === "email" ? "Sign in to continue" : "Check your email"}
          </div>
        </div>

        {step === "email" ? (
          <>
            <p className="text-[#555] text-sm font-mono mb-6">
              Enter your email — we'll send you a magic link. No password needed.
            </p>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && email && sendOtp()}
              className="w-full bg-black border border-[#1a1a1a] text-white font-mono px-4 py-3 rounded text-sm outline-none focus:border-[#00ff41] transition-colors mb-4 placeholder:text-[#333]"
            />
            {error && <p className="text-red-500 text-xs font-mono mb-4">{error}</p>}
            <button
              onClick={sendOtp}
              disabled={!email || loading}
              className="w-full bg-[#00ff41] text-black font-mono font-bold py-3 rounded text-sm hover:bg-[#00cc33] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "SENDING..." : "SEND LINK →"}
            </button>
          </>
        ) : (
          <>
            <p className="text-[#555] text-sm font-mono mb-2">
              We sent a magic link to
            </p>
            <p className="text-white text-sm font-mono mb-6">{email}</p>
            <p className="text-[#555] text-xs font-mono mb-6">
              Click the link in your email to sign in. You can close this.
            </p>
            <button
              onClick={() => { setStep("email"); setError(""); }}
              className="w-full mt-1 text-[#555] font-mono text-xs hover:text-white transition-colors"
            >
              ← use a different email
            </button>
          </>
        )}
      </div>
    </div>
  );
}
