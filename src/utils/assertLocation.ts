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
    isFree,
    elevation,
    makerAddress,
    hotspot,
  })

  const keypair = getKeypair(ownerKeypairRaw)
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
  makerAddress: string
  isFree?: boolean
  hotspot?: Hotspot | SolHotspot | null
}) => {
  if (!lat || !lng) {
    throw new Error('Lat Lng invalid')
  }

  const isSol = hotspot && isSolHotspot(hotspot)

  const nextLocation = getH3Location(lat, lng)
  let stakingFee = 0
  const antennaGain = decimalGain * 10

  let nextNonce = isSol ? 0 : (hotspot?.speculativeNonce || 0) + 1

  let updatingLocation = !hotspot
  if (hotspot) {
    if (!isSol) {
      updatingLocation = hotspot.location !== nextLocation
    } else if (hotspot.location) {
      // TODO: Not sure if this is correct
      const loc = hotspot.location.toString('hex')
      updatingLocation = loc !== nextLocation
    }
  }

  if (updatingLocation) {
    // Hardcoding for now, will be dynamic at some point
    stakingFee = 1000000
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
