import Balance, {
  DataCredits,
  NetworkTokens,
  SolTokens,
  TestNetworkTokens,
  USDollars,
} from '@helium/currency'
import { Maker } from '@helium/onboarding'

export type AssertData = {
  balances?: {
    hnt: Balance<NetworkTokens | TestNetworkTokens> | undefined
    sol: Balance<SolTokens>
  }
  hasSufficientBalance: boolean
  isFree: boolean
  fees?: {
    dc?: Balance<DataCredits>
    sol?: Balance<SolTokens>
  }
  oraclePrice: Balance<USDollars>
  assertLocationTxn?: string
  solanaTransactions?: Buffer[]
  payer: string
  maker?: Maker
}
