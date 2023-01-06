import Client, { Hotspot, PendingTransaction } from '@helium/http'
import React, { createContext, ReactNode, useContext } from 'react'
import { OnboardingManager, SolHotspot } from './onboardingTypes'
import useOnboarding from './useOnboarding'
import * as web3 from '@solana/web3.js'

const initialState = {
  addGateway: async (_opts: {
    hotspotAddress: string
    transaction: string
    userSolPubKey: web3.PublicKey
    httpClient?: Client
  }) => null,
  assertLocation: async (_opts: {
    gatewayAddress: string
    isFree?: boolean
    transaction: string
    httpClient?: Client
  }) =>
    new Promise<{
      solTxId: string
      pendingTxn: PendingTransaction | null
      submitStatus: 'failure' | 'complete' | 'pending'
      solanaStatus: 'complete' | 'not_started'
    }>((resolve) =>
      resolve({
        solTxId: '',
        pendingTxn: null,
        submitStatus: 'failure',
        solanaStatus: 'complete',
      })
    ),
  baseUrl: '',
  getHotspotForCurrentChain: async (_opts: {
    hotspotAddress: string
    userSolPubKey: web3.PublicKey
    httpClient?: Client
  }) => null,
  getMakers: async () => [],
  getMinFirmware: async () => '',
  getOnboardingRecord: async (_hotspotAddress: string) => null,
  getSolHotspotInfo: async (_opts: {
    iotMint: string
    hotspotAddress: string
    userSolPubKey: web3.PublicKey
  }) => null,
  hasFreeAssert: async (_opts: { hotspot?: Hotspot | SolHotspot | null }) =>
    false,
  postPaymentTransaction: async (
    _hotspotAddress: string,
    _transaction: string
  ) => null,
  submitAllSolana: (_txns: string[]) =>
    new Promise<string[]>((resolve) => resolve([''])),
  submitSolana: (_txn: string) => new Promise<string>((resolve) => resolve('')),
  transferHotspot: (_opts: { transaction: string; httpClient?: Client }) =>
    new Promise<{
      solTxId: string
      pendingTxn: PendingTransaction | null
      submitStatus: 'failure' | 'complete' | 'pending'
      solanaStatus: 'complete' | 'not_started'
    }>((resolve) =>
      resolve({
        solTxId: '',
        pendingTxn: null,
        submitStatus: 'failure',
        solanaStatus: 'complete',
      })
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
