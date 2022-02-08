/**
 * [[include:AddGateway.md]]
 * @packageDocumentation
 * @module AddGateway
 */

import { AddGatewayV1 } from '@helium/transactions'
import { getKeypair, SodiumKeyPair } from '../Account/account'
import { Address } from '@helium/crypto-react-native'
import { emptyB58Address } from './txnHelper'

/**
 * Calculate the transaction fee and staking fee for an AddGatewayV1 transaction.
 * @param ownerB58
 * @param payerB58
 */
export const calculateAddGatewayFee = (ownerB58: string, payerB58: string) => {
  const owner = Address.fromB58(ownerB58)
  const payer = Address.fromB58(payerB58)

  const txn = new AddGatewayV1({
    owner,
    gateway: emptyB58Address(),
    payer,
  })

  return { fee: txn.fee || 0, stakingFee: txn.stakingFee || 0 }
}

/**
 * Convert an encoded blockchain txn string into an {@link AddGatewayV1} transaction.
 * @param txnStr the encoded blockchain transaction as a String
 */
export const txnFromString = (txnStr: string): AddGatewayV1 =>
  AddGatewayV1.fromString(txnStr)

/**
 * Sign an {@link AddGatewayV1} transaction with the provided owner {@link SodiumKeyPair}
 * @param txnStr the encoded blockchain transaction as a String
 * @param ownerKeypairRaw
 */
export const signGatewayTxn = async (
  txnStr: string,
  ownerKeypairRaw: SodiumKeyPair
) => {
  const ownerKeypair = getKeypair(ownerKeypairRaw)
  const addGatewayTxn = txnFromString(txnStr)

  const txnOwnerSigned = await addGatewayTxn.sign({
    owner: ownerKeypair,
  })
  if (!txnOwnerSigned.gateway?.b58) {
    throw new Error('Failed to sign gateway txn')
  }
  return txnOwnerSigned
}
