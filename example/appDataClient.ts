import Client from '@helium/http'
import { Transaction } from '@helium/transactions'

const client = new Client()
const configChainVars = async () => {
  const vars = await client.vars.get()
  Transaction.config(vars)
}
configChainVars()

export const submitPendingTxn = (txn: string) => client.transactions.submit(txn)

export const getPendingTxn = (hash: string) =>
  client.pendingTransactions.get(hash)
