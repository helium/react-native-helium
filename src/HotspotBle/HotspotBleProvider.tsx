import React, { createContext, ReactNode, useContext } from 'react'
import { Device, State } from 'react-native-ble-plx'
import useHotspotBle, { WifiStatusType } from './useHotspotBle'
import type { HotspotBleManager } from './bleTypes'

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
  createGatewayTxn: async () => '',
  ethernetOnline: async () => false,
  getDiagnosticInfo: async () => ({
    connected: '',
    dialable: '',
    eth: '',
    fw: '',
    height: '',
    ip: '',
    nat_type: '',
    wifi: '',
    disk: '',
  }),
  checkFirmwareCurrent: async () => false,
}

const HotspotBleContext =
  createContext<ReturnType<typeof useHotspotBle>>(initialState)
const { Provider } = HotspotBleContext

/**
 * This is a react component that is required to use the {@link HotspotBleManager}.
 * It must wrap your apps root component.
 *
 * For example:
 * ```jsx
 * <HotspotBleProvider>
 *     <YourRootAppComponent />
 * <HotspotBleProvider />
 * ```
 */
const HotspotBleProvider = ({ children }: { children: ReactNode }) => {
  return <Provider value={useHotspotBle()}>{children}</Provider>
}

/**
 * Provides the {@link HotspotBleManager} instance. You must wrap your root app
 * component in a {@link HotspotBleProvider} to use this.
 *
 * For example:
 * ```typescript
 * const { startScan, stopScan, connect, scannedDevices } = useHotspotBle()
 * ```
 */
export const useHotspotBleContext = (): HotspotBleManager =>
  useContext(HotspotBleContext)

export default HotspotBleProvider
