import React, { createContext, ReactNode, useContext } from 'react'
import useOnboardingHook from './useOnboarding'

export type OnboardingManager = ReturnType<typeof useOnboardingHook>

const OnboardingContext = createContext<OnboardingManager | null>(null)
const { Provider } = OnboardingContext

const OnboardingProvider = ({
  children,
  baseUrl,
}: {
  children: ReactNode
  baseUrl: string
}) => {
  return <Provider value={useOnboardingHook({ baseUrl })}>{children}</Provider>
}

export const useOnboarding = (): OnboardingManager => {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboarding has to be used within <OnboardingProvider>')
  }
  return context
}

export default OnboardingProvider
