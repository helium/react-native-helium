import { NativeModules } from 'react-native'
export { Device, BleError } from 'react-native-ble-plx'
export { Mnemonic, Address } from '@helium/crypto-react-native'
import * as Account from './Account/account'
import * as Onboarding from './Onboarding/onboardingClient'
import * as AddGateway from './utils/addGateway'
import * as Location from './utils/assertLocation'
import './polyfill'
import { AddGatewayV1, Transaction } from '@helium/transactions'
import HotspotBleProvider, {
  useHotspotBleContext as useHotspotBle,
} from './HotspotBle/HotspotBleProvider'
import { Keypair } from '@helium/crypto-react-native'
import { HotspotBleManager } from './HotspotBle/bleTypes'
import { State } from 'react-native-ble-plx'
import Client from '@helium/http'

const heliumHttpClient = new Client()
const configChainVars = async () => {
  const vars = await heliumHttpClient.vars.get()
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
  Onboarding,
  Client,
  AddGatewayV1,
  AddGateway,
  Location,
  heliumHttpClient,
}
