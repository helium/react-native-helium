/**
 * [[include:Location.md]]
 * @packageDocumentation
 * @module Location
 */

import Address from '@helium/address'
import { AssertLocationV2, Transaction } from '@helium/transactions'
import { getKeypair, SodiumKeyPair } from '../Account/account'
import { geoToH3 } from 'h3-js'
import { heliumHttpClient } from './httpClient'
import { Hotspot } from '@helium/http'
import { SolHotspot } from '../Onboarding/onboardingTypes'
import { isSolHotspot } from '../Onboarding/useOnboarding'

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

export const makeAssertLocTxn = ({
  ownerB58,
  gatewayB58,
  payerB58,
  location,
  nonce,
  gain,
  elevation,
  stakingFee,
}: {
  ownerB58: string
  gatewayB58: string
  payerB58: string
  location: string
  nonce: number
  gain: number
  elevation: number
  stakingFee: number
}) => {
  const owner = Address.fromB58(ownerB58)
  const gateway = Address.fromB58(gatewayB58)
  const payer = Address.fromB58(payerB58)

  return new AssertLocationV2({
    owner,
    gateway,
    payer,
    nonce,
    gain,
    elevation,
    location,
    stakingFee,
  })
}

/**
 * Create a signed [AddGatewayV1](https://helium.github.io/helium-js/classes/transactions.AddGatewayV1.html)
 * transaction string which can be submit to the blockchain using {@link heliumHttpClient}
 * @param gateway
 * @param owner
 * @param lat
 * @param lng
 * @param decimalGain
 * @param elevation
 * @param currentLocation
 * @param dataOnly
 * @param ownerKeypairRaw
 * @param makerAddress
 * @param locationNonceLimit
 */
export const createAndSignAssertLocationTxn = async ({
  gateway,
  owner,
  lat,
  lng,
  decimalGain = 1.2,
  elevation = 0,
  dataOnly = false,
  ownerKeypairRaw,
  makerAddress,
  isFree,
  hotspot,
}: {
  gateway: string
  owner: string
  lat: number
  lng: number
  decimalGain?: number
  elevation?: number
  dataOnly?: boolean
  ownerKeypairRaw: SodiumKeyPair
  makerAddress: string
  isFree?: boolean
  hotspot?: Hotspot | SolHotspot | null
}) => {
  if (!lat || !lng) {
    throw new Error('Lat Lng invalid')
  }
  const payer = isFree ? makerAddress : owner

  const locTxn = await createLocationTxn({
    gateway,
    owner,
    lat,
    lng,
    decimalGain,
    elevation,
    dataOnly,
    makerAddress,
    hotspot,
  })

  const keypair = await getKeypair(ownerKeypairRaw)
  const ownerIsPayer = payer === owner

  return locTxn.sign({
    owner: keypair,
    payer: ownerIsPayer ? keypair : undefined,
  })
}

export const createLocationTxn = async ({
  gateway,
  owner,
  lat,
  lng,
  decimalGain = 1.2,
  elevation = 0,
  dataOnly = false,
  makerAddress,
  isFree,
  hotspot,
}: {
  gateway: string
  owner: string
  lat: number
  lng: number
  decimalGain?: number
  elevation?: number
  dataOnly?: boolean
  makerAddress: string
  isFree?: boolean
  hotspot?: Hotspot | SolHotspot | null
}) => {
  if (!lat || !lng) {
    throw new Error('Lat Lng invalid')
  }

  const nextLocation = getH3Location(lat, lng)
  let nextNonce = 0
  let stakingFee = 0
  const antennaGain = decimalGain * 10

  let previousLocation = ''

  if (hotspot) {
    if (!isSolHotspot(hotspot)) {
      previousLocation = hotspot.location || ''
      const updatingLocation =
        !previousLocation || previousLocation !== nextLocation

      nextNonce = (hotspot.speculativeNonce || 0) + 1

      if (updatingLocation) {
        if (dataOnly) {
          const chainVars = await heliumHttpClient.vars.get()
          const { stakingFeeTxnAssertLocationDataonlyGatewayV1: fee } =
            chainVars
          stakingFee = fee
        } else {
          stakingFee = Transaction.stakingFeeTxnAssertLocationV1
        }
      }
    } else {
      // TODO: Figure out how to get location
      // from noah: location is the u64 of the hex string
      // bn.js
      console.log('sol hotspot location is: ', hotspot.location)
    }
  }

  const payer = isFree ? makerAddress : owner
  return makeAssertLocTxn({
    ownerB58: owner,
    gatewayB58: gateway,
    payerB58: payer,
    location: nextLocation,
    nonce: nextNonce,
    gain: antennaGain,
    elevation,
    stakingFee,
  })
}
