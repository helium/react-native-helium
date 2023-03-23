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
    dc: Balance<DataCredits> | undefined
    hnt: Balance<NetworkTokens | TestNetworkTokens> | undefined
    sol: Balance<SolTokens> | undefined
  }
  hasSufficientBalance: boolean
  hasSufficientSol?: boolean
  hasSufficientHnt?: boolean
  hasSufficientDc?: boolean
  dcNeeded?: Balance<DataCredits>
  isFree: boolean
  ownerFees?: {
    dc?: Balance<DataCredits>
    sol?: Balance<SolTokens>
  }
  makerFees?: {
    dc?: Balance<DataCredits>
    sol?: Balance<SolTokens>
  }
  oraclePrice: Balance<USDollars>
  assertLocationTxn?: string
  solanaTransactions?: string[]
  payer: string
  maker?: Maker
}

export const CreateHotspotExistsError = new Error(
  'This hotspot has already been created'
)
