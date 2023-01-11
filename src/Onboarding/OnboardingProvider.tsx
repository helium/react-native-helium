import Client, { Hotspot, PendingTransaction } from '@helium/http'
import React, { createContext, ReactNode, useContext } from 'react'
import { AssertData, OnboardingManager, SolHotspot } from './onboardingTypes'
import useOnboarding from './useOnboarding'
import * as web3 from '@solana/web3.js'
import { SodiumKeyPair } from '../Account/account'
import Balance, { CurrencyType } from '@helium/currency'

const initialState = {
  submitAddGateway: async (_opts: {
    hotspotAddress: string
    transaction: string
    userSolPubKey?: web3.PublicKey
    userHeliumAddress?: string
    httpClient?: Client
  }) =>
    new Promise<{
      solanaResponses?: string[]
      pendingTxn?: PendingTransaction
    }>((resolve) => resolve({})),
  baseUrl: '',
  getAssertData: (_opts: {
    gateway: string
    owner: string
    maker: string
    lat: number
    lng: number
    decimalGain?: number
    elevation?: number
    ownerKeypairRaw?: SodiumKeyPair
    httpClient?: Client
  }) =>
    new Promise<AssertData>((resolve) =>
      resolve({
        hasSufficientBalance: true,
        isFree: true,
        hotspot: null,
        solFee: new Balance(0, CurrencyType.solTokens),
      })
    ),
  getHotspotForCurrentChain: async (_opts: {
    hotspotAddress: string
    userHeliumAddress?: string
    userSolPubKey?: web3.PublicKey
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
  submitAssertLocation: async (_opts: {
    transaction: string
    gateway: string
    httpClient?: Client
  }) =>
    new Promise<{
      solTxId?: string
      pendingTxn?: PendingTransaction
    }>((resolve) => resolve({})),
  submitSolana: (_txn: string) => new Promise<string>((resolve) => resolve('')),
  submitTransferHotspot: (_opts: {
    transaction: string
    httpClient?: Client
  }) =>
    new Promise<{
      solTxId?: string
      pendingTxn?: PendingTransaction
    }>((resolve) => resolve({})),
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
