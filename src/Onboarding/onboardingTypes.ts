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
import { SolHotspot } from '../utils/solanaUtils'

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
  transaction?: string
}

export interface OnboardingManager {
  createTransferTransaction: (_opts: {
    hotspotAddress: string
    userAddress: string
    newOwnerAddress: string
    httpClient?: Client
  }) => Promise<string>
  submitAddGateway: (_opts: {
    hotspotAddress: string
    transaction: string
    userSolPubKey?: web3.PublicKey
    userHeliumAddress?: string
    httpClient?: Client
  }) => Promise<{
    solanaResponses?: string[]
    pendingTxn?: PendingTransaction
  }>
  submitAssertLocation: (_opts: {
    transaction: string
    httpClient?: Client
    gateway: string
  }) => Promise<{
    solTxId?: string
    pendingTxn?: PendingTransaction
  }>
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
  }) => Promise<AssertData>
  getHotspotForCurrentChain: (_opts: {
    hotspotAddress: string
    userHeliumAddress?: string
    userSolPubKey?: web3.PublicKey
    httpClient?: Client
  }) => Promise<SolHotspot | Hotspot | null>
  hasFreeAssert: (_opts: {
    hotspot?: Hotspot | SolHotspot | null
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
    transaction: string
    httpClient?: Client
  }) => Promise<{
    solTxId?: string
    pendingTxn?: PendingTransaction
  }>
}
