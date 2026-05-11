// ── UPGRADE SCREEN ────────────────────────────────────────
// Full screen upgrade page with email waitlist capture

import { useState } from 'react'
import { useTheme } from '../theme'

export default function UpgradeScreen({ onBack }) {
  const { isDark } = useTheme()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | success | error
  const [selectedPlan, setSelectedPlan] = useState('annual')

  const bg = isDark ? 'bg-gray-950' : 'bg-gray-50'
  const headerBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
  const cardBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
  const text = isDark ? 'text-white' : 'text-gray-900'
  const subtext = isDark ? 'text-gray-400' : 'text-gray-500'
  const inputBg = isDark
    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
    : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'

  const features = [
    { icon: '📊', text: 'Unlimited sheets' },
    { icon: '♾️', text: 'Unlimited rows per sheet' },
    { icon: '📥', text: 'Import CSV files' },
    { icon: '📤', text: 'Export to Excel (.xlsx)' },
    { icon: '🔄', text: 'Sync across all devices' },
    { icon: '🧮', text: 'Advanced formulas' },
    { icon: '⚡', text: 'Priority support' },
    { icon: '🔒', text: 'Your data encrypted & backed up' },
  ]

  const plans = [
    {
      id: 'monthly',
      label: 'Monthly',
      sublabel: 'Billed monthly',
      badge: null
    },
    {
      id: 'annual',
      label: 'Annual',
      sublabel: 'Billed once a year',
      badge: 'BEST VALUE'
    }
  ]

  async function handleSubmit() {
    if (!email.trim() || !email.includes('@')) return

    setStatus('sending')

    try {
      const response = await fetch('https://formspree.io/f/mojkywnn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: email.trim(),
          plan: selectedPlan,
          source: 'Ryzo Sheets App',
          timestamp: new Date().toISOString()
        })
      })

      if (response.ok) {
        setStatus('success')
        setEmail('')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className={`min-h-screen ${bg} ${text} flex flex-col`}>

      {/* Header */}
      <div className={`${headerBg} border-b px-4 py-4 flex items-center gap-3`}>
        <button
          onClick={onBack}
          className={`${subtext} text-2xl w-10 h-10 flex items-center justify-center`}
        >←</button>
        <h1 className="font-bold text-base">Upgrade to Pro</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">

        {/* Hero */}
        <div className="text-center space-y-2">
          <div className="text-6xl">⬡</div>
          <h2 className="text-2xl font-bold">Ryzo Pro</h2>
          <p className={`${subtext} text-sm`}>
            Everything you need to work faster on mobile
          </p>
        </div>

        {/* Features */}
        <div className={`${cardBg} border rounded-2xl p-5 space-y-4`}>
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xl">{f.icon}</span>
              <span className="text-sm flex-1">{f.text}</span>
              <span className="text-green-400 font-bold">✓</span>
            </div>
          ))}
        </div>

        {/* Plan selector */}
        <div className="space-y-2">
          <p className={`${subtext} text-xs font-medium uppercase tracking-wide`}>
            Choose your plan
          </p>
          <div className="grid grid-cols-2 gap-3">
            {plans.map(plan => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`${cardBg} border rounded-2xl p-4 text-left transition-all ${
                  selectedPlan === plan.id
                    ? 'border-indigo-500 bg-indigo-950'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <p className="font-semibold text-sm">{plan.label}</p>
                  {plan.badge && (
                    <span className="bg-green-900 text-green-300 text-xs px-1.5 py-0.5 rounded-full font-semibold">
                      {plan.badge}
                    </span>
                  )}
                </div>
                <p className={`${subtext} text-xs mt-1`}>{plan.sublabel}</p>
                {selectedPlan === plan.id && (
                  <div className="mt-2 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Email capture */}
        <div className={`${cardBg} border rounded-2xl p-5 space-y-4`}>
          <div>
            <h3 className="font-bold text-base">Join the Early Access Waitlist</h3>
            <p className={`${subtext} text-sm mt-1`}>
              Be first to know when Pro launches. Early access members get a special launch price.
            </p>
          </div>

          {status === 'success' ? (
            <div className="bg-green-950 border border-green-800 rounded-xl p-4 text-center space-y-2">
              <div className="text-3xl">🎉</div>
              <p className="text-green-300 font-semibold">You're on the list!</p>
              <p className="text-green-500 text-sm">
                We'll email you the moment Pro launches with your exclusive early access price.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className={`w-full ${inputBg} rounded-xl px-4 py-4 text-base outline-none border focus:border-indigo-500`}
              />

              <button
                onClick={handleSubmit}
                disabled={status === 'sending' || !email.trim()}
                className={`w-full font-bold py-4 rounded-xl text-base transition-all ${
                  status === 'sending' || !email.trim()
                    ? 'bg-gray-700 text-gray-500'
                    : 'bg-indigo-600 text-white active:bg-indigo-700'
                }`}
              >
                {status === 'sending' ? 'Joining...' : `Join Waitlist — ${selectedPlan === 'annual' ? 'Annual' : 'Monthly'} Plan`}
              </button>

              {status === 'error' && (
                <p className="text-red-400 text-sm text-center">
                  Something went wrong. Please try again.
                </p>
              )}

              <p className={`${subtext} text-xs text-center`}>
                No spam. No credit card. Just early access.
              </p>
            </div>
          )}
        </div>

        {/* Social proof placeholder */}
        <div className="text-center pb-6">
          <p className={`${subtext} text-xs`}>
            Built for field workers, sales reps, and anyone who lives in spreadsheets on mobile.
          </p>
        </div>

      </div>
    </div>
  )
}