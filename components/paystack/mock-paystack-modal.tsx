"use client";

import { useState, useRef, useEffect } from "react";

interface MockPaystackModalProps {
  email: string;
  amount: number; // in cents/kobo
  reference: string;
  currency?: string;
  onSuccess: (reference: string) => void;
  onClose: () => void;
}

type Stage = "form" | "processing" | "success";

export function MockPaystackModal({
  email,
  amount,
  reference,
  currency = "USD",
  onSuccess,
  onClose,
}: MockPaystackModalProps) {
  const [stage, setStage] = useState<Stage>("form");
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardError, setCardError] = useState("");
  const cardRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  const displayAmount = (amount / 100).toFixed(2);
  const symbol = currency === "USD" ? "$" : currency;

  function formatCard(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  }

  function formatExpiry(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length > 2) return digits.slice(0, 2) + "/" + digits.slice(2);
    return digits;
  }

  function getCardType(number: string): string {
    const n = number.replace(/\s/g, "");
    if (n.startsWith("4")) return "visa";
    if (n.startsWith("5") || n.startsWith("2")) return "mastercard";
    if (n.startsWith("50") || n.startsWith("63") || n.startsWith("56")) return "verve";
    return "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = card.replace(/\s/g, "");
    if (digits.length < 16) {
      setCardError("Enter a valid 16-digit card number");
      return;
    }
    if (expiry.length < 5) {
      setCardError("Enter a valid expiry date");
      return;
    }
    if (cvv.length < 3) {
      setCardError("Enter a valid CVV");
      return;
    }
    setCardError("");
    setStage("processing");

    // Simulate payment processing delay
    setTimeout(() => {
      setStage("success");
      setTimeout(() => {
        onSuccess(reference);
      }, 1200);
    }, 2200);
  }

  const cardType = getCardType(card);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={stage === "form" ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#00c3f7] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <span className="text-white font-bold text-sm tracking-wide">Paystack</span>
            </div>
            {stage === "form" && (
              <button
                onClick={onClose}
                className="text-white/70 hover:text-white transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="mt-3">
            <p className="text-white/70 text-xs">{email}</p>
            <p className="text-white font-bold text-2xl mt-0.5">
              {symbol}{displayAmount}
            </p>
          </div>
        </div>

        {/* Test mode badge */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-amber-700 text-xs font-medium">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Test Mode — no real money charged
          </span>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {stage === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Card number */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">CARD NUMBER</label>
                <div className="relative">
                  <input
                    ref={cardRef}
                    type="text"
                    inputMode="numeric"
                    value={card}
                    onChange={(e) => setCard(formatCard(e.target.value))}
                    placeholder="0000 0000 0000 0000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c3f7] focus:border-transparent pr-10"
                  />
                  {cardType && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {cardType === "visa" && (
                        <span className="text-blue-700 font-bold text-xs italic tracking-wider">VISA</span>
                      )}
                      {cardType === "mastercard" && (
                        <span className="text-red-500 font-bold text-xs">MC</span>
                      )}
                      {cardType === "verve" && (
                        <span className="text-green-600 font-bold text-xs">VERVE</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Expiry + CVV */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">EXPIRY DATE</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    placeholder="MM/YY"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c3f7] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">CVV</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="•••"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c3f7] focus:border-transparent"
                  />
                </div>
              </div>

              {cardError && (
                <p className="text-red-500 text-xs">{cardError}</p>
              )}

              {/* Test cards hint */}
              <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-xs text-gray-500 space-y-0.5">
                <p className="font-medium text-gray-600">Test card numbers:</p>
                <p>4084 0840 8408 4081 — success</p>
                <p>5060 6666 6666 6666 — success (Verve)</p>
                <p>Expiry: any future date · CVV: any 3 digits</p>
              </div>

              <button
                type="submit"
                className="w-full bg-[#00c3f7] hover:bg-[#00aedd] text-white font-semibold py-3 rounded-lg transition-colors text-sm"
              >
                Pay {symbol}{displayAmount}
              </button>
            </form>
          )}

          {stage === "processing" && (
            <div className="py-8 flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-[#00c3f7]/20 border-t-[#00c3f7] animate-spin" />
              <div className="text-center">
                <p className="font-semibold text-gray-800">Processing payment…</p>
                <p className="text-sm text-gray-500 mt-1">Please do not close this window</p>
              </div>
            </div>
          )}

          {stage === "success" && (
            <div className="py-8 flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-800">Payment successful!</p>
                <p className="text-sm text-gray-500 mt-1">{symbol}{displayAmount} paid</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-4 flex items-center justify-center gap-1">
          <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <span className="text-xs text-gray-400">Secured by Paystack</span>
        </div>
      </div>
    </div>
  );
}
