import Client from '@helium/http'
import { Transaction } from '@helium/transactions'

export const heliumHttpClient = new Client()
const configChainVars = async () => {
  const vars = await heliumHttpClient.vars.get()
  Transaction.config(vars)
}
configChainVars()
