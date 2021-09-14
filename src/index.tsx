import { NativeModules } from 'react-native'
export { Device, BleError } from 'react-native-ble-plx'
export { Mnemonic, Address } from '@helium/crypto-react-native'
import * as Account from './Account/account'
import * as Onboarding from './Onboarding/onboardingClient'
import * as AddGateway from './utils/addGateway'
import * as Location from './utils/assertLocation'
import './polyfill'
import {
  AddGatewayV1,
  Transaction,
  AssertLocationV2,
} from '@helium/transactions'
import HotspotBleProvider, {
  useHotspotBleContext as useHotspotBle,
} from './HotspotBle/HotspotBleProvider'
import { Keypair } from '@helium/crypto-react-native'
import { HotspotBleManager } from './HotspotBle/bleTypes'
import { State } from 'react-native-ble-plx'
import Client from '@helium/http'
import Balance, {
  NetworkTokens,
  DataCredits,
  SecurityTokens,
  USDollars,
} from '@helium/currency'
import { HotspotErrorCode } from './HotspotBle/useHotspotBle'
export { DiagnosticInfo } from './HotspotBle/bleParse'

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

const { multiply } = heliumNativeModules

export {
  multiply,
  HotspotBleProvider,
  HotspotBleManager,
  useHotspotBle,
  HotspotErrorCode,
  Account,
  Keypair,
  State,
  Onboarding,
  AddGatewayV1,
  AddGateway,
  Location,
  heliumHttpClient,
  AssertLocationV2,
  Balance,
  NetworkTokens,
  DataCredits,
  SecurityTokens,
  USDollars,
}
