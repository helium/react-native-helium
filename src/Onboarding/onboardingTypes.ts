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
import Client, { Hotspot, PendingTransaction } from '@helium/http'
import { OnboardingRecord, Maker } from '@helium/onboarding'
import * as web3 from '@solana/web3.js'
import { SolanaStatus } from '../utils/solanaSentinel'

export type SolHotspot = {
  asset: web3.PublicKey
  bumpSeed: number
  elevation: number
  gain: number
  hotspotKey: string
  isFullHotspot: boolean
  location: any
  numLocationAsserts: number
}

export interface OnboardingManager {
  addGateway: (_opts: {
    hotspotAddress: string
    transaction: string
    userSolPubKey: web3.PublicKey
    httpClient?: Client
  }) => Promise<{
    solanaStatus?: SolanaStatus
    submitStatus: 'failure' | 'complete' | 'pending'
    transaction: string
    solanaResponses: string[]
    pendingTxn: PendingTransaction | null
  } | null>
  assertLocation: (_opts: {
    gatewayAddress: string
    isFree?: boolean
    transaction: string
    httpClient?: Client
  }) => Promise<{
    solanaStatus?: SolanaStatus
    solTxId: string
    pendingTxn: PendingTransaction | null
    submitStatus: 'failure' | 'complete' | 'pending'
  }>
  getHotspotForCurrentChain: (_opts: {
    hotspotAddress: string
    userSolPubKey: web3.PublicKey
    httpClient?: Client
  }) => Promise<SolHotspot | Hotspot | null>
  getSolHotspotInfo: (_opts: {
    iotMint: string
    hotspotAddress: string
    userSolPubKey: web3.PublicKey
  }) => Promise<null | SolHotspot>
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

  /**
   *  Post a payment transaction
   */
  postPaymentTransaction: (
    hotspotAddress: string,
    transaction: string
  ) => Promise<{
    transaction?: string
    solanaResponses?: string[]
  } | null>

  submitAllSolana: (_txns: string[]) => Promise<string[]>

  submitSolana: (_txn: string) => Promise<string>

  baseUrl?: string
}
