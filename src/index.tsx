import { NativeModules } from 'react-native'
export { Device, BleError } from 'react-native-ble-plx'
import HotspotBleProvider, {
  useHotspotBleContext as useHotspotBle,
} from './HotspotBle/HotspotBleProvider'

type HeliumNativeType = {
  multiply(a: number, b: number): Promise<number>
}

const { Helium } = NativeModules

const heliumNativeModules = Helium as HeliumNativeType

const multiplyJS = (a: number, b: number) => {
  return Promise.resolve(a * b)
}

const { multiply } = heliumNativeModules

export { multiplyJS, multiply, HotspotBleProvider, useHotspotBle }
