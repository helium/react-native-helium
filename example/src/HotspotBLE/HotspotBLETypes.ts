import type { BleError, Device, State } from 'react-native-ble-plx'
import type { WifiStatusType } from '../../../src/HotspotBle/useHotspotBle'
import type { SodiumKeyPair } from '../../../src/Account/account'

/**
 * Use this interface to connect to and interact with a Hotspot over bluetooth.
 *
 * For example if you wanted to scan for hotspots in one of your components you
 * would first need to wrap your App component with {@link HotspotBleProvider}
 * (see `/example/src/App.tsx`).
 *
 * Next in the component you want to scan for hotspots, you would add the
 * following code to import the functions from the BleManager:
 * ```
 * const { startScan, stopScan, connect, scannedDevices } = useHotspotBle()
 * ```
 *
 * See `/example/src/HotspotBLE/ScanHotspots.tsx` for an example of scanning for
 * Hotspots.
 */
export interface HotspotBleManager {
  /**
   * Query the bluetooth connection state.
   */
  getState: () => Promise<State>

  /**
   * Enable Bluetooth on the device. This function blocks until BLE is in
   * PoweredOn state. [Android only]
   */
  enable: () => Promise<boolean>

  /**
   * Start scanning for Hotspots. They can then be read in {@link HotspotBleManager.scannedDevices | scannedDevices}.
   * @param callback
   */
  startScan: (callback: (error: BleError | null) => void) => Promise<void>

  /**
   * Stop scanning for Hotspots if scanning is in process.
   */
  stopScan: () => void

  /**
   * Connect to a Hotspot. Pass the device from  {@link HotspotBleManager.scannedDevices | scannedDevices} after scanning.
   * @param hotspotDevice
   */
  connect: (hotspotDevice: Device) => Promise<Device | undefined>

  /**
   * Disconnect from a Hotspot.
   */
  disconnect: () => void

  /**
   * Discovers all Services, Characteristics and Descriptors for a connected Hotspot.
   */
  discoverAllServicesAndCharacteristics: () => void

  /**
   * Returns true if a Hotspot is connected.
   */
  isConnected: () => Promise<boolean>

  /**
   * Returns the list of Wifi Networks the connected Hotspot can detect.
   * @param configured
   */
  readWifiNetworks: (configured: boolean) => Promise<string[] | undefined>

  /**
   * Saves and connects a Wifi network to the connected Hotspot.
   * @param ssid
   * @param password
   */
  setWifi: (ssid: string, password: string) => Promise<WifiStatusType>

  /**
   * Removes the saved Wifi configuration from the connected Hotspot.
   * @param name
   */
  removeConfiguredWifi: (name: string) => Promise<string | undefined>

  /**
   * The list of Hotspot devices scanned by {@link HotspotBleManager.startScan | startScan}.
   */
  scannedDevices: Device[]

  /**
   * Create an Add Gateway Transaction for the connected Device.
   * @param ownerAddress
   * @param ownerKeypairRaw
   */
  createGatewayTxn: (
    ownerAddress: string,
    ownerKeypairRaw: SodiumKeyPair
  ) => Promise<string>
}
