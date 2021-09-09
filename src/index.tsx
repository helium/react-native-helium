import { NativeModules } from 'react-native'
export { Device, BleError } from 'react-native-ble-plx'
export { Mnemonic, Address } from '@helium/crypto-react-native'
import * as Account from './Account/account'
import * as Staking from './Staking/stakingClient'
import * as Gateway from './utils/addGateway'
import './polyfill'
import HeliumHttpClient from '@helium/http'
import { AddGatewayV1, Transaction } from '@helium/transactions'
import HotspotBleProvider, {
  useHotspotBleContext as useHotspotBle,
} from './HotspotBle/HotspotBleProvider'
import type { Keypair } from '@helium/crypto-react-native'
import type { HotspotBleManager } from './HotspotBle/bleTypes'
import type { State } from 'react-native-ble-plx'

const client = new HeliumHttpClient()
const configChainVars = async () => {
  const vars = await client.vars.get()
  Transaction.config(vars)
}
configChainVars()

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
  HotspotBleManager,
  useHotspotBle,
  Account,
  Keypair,
  State,
  Staking,
  Gateway,
  client,
  AddGatewayV1,
}
