import { heliumHttpClient } from '@helium/react-native-sdk'

export const submitPendingTxn = (txn: string) =>
  heliumHttpClient.transactions.submit(txn)

export const getPendingTxn = (hash: string) =>
  heliumHttpClient.pendingTransactions.get(hash)

export const getHotspotDetails = async (address: string) =>
  heliumHttpClient.hotspots.get(address)

export const getAccount = async (address: string) =>
  heliumHttpClient.accounts.get(address)
