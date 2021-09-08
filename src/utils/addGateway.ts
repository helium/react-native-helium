import { AddGatewayV1 } from '@helium/transactions'
import { getKeypair, SodiumKeyPair } from '../Account/account'
import { getStakingSignedTransaction } from '../Staking/stakingClient'
import { Address } from '@helium/crypto-react-native'

const emptyB58Address = () =>
  Address.fromB58('13PuqyWXzPYeXcF1B9ZRx7RLkEygeL374ZABiQdwRSNzASdA1sn')

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
export const txnFromString = (txnStr: string) => AddGatewayV1.fromString(txnStr)

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
  return getStakingSignedTransaction(
    txnOwnerSigned.gateway.b58,
    txnOwnerSigned.toString()
  )
}
