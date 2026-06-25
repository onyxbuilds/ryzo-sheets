// PAYWALL — Shown when user hits free tier limit

import BottomSheet from './BottomSheet'

export default function Paywall({ message, onClose, userEmail }) {

  function handleUpgrade() {
    // TODO: wire Razorpay
  }

  return (
    <BottomSheet title="Upgrade to Pro" onClose={onClose}>
      <div className="space-y-6">

        <div className="bg-indigo-950 border border-indigo-800 rounded-2xl p-4">
          <p className="text-indigo-200 text-sm text-center leading-relaxed">
            {message}
          </p>
        </div>

        <div className="space-y-3">
          {[
            { icon: '📊', text: 'Unlimited sheets' },
            { icon: '♾️', text: 'Unlimited rows per sheet' },
            { icon: '📥', text: 'Import CSV files' },
            { icon: '📤', text: 'Export to Excel' },
            { icon: '🔄', text: 'Sync across all your devices' },
            { icon: '🧮', text: 'Advanced formulas' },
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xl">{feature.icon}</span>
              <span className="text-gray-300 text-sm">{feature.text}</span>
              <span className="ml-auto text-green-400 text-sm">✓</span>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-white font-bold text-lg">$4.99 / month</p>
          <p className="text-gray-500 text-xs mt-1">14-day free trial · Cancel anytime</p>
        </div>

        <button
          disabled
          className="w-full bg-indigo-400 text-white font-bold py-4 rounded-xl text-base opacity-50 cursor-not-allowed"
        >
          Upgrade coming soon
        </button>

        <button
          onPointerDown={onClose}
          className="w-full text-gray-500 text-sm py-2"
        >
          Maybe later
        </button>

      </div>
    </BottomSheet>
  )
}
