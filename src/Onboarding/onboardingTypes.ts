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
import { PendingTransaction } from '@helium/http'
import { OnboardingRecord, Maker } from '@helium/onboarding'
export interface OnboardingManager {
  /**
   *  Post a payment transaction
   */
  addGateway: (
    hotspotAddress: string,
    transaction: string
  ) => Promise<{
    solanaStatus: 'complete' | 'not_started'
    submitStatus: 'failure' | 'complete' | 'pending'
    transaction: string
    solanaResponses: string[]
    pendingTxn: PendingTransaction | null
  } | null>
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
