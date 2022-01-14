import { NativeModules } from 'react-native'
export { Device, BleError } from 'react-native-ble-plx'
export { Mnemonic, Address } from '@helium/crypto-react-native'
import * as Account from './Account/account'
import * as AddGateway from './utils/addGateway'
import * as Location from './utils/assertLocation'
import * as WalletLink from './WalletLink'
import './polyfill'
import { AddGatewayV1, AssertLocationV2 } from '@helium/transactions'
import HotspotBleProvider, {
  useHotspotBleContext as useHotspotBle,
} from './HotspotBle/HotspotBleProvider'
import OnboardingProvider, {
  useOnboardingContext as useOnboarding,
} from './Onboarding/OnboardingProvider'
import { Keypair } from '@helium/crypto-react-native'
import { HotspotBleManager } from './HotspotBle/bleTypes'
import { State } from 'react-native-ble-plx'
import Balance, {
  NetworkTokens,
  DataCredits,
  SecurityTokens,
  USDollars,
} from '@helium/currency'
import { HotspotErrorCode } from './HotspotBle/useHotspotBle'
import { heliumHttpClient, createHttpClient } from './utils/httpClient'
export { DiagnosticInfo } from './HotspotBle/bleParse'

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
  OnboardingProvider,
  useOnboarding,
  useHotspotBle,
  HotspotErrorCode,
  Account,
  Keypair,
  State,
  AddGatewayV1,
  AddGateway,
  Location,
  heliumHttpClient,
  createHttpClient,
  AssertLocationV2,
  Balance,
  NetworkTokens,
  DataCredits,
  SecurityTokens,
  USDollars,
  WalletLink,
}
