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
}

const HotspotBleContext =
  createContext<ReturnType<typeof useHotspotBle>>(initialState)
const { Provider } = HotspotBleContext

const HotspotBleProvider = ({ children }: { children: ReactNode }) => {
  return <Provider value={useHotspotBle()}>{children}</Provider>
}

export const useHotspotBleContext = (): HotspotBleManager =>
  useContext(HotspotBleContext)

export default HotspotBleProvider
