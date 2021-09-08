import { NativeModules } from 'react-native'
export { Device, BleError } from 'react-native-ble-plx'
export { Mnemonic, Address } from '@helium/crypto-react-native'
import * as Account from './Account/account'
import * as Staking from './Staking/stakingClient'
import * as Gateway from './utils/addGateway'
import './polyfill'
import HeliumHttpClient from '@helium/http'
import { Transaction } from '@helium/transactions'

const client = new HeliumHttpClient()
const configChainVars = async () => {
  const vars = await client.vars.get()
  Transaction.config(vars)
}
configChainVars()

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

export {
  multiplyJS,
  multiply,
  HotspotBleProvider,
  useHotspotBle,
  Account,
  Staking,
  Gateway,
  client,
}
