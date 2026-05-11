// — APP ROOT
import { useState, useEffect } from 'react'
import { ThemeProvider } from './theme'
import SplashScreen from './screens/SplashScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import SignInScreen from './screens/SignInScreen'
import HomeScreen from './screens/HomeScreen'
import GridScreen from './screens/GridScreen'
import UpgradeScreen from './screens/UpgradeScreen'
import { onAuthChange } from './auth'

const SCREENS = {
  SPLASH: 'splash',
  ONBOARDING: 'onboarding',
  SIGNIN: 'signin',
  HOME: 'home',
  GRID: 'grid',
  UPGRADE: 'upgrade'
}

export default function App() {
  const [screen, setScreen] = useState(SCREENS.SPLASH)
  const [currentSheet, setCurrentSheet] = useState(null)
  const [isFirstLaunch, setIsFirstLaunch] = useState(false)
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [isPro, setIsPro] = useState(false)

  // First launch detection + set initial history state
  useEffect(() => {
    const launched = localStorage.getItem('ryzo-launched')
    if (!launched) {
      setIsFirstLaunch(true)
      localStorage.setItem('ryzo-launched', 'true')
    }
    window.history.replaceState({ screen: SCREENS.HOME }, '')
  }, [])

  // Auth listener + subscription check
  useEffect(() => {
    const { data: { subscription } } = onAuthChange(async (user) => {
      setUser(user)
      setAuthReady(true)
      if (user) {
        const { getSubscriptionStatus } = await import('./supabase')
        const pro = await getSubscriptionStatus(user.id)
        setIsPro(pro)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Auto-advance from splash once auth resolves
  useEffect(() => {
    if (authReady && screen === SCREENS.SPLASH) {
      if (isFirstLaunch) {
        setScreen(SCREENS.ONBOARDING)
      } else if (user) {
        const lastSheet = localStorage.getItem('ryzo-last-sheet')
        if (lastSheet) {
          try {
            const parsed = JSON.parse(lastSheet)
            setCurrentSheet(parsed)
            setScreen(SCREENS.GRID)
            window.history.replaceState({ screen: SCREENS.GRID }, '')
          } catch (e) {
            localStorage.removeItem('ryzo-last-sheet')
            setScreen(SCREENS.HOME)
            window.history.replaceState({ screen: SCREENS.HOME }, '')
          }
        } else {
          setScreen(SCREENS.HOME)
          window.history.replaceState({ screen: SCREENS.HOME }, '')
        }
      } else {
        setScreen(SCREENS.SIGNIN)
      }
    }
  }, [authReady, user])

  // Hardware back button handler
  useEffect(() => {
    function handlePopState() {
      if (screen === SCREENS.GRID) {
        setCurrentSheet(null)
        setScreen(SCREENS.HOME)
        localStorage.removeItem('ryzo-last-sheet')
        window.history.replaceState({ screen: SCREENS.HOME }, '')
      } else if (screen === SCREENS.UPGRADE) {
        if (currentSheet) {
          setScreen(SCREENS.GRID)
          window.history.replaceState({ screen: SCREENS.GRID }, '')
        } else {
          setScreen(SCREENS.HOME)
          window.history.replaceState({ screen: SCREENS.HOME }, '')
        }
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [screen, currentSheet])

  function handleSplashDone() {
    if (!authReady) return
    if (isFirstLaunch) {
      setScreen(SCREENS.ONBOARDING)
    } else if (user) {
      const lastSheet = localStorage.getItem('ryzo-last-sheet')
      if (lastSheet) {
        try {
          const parsed = JSON.parse(lastSheet)
          setCurrentSheet(parsed)
          setScreen(SCREENS.GRID)
          window.history.replaceState({ screen: SCREENS.GRID }, '')
        } catch (e) {
          localStorage.removeItem('ryzo-last-sheet')
          setScreen(SCREENS.HOME)
          window.history.replaceState({ screen: SCREENS.HOME }, '')
        }
      } else {
        setScreen(SCREENS.HOME)
        window.history.replaceState({ screen: SCREENS.HOME }, '')
      }
    } else {
      setScreen(SCREENS.SIGNIN)
    }
  }

  function handleOnboardingDone() {
    setScreen(SCREENS.SIGNIN)
  }

  function handleOpenSheet(sheet) {
    setCurrentSheet(sheet)
    setScreen(SCREENS.GRID)
    localStorage.setItem('ryzo-last-sheet', JSON.stringify(sheet))
    window.history.pushState({ screen: SCREENS.GRID }, '')
  }

  function handleBackToHome() {
    setCurrentSheet(null)
    setScreen(SCREENS.HOME)
    localStorage.removeItem('ryzo-last-sheet')
    window.history.replaceState({ screen: SCREENS.HOME }, '')
  }

  function handleUpgrade() {
    setScreen(SCREENS.UPGRADE)
    window.history.pushState({ screen: SCREENS.UPGRADE }, '')
  }

  function handleBackFromUpgrade() {
    if (currentSheet) {
      setScreen(SCREENS.GRID)
      window.history.replaceState({ screen: SCREENS.GRID }, '')
    } else {
      setScreen(SCREENS.HOME)
      window.history.replaceState({ screen: SCREENS.HOME }, '')
    }
  }

  return (
    <ThemeProvider>
      {screen === SCREENS.SPLASH && (
        <SplashScreen onDone={handleSplashDone} />
      )}
      {screen === SCREENS.ONBOARDING && (
        <OnboardingScreen onDone={handleOnboardingDone} />
      )}
      {screen === SCREENS.SIGNIN && (
        <SignInScreen />
      )}
      {screen === SCREENS.HOME && user && (
        <HomeScreen
          user={user}
          isPro={isPro}
          onOpenSheet={handleOpenSheet}
          onUpgrade={handleUpgrade}
        />
      )}
      {screen === SCREENS.GRID && currentSheet && (
        <GridScreen
          sheet={currentSheet}
          onBack={handleBackToHome}
          onUpgrade={handleUpgrade}
          user={user}
          isPro={isPro}
        />
      )}
      {screen === SCREENS.UPGRADE && (
        <UpgradeScreen onBack={handleBackFromUpgrade} />
      )}
    </ThemeProvider>
  )
}
