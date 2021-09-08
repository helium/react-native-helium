import { client } from 'react-native-helium'

export const submitPendingTxn = (txn: string) => client.transactions.submit(txn)

export const getPendingTxn = (hash: string) =>
  client.pendingTransactions.get(hash)

export const getHotspotDetails = async (address: string) =>
  client.hotspots.get(address)
