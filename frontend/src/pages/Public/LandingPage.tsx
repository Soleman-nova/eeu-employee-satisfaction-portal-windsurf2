import React from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '@/context/I18nContext'


export default function LandingPage() {
  const { t } = useI18n()
  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-white">
      {/* Background image */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "url('/landing-bg.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.28,
        }}
      />

      {/* Subtle Ethiopian pattern border */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(transparent 97%, rgba(0,100,0,0.06) 100%),
                            linear-gradient(90deg, transparent 97%, rgba(0,100,0,0.06) 100%)`,
          backgroundSize: '32px 32px, 32px 32px',
          maskImage: 'linear-gradient(black, black)',
          WebkitMaskImage: 'linear-gradient(black, black)'
        }}></div>
        {/* faint decorative border frame */}
        <div className="absolute inset-4 rounded-3xl border" style={{ borderColor: 'rgba(0,100,0,0.12)' }}></div>
      </div>

      {/* Animated energy waves */}
      <div className="absolute -inset-x-1 -top-32 h-72 blur-2xl opacity-30">
        <div className="w-full h-full" style={{
          background: 'radial-gradient(60% 100% at 50% 0%, rgba(0,100,0,0.6), rgba(0,100,0,0) 60%)'
        }}></div>
      </div>
      <div className="absolute -inset-x-1 top-32 h-80 blur-2xl opacity-25 animate-pulse">
        <div className="w-full h-full" style={{
          background: 'radial-gradient(60% 120% at 50% 0%, rgba(255,98,0,0.5), rgba(255,98,0,0) 60%)'
        }}></div>
      </div>

      {/* Floating particles */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 22 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              width: 6,
              height: 6,
              left: `${(i * 137) % 100}%`,
              top: `${(i * 73) % 100}%`,
              background: i % 3 === 0 ? '#FF6200' : 'rgba(0,100,0,0.8)',
              opacity: 0.15,
              transform: 'translate(-50%, -50%)',
              animation: `floatY ${10 + (i % 5)}s ease-in-out ${(i % 7)}s infinite alternate`
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative mx-auto max-w-6xl px-6 py-16 grid place-items-center text-center">
        {/* Logo */}
        <img src="/eeu_logo.png" alt="EEU logo" className="w-34 h-28 md:w-34 md:h-28 drop-shadow-sm" />

        {/* Headline */}
        <h1 className="mt-6 text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight" style={{ color: '#064d06' }}>
          {t('landing.headline')}
        </h1>
        <p className="mt-3 max-w-3xl text-base md:text-lg" style={{ color: 'rgba(6,77,6,0.8)' }}>
          {t('landing.subheadline')}
        </p>

        {/* CTA */}
        <div className="mt-8">
          <Link
            to="/survey"
            className="inline-block rounded-full px-8 py-3 text-white font-semibold shadow-lg border-2 focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{
              backgroundColor: '#FF6200',
              borderColor: '#006400',
              boxShadow: '0 0 24px rgba(255,98,0,0.35)'
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 36px rgba(255,98,0,0.5)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 24px rgba(255,98,0,0.35)' }}
            aria-label={t('landing.cta_aria')}
          >
            {t('landing.cta')}
          </Link>
        </div>

        {/* Card container hint for clean, minimalist feel */}
        <div className="mt-12 w-full max-w-4xl mx-auto rounded-3xl bg-white/70 backdrop-blur border" style={{ borderColor: 'rgba(0,100,0,0.12)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
          <div className="px-6 md:px-10 py-6 md:py-8 text-left">
            <h3 className="text-lg md:text-xl font-semibold" style={{ color: '#064d06' }}>{t('landing.section_title')}</h3>
            <p className="mt-2 text-sm md:text-base text-gray-700">
              {t('landing.section_body')}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative mt-10">
        <div className="w-full py-6 text-center" style={{ backgroundColor: '#064d06', color: '#ffffff' }}>
          {t('landing.footer')}
        </div>
      </footer>

      {/* Local styles for floating animation */}
      <style>
        {`
          @keyframes floatY { from { transform: translate(-50%, -55%); } to { transform: translate(-50%, -45%); } }
        `}
      </style>
    </div>
  )
}
