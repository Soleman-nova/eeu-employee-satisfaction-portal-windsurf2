import React, { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function ThankYouPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate('/', { replace: true }), 10000)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-10">
      <div className="relative w-full max-w-3xl">
        {/* Background subtle particles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute w-40 h-40 bg-green-100 rounded-full opacity-40 blur-3xl -top-10 -left-10 animate-pulse" />
          <div className="absolute w-32 h-32 bg-green-50 rounded-full opacity-50 blur-2xl bottom-0 right-0 animate-[ping_6s_ease-in-out_infinite]" />
          <div className="absolute w-24 h-24 bg-green-50 rounded-full opacity-60 blur-2xl top-1/2 -translate-y-1/2 right-1/3 animate-[pulse_7s_ease-in-out_infinite]" />
        </div>

        <div className="relative bg-white border border-gray-200 rounded-2xl shadow-[0_4px_20px_rgba(60,64,67,0.18)] overflow-hidden">
          {/* Header logo */}
          <div className="pt-8 flex justify-center">
            <div className="flex items-center justify-center">
              <div className="w-10 h-10 rounded-full border-2 border-[#FF6200] flex items-center justify-center mr-2">
                <div className="w-6 h-6 rounded-full border-2 border-[#008000]" />
              </div>
              <span className="text-xs font-medium tracking-wide text-[#5F6368] uppercase">Ethiopian Electric Utility</span>
            </div>
          </div>

          {/* Main content */}
          <div className="px-6 sm:px-12 pb-10 pt-6 text-center">
            {/* Check icon */}
            <div className="mx-auto mb-5 flex items-center justify-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white border-4 border-[#006400] flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
                <svg
                  className="w-8 h-8 sm:w-10 sm:h-10 text-[#006400]"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M9.00039 16.2002L4.80039 12.0002L3.40039 13.4002L9.00039 19.0002L21.0004 7.0002L19.6004 5.6002L9.00039 16.2002Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#5F6368] mb-2">
              Your response has been recorded.
            </h1>

            {/* Accent line */}
            <div className="mx-auto mb-4 h-1 w-24 rounded-full bg-[#FF6200]" />

            {/* Subtext */}
            <p className="text-sm sm:text-base text-[#3C4043] max-w-xl mx-auto mb-6 leading-relaxed">
              Thank you for helping shape the future of Ethiopian Electric Utility! Your feedback is invaluable in improving our
              services and workplace experience.
            </p>

            {/* Secondary muted line (like Google Forms style) */}
            <p className="text-xs text-[#5F6368] mb-8">
              You can close this window, or submit another response below. You will be redirected to the home page shortly.
            </p>

            {/* Button */}
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-full bg-[#1A7F37] px-6 sm:px-8 py-2.5 text-sm sm:text-base font-medium text-white shadow-[0_2px_6px_rgba(0,0,0,0.2)] hover:bg-[#186b30] transition-colors"
              >
                Submit another response
              </Link>

              <span className="text-xs text-[#5F6368]">Automatically returning home in a few seconds…</span>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-[#DADCE0] bg-[#F8F9FA] px-4 py-3 text-center">
            <p className="text-[11px] text-[#5F6368]">
              © 2025 Ethiopian Electric Utility • Powered by secure internal system
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
