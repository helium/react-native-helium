import React, { createContext, ReactNode, useContext } from 'react'
import { OnboardingManager } from './onboardingTypes'
import useOnboarding from './useOnboarding'
import { TransactionError } from '@solana/web3.js'

const initialState = {
  getMinFirmware: async () => '',
  getMakers: async () => [],
  getOnboardingRecord: async (_hotspotAddress: string) => null,
  postPaymentTransaction: async (
    _hotspotAddress: string,
    _transaction: string
  ) => null,
  submitSolana: (_txn: string) =>
    new Promise<{
      err: TransactionError | null
      slot: number
      signature: string
    }>((resolve) =>
      resolve({
        err: null,
        slot: 0,
        signature: '',
      })
    ),
  submitAllSolana: (_txns: string[]) =>
    new Promise<
      {
        err: TransactionError | null
        slot: number
        signature: string
      }[]
    >((resolve) =>
      resolve([
        {
          err: null,
          slot: 0,
          signature: '',
        },
      ])
    ),
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
 * <OnboardingProvider baseUrl="https://youronboardingserver.com" solanaCluster="devnet">
 *     <YourRootAppComponent />
 * </OnboardingProvider>
 * ```
 */
const OnboardingProvider = ({
  children,
  baseUrl,
  solanaCluster,
}: {
  children: ReactNode
  baseUrl?: string
  solanaCluster?: 'devnet' | 'testnet' | 'mainnet-beta'
}) => {
  return (
    <Provider value={useOnboarding(baseUrl, solanaCluster)}>
      {children}
    </Provider>
  )
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
