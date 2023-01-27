import Balance, {
  DataCredits,
  NetworkTokens,
  SolTokens,
  TestNetworkTokens,
  USDollars,
} from '@helium/currency'
import { SolHotspot } from '@helium/hotspot-utils'
import { Hotspot } from '@helium/http'
import { Maker } from '@helium/onboarding'

export type AssertData = {
  balances?: {
    hnt: Balance<NetworkTokens | TestNetworkTokens> | undefined
    sol: Balance<SolTokens>
  }
  hasSufficientBalance: boolean
  hotspot: SolHotspot | Hotspot | null
  isFree: boolean
  heliumFee?: {
    dc: Balance<DataCredits>
    hnt: Balance<NetworkTokens>
    usd: Balance<USDollars>
  }
  solFee: Balance<SolTokens>
  assertLocationTxn?: string
  solanaTransactions?: Buffer[]
  payer: string
  maker?: Maker
}
