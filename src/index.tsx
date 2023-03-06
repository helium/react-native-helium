import { NativeModules } from 'react-native'
export { Device, BleError } from 'react-native-ble-plx'
export { Mnemonic } from '@helium/crypto-react-native'
import * as Account from './Account/account'
import * as AddGateway from './utils/addGateway'
import * as Location from './utils/assertLocation'
import * as Transfer from './utils/transferHotspot'
import './polyfill'
import {
  AddGatewayV1,
  AssertLocationV2,
  TransferHotspotV2,
} from '@helium/transactions'
import HotspotBleProvider, {
  HotspotBleManager,
  useHotspotBleContext as useHotspotBle,
} from './HotspotBle/HotspotBleProvider'
import OnboardingProvider, {
  OnboardingManager,
  useOnboardingContext as useOnboarding,
} from './Onboarding/OnboardingProvider'
import SolanaProvider, {
  useSolanaContext as useSolana,
  SolanaManager,
} from './Solana/SolanaProvider'
import { AssertData } from './Onboarding/onboardingTypes'
import { Keypair } from '@helium/crypto-react-native'
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
import { useSolanaStatus, useSolanaVars } from './Solana/solanaSentinel'
import { HotspotMeta } from './Solana/useSolana'
import { Asset } from '@helium/spl-utils'

type HeliumNativeType = {
  multiply(a: number, b: number): Promise<number>
}

const { Helium } = NativeModules

const heliumNativeModules = Helium as HeliumNativeType

const { multiply } = heliumNativeModules

export {
  Account,
  AddGateway,
  AddGatewayV1,
  AssertData,
  AssertLocationV2,
  Asset,
  Balance,
  createHttpClient,
  DataCredits,
  heliumHttpClient,
  HotspotBleManager,
  HotspotBleProvider,
  HotspotErrorCode,
  HotspotMeta,
  Keypair,
  Location,
  multiply,
  NetworkTokens,
  OnboardingManager,
  OnboardingProvider,
  SecurityTokens,
  SolanaManager,
  SolanaProvider,
  State,
  Transfer,
  TransferHotspotV2,
  USDollars,
  useHotspotBle,
  useOnboarding,
  useSolana,
  useSolanaStatus,
  useSolanaVars,
}
