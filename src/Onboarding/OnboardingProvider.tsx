import React, { createContext, ReactNode, useContext } from 'react'
import { OnboardingManager } from './onboardingTypes'
import useOnboarding from './useOnboarding'

const initialState = {
  getMinFirmware: async () => '',
  getMakers: async () => [],
  getOnboardingRecord: async (_hotspotAddress: string) => null,
  postPaymentTransaction: async (
    _hotspotAddress: string,
    _transaction: string
  ) => '',
}

const OnboardingContext =
  createContext<ReturnType<typeof useOnboarding>>(initialState)
const { Provider } = OnboardingContext

/**
 * This is a react component that is required to use the {@link OnboardingManager}.
 * It must wrap your apps root component.
 *
 * For example:
 * ```tsx
 * <OnboardingProvider>
 *     <YourRootAppComponent />
 * </OnboardingProvider>
 * ```
 * or if you will be using your own onboarding server
 *
 * ```tsx
 * <OnboardingProvider baseUrl="https://youronboardingserver.com">
 *     <YourRootAppComponent />
 * </OnboardingProvider>
 * ```
 */
const OnboardingProvider = ({
  children,
  baseUrl,
}: {
  children: ReactNode
  baseUrl?: string
}) => {
  return <Provider value={useOnboarding(baseUrl)}>{children}</Provider>
}

/**
 * Provides the {@link OnboardingManager} instance. You must wrap your root app
 * component in an {@link OnboardingProvider} to use this.
 *
 * For example:
 * ```typescript
    const { getOnboardingRecord, postPaymentTransaction } = useOnboarding()}
 * ```
 */
export const useOnboardingContext = (): OnboardingManager =>
  useContext(OnboardingContext)

export default OnboardingProvider
