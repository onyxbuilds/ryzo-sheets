import { signInWithGoogle } from '../auth'
import { useTheme } from '../theme'

export default function SignInScreen() {
  const { isDark } = useTheme()

  const bg = isDark ? 'bg-gray-950' : 'bg-gray-50'
  const text = isDark ? 'text-white' : 'text-gray-900'
  const subtext = isDark ? 'text-gray-400' : 'text-gray-500'

  return (
    <div className={`min-h-screen ${bg} ${text} flex flex-col items-center justify-center px-6`}>
      <div className="w-full max-w-sm flex flex-col items-center gap-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-4xl shadow-2xl shadow-indigo-900">
            ◈
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Ryzo Sheets</h1>
          <p className={`${subtext} text-center text-sm`}>
            A powerful mobile spreadsheet.{'\n'}Your data synced and safe.
          </p>
        </div>

        {/* Features */}
        <div className={`w-full rounded-2xl p-4 flex flex-col gap-3 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
          {[
            ['📊', 'Create and manage spreadsheets'],
            ['☁️', 'Cloud sync across devices'],
            ['🔒', 'Your data is private and secure'],
            ['⚡', 'Works offline, syncs when online'],
          ].map(([icon, label]) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-xl">{icon}</span>
              <span className={`text-sm ${subtext}`}>{label}</span>
            </div>
          ))}
        </div>

        {/* Sign in button */}
        <button
          onClick={signInWithGoogle}
          className="w-full bg-white text-gray-900 font-semibold py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg active:opacity-80 text-base"
        >
          <img
            src="https://www.google.com/favicon.ico"
            className="w-5 h-5"
            alt="Google"
          />
          Continue with Google
        </button>

        {/* Legal links */}
        <p className={`${subtext} text-xs text-center`}>
          By continuing, you agree to our{' '}
          <span
            onClick={() => window.open('/terms.html', '_blank')}
            className="text-indigo-400 underline cursor-pointer"
          >Terms of Service</span>
          {' '}and{' '}
          <span
            onClick={() => window.open('/privacy.html', '_blank')}
            className="text-indigo-400 underline cursor-pointer"
          >Privacy Policy</span>.
        </p>

      </div>
    </div>
  )
}
