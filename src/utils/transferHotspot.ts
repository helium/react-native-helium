/**
 * [[include:TransferHotspotV2.md]]
 * @packageDocumentation
 * @module Transfer
 */

import { TransferHotspotV2 } from '@helium/transactions'
import { getKeypair, SodiumKeyPair } from '../Account/account'
import { Address } from '@helium/crypto-react-native'

/**
 * Create a  {@link TransferHotspotV2} transaction.
 * @param gatewayB58
 * @param ownerB58
 * @param newOwnerB58
 * @param nonce
 */
export const createTransferV2 = (
  gatewayB58: string,
  ownerB58: string,
  newOwnerB58: string,
  nonce: number
): TransferHotspotV2 => {
  const gateway = Address.fromB58(gatewayB58)
  const owner = Address.fromB58(ownerB58)
  const newOwner = Address.fromB58(newOwnerB58)

  return new TransferHotspotV2({
    owner,
    gateway,
    newOwner,
    nonce,
  })
}

/**
 * Convert an encoded blockchain txn string into an {@link TransferHotspotV2} transaction.
 * @param txnStr the encoded blockchain transaction as a String
 */
export const txnFromString = (txnStr: string): TransferHotspotV2 =>
  TransferHotspotV2.fromString(txnStr)

/**
 * Sign a {@link TransferHotspotV2} transaction with the provided owner {@link SodiumKeyPair}
 * @param txnStr the encoded blockchain transaction as a String
 * @param ownerKeypairRaw
 */
export const signTransferV2Txn = async (
  txnStr: string,
  ownerKeypairRaw: SodiumKeyPair
): Promise<TransferHotspotV2> => {
  const ownerKeypair = getKeypair(ownerKeypairRaw)
  const transferHotspotV2 = txnFromString(txnStr)

  const txnOwnerSigned = await transferHotspotV2.sign({
    owner: ownerKeypair,
  })
  if (!txnOwnerSigned.gateway?.b58) {
    throw new Error('Failed to sign TransferHotspotV2 txn')
  }
  return txnOwnerSigned
}
