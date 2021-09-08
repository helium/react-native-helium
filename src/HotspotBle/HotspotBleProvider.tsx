import React, { createContext, ReactNode, useContext } from 'react'
import { BleError, Device, State } from 'react-native-ble-plx'
import useHotspotBle, { WifiStatusType } from './useHotspotBle'

/**
 * Use this interface to connect to and interact with a Hotspot over bluetooth.
 */
export type BleManager = {
  /**
   * Query the connection state.
   */
  getState: () => Promise<State>

  /**
   * Enable bluetooth on the device
   */
  enable: () => Promise<boolean>
  startScan: (callback: (error: BleError | null) => void) => Promise<void>
  stopScan: () => void
  connect: (hotspotDevice: Device) => Promise<Device | undefined>
  disconnect: () => void
  discoverAllServicesAndCharacteristics: () => void
  isConnected: () => Promise<boolean>
  readWifiNetworks: (configured: boolean) => Promise<string[] | undefined>
  setWifi: (ssid: string, password: string) => Promise<WifiStatusType>
  removeConfiguredWifi: (name: string) => Promise<string | undefined>
  scannedDevices: Device[]
}

const initialState = {
  getState: async () => State.Unknown,
  enable: async () => false,
  startScan: async () => {},
  stopScan: async () => {},
  connect: async () => undefined,
  disconnect: async () => false,
  discoverAllServicesAndCharacteristics: async () => undefined,
  findCharacteristic: async () => undefined,
  isConnected: async () => false,
  readWifiNetworks: async () => [],
  scannedDevices: [] as Device[],
  setWifi: async () => 'not_found' as WifiStatusType,
  removeConfiguredWifi: async () => undefined,
}

const HotspotBleContext =
  createContext<ReturnType<typeof useHotspotBle>>(initialState)
const { Provider } = HotspotBleContext

const HotspotBleProvider = ({ children }: { children: ReactNode }) => {
  return <Provider value={useHotspotBle()}>{children}</Provider>
}

export const useHotspotBleContext = (): BleManager =>
  useContext(HotspotBleContext)

export default HotspotBleProvider
