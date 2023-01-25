/**
 * [[include:Location.md]]
 * @packageDocumentation
 * @module Location
 */

import Address from '@helium/address'
import { AssertLocationV2 } from '@helium/transactions'
import { getKeypair, SodiumKeyPair } from '../Account/account'
import { geoToH3 } from 'h3-js'
import { Hotspot } from '@helium/http'
import { isSolHotspot } from './solanaUtils'
import { SolHotspot } from '../types/solTypes'

const DEFAULT_H3_RES = 12

/**
 * Returns the H3 Hex of a lat lng location at a specific resolution.
 * The default resolution is 12. See [Uber H3](https://github.com/uber/h3)
 * for more info.
 * @param lat
 * @param lng
 * @param res
 */
export const getH3Location = (lat: number, lng: number, res = DEFAULT_H3_RES) =>
  geoToH3(lat, lng, res)

export const getStakingFee = ({
  updatingLocation,
  dataOnly,
}: {
  updatingLocation?: boolean
  dataOnly?: boolean
}) => {
  if (!updatingLocation) return 0

  // Hardcoding for now, will be dynamic at some point
  if (dataOnly) {
    return 500000
  }

  return 1000000
}

export const createLocationTxn = async ({
  gateway,
  owner,
  gain,
  elevation = 0,
  maker,
  isFree,
  hotspot,
  dataOnly,
  updatingLocation,
  nextLocation,
  ownerKeypairRaw,
}: {
  gateway: string
  owner: string
  gain?: number
  elevation?: number
  maker: string
  isFree?: boolean
  hotspot?: Hotspot | SolHotspot | null
  dataOnly?: boolean
  updatingLocation: boolean
  nextLocation: string
  ownerKeypairRaw?: SodiumKeyPair
}) => {
  const isSol = hotspot && isSolHotspot(hotspot)

  let nextNonce = isSol ? 0 : (hotspot?.speculativeNonce || 0) + 1

  const stakingFee = getStakingFee({ dataOnly, updatingLocation })
  const payer = isFree ? maker : owner

  const locTxn = new AssertLocationV2({
    owner: Address.fromB58(owner),
    gateway: Address.fromB58(gateway),
    payer: Address.fromB58(payer),
    nonce: nextNonce,
    gain,
    elevation,
    location: nextLocation,
    stakingFee,
  })

  if (!ownerKeypairRaw) {
    return locTxn
  }

  const keypair = getKeypair(ownerKeypairRaw)
  const ownerIsPayer = payer === owner

  return locTxn.sign({
    owner: keypair,
    payer: ownerIsPayer ? keypair : undefined,
  })
}

export const signAssert = async ({
  ownerKeypairRaw,
  payer,
  owner,
  assertLocationTxn,
}: {
  ownerKeypairRaw: SodiumKeyPair
  payer: string
  owner: string
  assertLocationTxn: AssertLocationV2
}) => {
  const keypair = getKeypair(ownerKeypairRaw)
  const ownerIsPayer = payer === owner
  const txnOwnerSigned = await assertLocationTxn.sign({
    owner: keypair,
    payer: ownerIsPayer ? keypair : undefined,
  })
  if (!txnOwnerSigned.gateway?.b58) {
    throw new Error('Failed to sign gateway txn')
  }
  return txnOwnerSigned
}

export const signAssertTxn = async ({
  assertLocationTxn,
  ...opts
}: {
  ownerKeypairRaw: SodiumKeyPair
  payer: string
  owner: string
  assertLocationTxn: string
}) => {
  const assert = txnFromString(assertLocationTxn)
  return signAssert({ ...opts, assertLocationTxn: assert })
}

export const txnFromString = (txnStr: string): AssertLocationV2 =>
  AssertLocationV2.fromString(txnStr)
