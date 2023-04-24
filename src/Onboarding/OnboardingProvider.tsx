import React, { createContext, ReactNode, useContext } from 'react'
import { AssertData } from './onboardingTypes'
import useOnboarding from './useOnboarding'
import Balance, { CurrencyType, USDollars } from '@helium/currency'
import OnboardingClient, {
  HotspotType,
  OnboardingRecord,
} from '@helium/onboarding'
import { Transaction } from '@solana/web3.js'
import { HotspotMeta } from '../Solana/useSolana'
import { Asset } from '@helium/spl-utils'

const initialState = {
  baseUrl: '',
  createTransferTransaction: async (_opts: {
    hotspotAddress: string
    newOwnerAddress: string
  }) =>
    new Promise<{
      solanaTransactions?: string[] | undefined
    }>((resolve) => resolve({})),
  createHotspot: (_signedTxn: string) =>
    new Promise<string[]>((resolve) => resolve([])),
  getAssertData: (_opts: {
    gateway: string
    owner: string
    lat: number
    lng: number
    decimalGain?: number
    elevation?: number
    hotspotTypes: HotspotType[]
    onboardingRecord?: OnboardingRecord | null
  }) =>
    new Promise<AssertData>((resolve) =>
      resolve({
        hasSufficientBalance: true,
        isFree: true,
        payer: '',
        oraclePrice: new Balance(0, CurrencyType.usd),
      })
    ),
  getHotspotDetails: (_opts: {
    address: string
    type?: 'MOBILE' | 'IOT' | undefined
  }) => new Promise<HotspotMeta | undefined>((resolve) => resolve(undefined)),
  getHotspots: (_opts: {
    heliumAddress: string
    makerName?: string | undefined
  }) => new Promise<Asset[] | undefined>((resolve) => resolve(undefined)),
  getMinFirmware: async () => '',
  getOnboardingRecord: async (_hotspotAddress: string) => null,
  getOnboardTransactions: async (_opts: {
    hotspotAddress: string
    hotspotTypes: HotspotType[]
    lat?: number
    lng?: number
    decimalGain?: number
    elevation?: number
  }) =>
    new Promise<{
      addGatewayTxn?: string
      assertLocationTxn?: string
      solanaTransactions?: string[]
    }>((resolve) => resolve({})),
  getOraclePrice: () =>
    new Promise<Balance<USDollars>>((resolve) =>
      resolve(new Balance(0, CurrencyType.usd))
    ),
  onboardingClient: new OnboardingClient(''),
  submitTransactions: (_opts: { solanaTransactions?: string[] | undefined }) =>
    new Promise<{
      solanaTxnIds?: string[]
    }>((resolve) => resolve({})),
  burnHNTForDataCredits: (_dcAmount: number) =>
    new Promise<Transaction | undefined>((resolve) => resolve(undefined)),
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
