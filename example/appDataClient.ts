import { heliumHttpClient } from 'react-native-helium'

export const submitPendingTxn = (txn: string) =>
  heliumHttpClient.transactions.submit(txn)

export const getPendingTxn = (hash: string) =>
  heliumHttpClient.pendingTransactions.get(hash)

export const getHotspotDetails = async (address: string) =>
  heliumHttpClient.hotspots.get(address)
