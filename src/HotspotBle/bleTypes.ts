import type { BleError, Device, State } from 'react-native-ble-plx'
import { DiagnosticInfo } from '..'
import type { SodiumKeyPair } from '../Account/account'
import type { WifiStatusType } from './useHotspotBle'

export enum Service {
  FIRMWARESERVICE_UUID = '0000180a-0000-1000-8000-00805f9b34fb',
  MAIN_UUID = '0fda92b2-44a2-4af2-84f5-fa682baa2b8d',
}

export enum FirmwareCharacteristic {
  FIRMWAREVERSION_UUID = '00002a26-0000-1000-8000-00805f9b34fb',
}
export enum HotspotCharacteristic {
  WIFI_SSID_UUID = '7731de63-bc6a-4100-8ab1-89b2356b038b',
  PUBKEY_UUID = '0a852c59-50d3-4492-bfd3-22fe58a24f01',
  ONBOARDING_KEY_UUID = 'd083b2bd-be16-4600-b397-61512ca2f5ad',
  AVAILABLE_SSIDS_UUID = 'd7515033-7e7b-45be-803f-c8737b171a29',
  WIFI_CONFIGURED_SERVICES = 'e125bda4-6fb8-11ea-bc55-0242ac130003',
  WIFI_REMOVE = '8cc6e0b3-98c5-40cc-b1d8-692940e6994b',
  WIFI_CONNECT_UUID = '398168aa-0111-4ec0-b1fa-171671270608',
  ADD_GATEWAY_UUID = 'df3b16ca-c985-4da2-a6d2-9b9b9abdb858',
  ASSERT_LOC_UUID = 'd435f5de-01a4-4e7d-84ba-dfd347f60275',
  DIAGNOSTIC_UUID = 'b833d34f-d871-422c-bf9e-8e6ec117d57e',
  ETHERNET_ONLINE_UUID = 'e5866bd6-0288-4476-98ca-ef7da6b4d289',
}

/**
 * Use this interface to connect to and interact with a Hotspot over bluetooth.
 *
 * For example if you wanted to scan for hotspots in one of your components you
 * would first need to wrap your apps root component with {@link HotspotBleProvider}
 * (see `/example/src/App.tsx`).
 *
 * Next in the component you want to scan for hotspots, you would add the
 * following code to import the functions from the BleManager:
 * ```typescript
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

  /**
   * Returns the diagnostic info for the connected Hotspot.
   */
  getDiagnosticInfo: () => Promise<DiagnosticInfo>

  /**
   * Check if the connected Hotspots firmware is up to date
   */
  checkFirmwareCurrent: () => Promise<boolean>
}
