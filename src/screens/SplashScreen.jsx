// ── SPLASH SCREEN ─────────────────────────────────────────
// Shown for 2 seconds on first launch
// Sets the premium tone for the product

import { useEffect } from 'react'

export default function SplashScreen({ onDone }) {
  useEffect(() => {
      const timer = setTimeout(onDone, 2000)
          return () => clearTimeout(timer)
            }, [onDone])

              return (
                  <div
                        className="fixed inset-0 flex flex-col items-center justify-center bg-gray-950 z-[200]"
                              onClick={onDone}
                                  >
                                        {/* Logo */}
                                              <div className="flex flex-col items-center gap-4">
                                                      <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-900">
                                                                <span className="text-5xl">⬡</span>
                                                                        </div>

                                                                                <div className="text-center">
                                                                                          <h1 className="text-4xl font-bold text-white tracking-tight">
                                                                                                      Ryzo
                                                                                                                </h1>
                                                                                                                          <p className="text-indigo-400 text-base mt-1 tracking-widest uppercase text-xs font-semibold">
                                                                                                                                      Sheets
                                                                                                                                                </p>
                                                                                                                                                        </div>
                                                                                                                                                              </div>

                                                                                                                                                                    {/* Tagline */}
                                                                                                                                                                          <p className="text-gray-500 text-sm mt-8 text-center px-8">
                                                                                                                                                                                  The spreadsheet built for touch
                                                                                                                                                                                        </p>

                                                                                                                                                                                              {/* Loading dots */}
                                                                                                                                                                                                    <div className="flex gap-2 mt-12">
                                                                                                                                                                                                            {[0, 1, 2].map(i => (
                                                                                                                                                                                                                      <div
                                                                                                                                                                                                                                  key={i}
                                                                                                                                                                                                                                              className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"
                                                                                                                                                                                                                                                          style={{ animationDelay: `${i * 0.15}s` }}
                                                                                                                                                                                                                                                                    />
                                                                                                                                                                                                                                                                            ))}
                                                                                                                                                                                                                                                                                  </div>

                                                                                                                                                                                                                                                                                        <p className="text-gray-700 text-xs mt-8">Tap to continue</p>
                                                                                                                                                                                                                                                                                            </div>
                                                                                                                                                                                                                                                                                              )
                                                                                                                                                                                                                                                                                              }