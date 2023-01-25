/**
 * Use this interface to connect to and interact with a Hotspot over bluetooth.
 *
 * For example if you wanted to scan for hotspots in one of your components you
 * would first need to wrap your apps root component with {@link HotspotBleProvider}
 * (see the [example app](https://github.com/helium/react-native-helium/blob/main/example/src/App.tsx)).
 *
 * Next in the component you want to scan for hotspots, you would add the
 * following code to import the functions from the BleManager:
 * ```typescript
 * const { startScan, stopScan, connect, scannedDevices } = useHotspotBle()
 * ```
 *
 * See the [example app](https://github.com/helium/react-native-helium/blob/main/example/src/HotspotBLE/ScanHotspots.tsx)
 * for a working demo of scanning for Hotspots.
 */
import Balance, {
  DataCredits,
  NetworkTokens,
  SolTokens,
  TestNetworkTokens,
  USDollars,
} from '@helium/currency'
import Client, { Hotspot, PendingTransaction } from '@helium/http'
import { OnboardingRecord, Maker } from '@helium/onboarding'
import * as web3 from '@solana/web3.js'
import { SodiumKeyPair } from '../Account/account'
import { SolHotspot } from '../Solana/solanaTypes'
import { HotspotType } from './OnboardingClientV3'

export type AssertData = {
  balances?: {
    hnt: Balance<NetworkTokens | TestNetworkTokens> | undefined
    sol: Balance<SolTokens>
  }
  hasSufficientBalance: boolean
  hotspot: SolHotspot | Hotspot | null
  isFree: boolean
  heliumFee?: {
    dc: Balance<DataCredits>
    hnt: Balance<NetworkTokens>
    usd: Balance<USDollars>
  }
  solFee: Balance<SolTokens>
  assertLocationTxn?: string
  solanaTransactions?: Buffer[]
  payer: string
  maker?: Maker
}

export interface OnboardingManager {
  createTransferTransaction: (_opts: {
    hotspotAddress: string
    userAddress: string
    newOwnerAddress: string
    httpClient?: Client
  }) => Promise<{
    transferHotspotTxn?: string | undefined
    solanaTransaction?: Buffer | undefined
  }>
  submitAddGateway: (_opts: {
    hotspotAddress: string
    userHeliumAddress?: string
    addGatewayTxn?: string
    solanaTransactions?: Buffer[]
    userSolPubKey?: web3.PublicKey
    httpClient?: Client
  }) => Promise<{
    solanaTxnIds?: string[]
    pendingTxn?: PendingTransaction
  }>
  submitAssertLocation: (_opts: {
    assertLocationTxn?: string
    solanaTransactions?: Buffer[]
    httpClient?: Client
    gateway: string
  }) => Promise<{
    solanaTxnIds?: string[]
    pendingTxn?: PendingTransaction
  }>
  getOraclePrice: (_httpClient?: Client) => Promise<Balance<USDollars>>
  submitSolanaTransactions: (_opts: {
    solanaTransactions: string[]
  }) => Promise<string[]>
  getOnboardTransactions: (_opts: {
    txn: string
    hotspotAddress: string
    hotspotTypes: HotspotType[]
    lat?: number
    lng?: number
    decimalGain?: number
    elevation?: number
  }) => Promise<{ addGatewayTxn?: string; solanaTransactions?: Buffer[] }>
  getAssertData: (_opts: {
    gateway: string
    owner: string
    lat: number
    lng: number
    decimalGain?: number
    elevation?: number
    ownerKeypairRaw?: SodiumKeyPair
    hotspotTypes: HotspotType[]
    httpClient?: Client
    onboardingRecord?: OnboardingRecord | null
    createSolanaTransactions?: boolean
  }) => Promise<AssertData>
  getHotspotForCurrentChain: (_opts: {
    hotspotAddress: string
    userHeliumAddress?: string
    userSolPubKey?: web3.PublicKey
    httpClient?: Client
  }) => Promise<SolHotspot | Hotspot | null>
  hasFreeAssert: (_opts: {
    hotspot?: Hotspot | SolHotspot | null
    onboardingRecord?: OnboardingRecord | null
  }) => Promise<boolean>
  /**
   * Get the onboarding record from the Onboarding Server.
   */
  getOnboardingRecord: (
    hotspotAddress: string
  ) => Promise<OnboardingRecord | null>

  /**
   * Get the minimum supported firmware from the Onboarding Server.
   */
  getMinFirmware: () => Promise<string | null>

  /**
   * Get the makers from Onboarding Server.
   */
  getMakers: () => Promise<Maker[] | null>

  baseUrl?: string

  submitTransferHotspot: (_opts: {
    transferHotspotTxn?: string
    solanaTransaction?: Buffer
    httpClient?: Client
  }) => Promise<{
    solTxId?: string
    pendingTxn?: PendingTransaction
  }>
}
