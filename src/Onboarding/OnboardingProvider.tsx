import Client, { Hotspot, PendingTransaction } from '@helium/http'
import React, { createContext, ReactNode, useContext } from 'react'
import { AssertData } from './onboardingTypes'
import useOnboarding from './useOnboarding'
import { SodiumKeyPair } from '../Account/account'
import Balance, { CurrencyType, USDollars } from '@helium/currency'
import { HotspotType, OnboardingRecord } from '@helium/onboarding'
import { Asset } from '@helium/spl-utils'

const initialState = {
  createTransferTransaction: async (_opts: {
    hotspotAddress: string
    userAddress: string
    newOwnerAddress: string
    httpClient?: Client
    ownerKeypairRaw?: SodiumKeyPair
  }) =>
    new Promise<{
      transferHotspotTxn?: string | undefined
      solanaTransaction?: Buffer | undefined
    }>((resolve) => resolve({})),
  getOnboardTransactions: async (_opts: {
    txn: string
    hotspotAddress: string
    hotspotTypes: HotspotType[]
    lat?: number
    lng?: number
    decimalGain?: number
    elevation?: number
  }) =>
    new Promise<{ heliumTxn?: string; solanaTransactions?: Buffer[] }>(
      (resolve) => resolve({})
    ),
  submitAddGateway: async (_opts: {
    hotspotAddress: string
    addGatewayTxn?: string
    solanaTransactions?: Buffer[]
    httpClient?: Client
  }) =>
    new Promise<{
      solanaTxnIds?: string[]
      pendingTxn?: PendingTransaction
    }>((resolve) => resolve({})),
  getOraclePrice: (_httpClient?: Client) =>
    new Promise<Balance<USDollars>>((resolve) =>
      resolve(new Balance(0, CurrencyType.usd))
    ),
  submitSolanaTransactions: (_opts: { solanaTransactions: string[] }) =>
    new Promise<string[]>((resolve) => resolve([])),
  baseUrl: '',
  getAssertData: (_opts: {
    gateway: string
    owner: string
    lat: number
    lng: number
    decimalGain?: number
    elevation?: number
    httpClient?: Client
    dataOnly?: boolean
    hotspotTypes: HotspotType[]
    onboardingRecord?: OnboardingRecord | null
    createSolanaTransactions?: boolean
  }) =>
    new Promise<AssertData>((resolve) =>
      resolve({
        hasSufficientBalance: true,
        isFree: true,
        payer: '',
        oraclePrice: new Balance(0, CurrencyType.usd),
      })
    ),
  getMakers: async () => [],
  getMinFirmware: async () => '',
  getOnboardingRecord: async (_hotspotAddress: string) => null,
  hasFreeAssert: (_opts: {
    hotspot?: Hotspot | Asset | null
    onboardingRecord?: OnboardingRecord | null
  }) => false,
  postPaymentTransaction: async (
    _hotspotAddress: string,
    _transaction: string
  ) => null,
  submitAssertLocation: async (_opts: {
    assertLocationTxn?: string
    solanaTransactions?: Buffer[]
    httpClient?: Client
    gateway: string
  }) =>
    new Promise<{
      solTxnIds?: string[]
      pendingTxn?: PendingTransaction
    }>((resolve) => resolve({})),
  submitTransferHotspot: (_opts: {
    transferHotspotTxn?: string
    solanaTransaction?: Buffer
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
}: {
  children: ReactNode
  baseUrl: string
}) => {
  return <Provider value={useOnboarding({ baseUrl })}>{children}</Provider>
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
export type OnboardingManager = ReturnType<typeof useOnboarding>
export const useOnboardingContext = (): OnboardingManager =>
  useContext(OnboardingContext)

export default OnboardingProvider
