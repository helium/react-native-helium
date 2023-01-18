import Client, { Hotspot, PendingTransaction } from '@helium/http'
import React, { createContext, ReactNode, useContext } from 'react'
import { AssertData, OnboardingManager } from './onboardingTypes'
import useOnboarding from './useOnboarding'
import * as web3 from '@solana/web3.js'
import { SodiumKeyPair } from '../Account/account'
import Balance, { CurrencyType } from '@helium/currency'
import { SolHotspot } from '../utils/solanaUtils'
import { HotspotType } from './OnboardingClientV3'

const initialState = {
  solanaStatus: {
    isHelium: false,
    isSolana: false,
    inProgress: false,
  },
  createTransferTransaction: async (_opts: {
    hotspotAddress: string
    userAddress: string
    newOwnerAddress: string
    httpClient?: Client
  }) => new Promise<string>((resolve) => resolve('')),
  getOnboardTransactions: async (_opts: {
    txn: string
    hotspotAddress: string
    hotspotTypes: HotspotType[]
  }) =>
    new Promise<{ heliumTxn?: string; solanaTransactions?: string[] }>(
      (resolve) => resolve({})
    ),
  submitAddGateway: async (_opts: {
    hotspotAddress: string
    userHeliumAddress?: string
    addGatewayTxn?: string
    solanaTransactions?: string[]
    userSolPubKey?: web3.PublicKey
    httpClient?: Client
  }) =>
    new Promise<{
      solanaTxnIds?: string[]
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
  hasFreeAssert: async (_opts: { hotspot?: Hotspot | SolHotspot | null }) =>
    false,
  postPaymentTransaction: async (
    _hotspotAddress: string,
    _transaction: string
  ) => null,
  submitAssertLocation: async (_opts: {
    assertLocationTxn?: string
    solanaTransactions?: string[]
    httpClient?: Client
    gateway: string
  }) =>
    new Promise<{
      solTxnIds?: string[]
      pendingTxn?: PendingTransaction
    }>((resolve) => resolve({})),
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
  v3BaseUrl,
  solanaCluster,
}: {
  children: ReactNode
  baseUrl?: string
  v3BaseUrl?: string
  solanaCluster?: 'devnet' | 'testnet' | 'mainnet-beta'
}) => {
  return (
    <Provider value={useOnboarding({ baseUrl, v3BaseUrl, solanaCluster })}>
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
