/**
 * [[include:TransferHotspotV2.md]]
 * @packageDocumentation
 * @module Transfer
 */

import { TransferHotspotV2 } from '@helium/transactions'
import { getKeypair, SodiumKeyPair } from '../Account/account'
import Address from '@helium/address'
import Client, { PocReceiptsV2 } from '@helium/http'

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

const getLastChallenge = async (gatewayAddress: string, client: Client) => {
  const hotspotActivityList = await client
    .hotspot(gatewayAddress)
    .activity.list({
      filterTypes: [
        'poc_receipts_v1',
        'poc_receipts_v2',
        'poc_request_v1',
        'state_channel_close_v1',
      ],
    })
  const [lastHotspotActivity] = hotspotActivityList
    ? await hotspotActivityList?.take(1)
    : []

  if (!lastHotspotActivity) return

  return (lastHotspotActivity as PocReceiptsV2).height
}

export const createTransferTransaction = async ({
  hotspotAddress,
  userAddress,
  newOwnerAddress,
  client,
  ownerKeypairRaw,
}: {
  hotspotAddress: string
  userAddress: string
  newOwnerAddress: string
  client: Client
  ownerKeypairRaw?: SodiumKeyPair
}) => {
  const hotspot = await client.hotspots.get(hotspotAddress)
  if (!hotspot) {
    throw new Error('Hotspot not found')
  }
  const nonce = hotspot?.speculativeNonce ? hotspot?.speculativeNonce + 1 : 0

  if (!hotspot.owner) throw new Error('Hotspot owner not found')
  if (hotspot.owner !== userAddress) {
    throw new Error('Hotspot does not belong to user')
  }

  // check hotspot for valid activity
  const chainVars = await client.vars.get(['transfer_hotspot_stale_poc_blocks'])

  const staleBlockCount = chainVars.transferHotspotStalePocBlocks as number
  const blockHeight = await client.blocks.getHeight()
  const reportedActivityBlock = await getLastChallenge(hotspotAddress, client)
  const lastActiveBlock = reportedActivityBlock || 0
  if (blockHeight - lastActiveBlock > staleBlockCount) {
    throw new Error(
      'Hotspot has no recent Proof-of-Coverage or Data Transfer activity'
    )
  }

  const txn = new TransferHotspotV2({
    owner: Address.fromB58(hotspot.owner),
    gateway: Address.fromB58(hotspotAddress),
    newOwner: Address.fromB58(newOwnerAddress),
    nonce,
  })

  if (!ownerKeypairRaw) {
    return txn
  }
  return txn.sign({
    owner: getKeypair(ownerKeypairRaw),
  })
}
