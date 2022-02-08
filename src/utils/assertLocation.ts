/**
 * [[include:Location.md]]
 * @packageDocumentation
 * @module Location
 */

import { Address } from '@helium/crypto-react-native'
import { AssertLocationV2, Transaction } from '@helium/transactions'
import { getKeypair, SodiumKeyPair } from '../Account/account'
import { geoToH3 } from 'h3-js'
import { Balance, CurrencyType } from '@helium/currency'
import { heliumHttpClient } from './httpClient'
import { emptyB58Address } from './txnHelper'

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

/**
 * Determine if a hotspot still has a location assert paid for by its maker.
 * @param nonce
 * @param locationNonceLimit
 */
export const hasFreeLocationAssert = (
  nonce: number,
  locationNonceLimit: number
) => nonce < locationNonceLimit

export const calculateAssertLocFee = (
  ownerB58: string | undefined,
  payerB58: string | undefined,
  nonce: number | undefined
) => {
  const owner = ownerB58 ? Address.fromB58(ownerB58) : emptyB58Address()
  const payer = payerB58 ? Address.fromB58(payerB58) : emptyB58Address()

  const txn = new AssertLocationV2({
    owner,
    gateway: emptyB58Address(),
    payer,
    location: 'fffffffffffffff',
    gain: 12,
    elevation: 1,
    nonce: nonce || 1,
  })

  return { fee: txn.fee || 0, stakingFee: txn.stakingFee || 0 }
}

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

export const signAssertLocTxn = async ({
  ownerB58,
  gatewayB58,
  payerB58,
  location,
  nonce,
  gain,
  elevation,
  stakingFee,
  ownerKeypairRaw,
}: {
  ownerB58: string
  gatewayB58: string
  payerB58: string
  location: string
  nonce: number
  gain: number
  elevation: number
  stakingFee: number
  ownerKeypairRaw: SodiumKeyPair
}) => {
  const assertLocTxn = makeAssertLocTxn({
    ownerB58,
    gatewayB58,
    payerB58,
    location,
    nonce,
    gain,
    elevation,
    stakingFee,
  })

  const keypair = await getKeypair(ownerKeypairRaw)
  const ownerIsPayer = payerB58 === ownerB58

  return assertLocTxn.sign({
    owner: keypair,
    payer: ownerIsPayer ? keypair : undefined,
  })
}
export const txnFromString = (txnStr: string) =>
  AssertLocationV2.fromString(txnStr)

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
  currentLocation,
  dataOnly = false,
  ownerKeypairRaw,
  makerAddress,
  locationNonceLimit,
}: {
  gateway: string
  owner: string
  lat: number
  lng: number
  decimalGain?: number
  elevation?: number
  currentLocation?: string
  dataOnly?: boolean
  ownerKeypairRaw: SodiumKeyPair
  makerAddress: string
  locationNonceLimit: number
}) => {
  if (!lat || !lng) {
    throw new Error('Lat Lng invalid')
  }
  let speculativeNonce = 0
  const response = await heliumHttpClient.hotspots.get(gateway)
  speculativeNonce = response.speculativeNonce || 0
  let isFree = false
  if (!dataOnly) {
    isFree = hasFreeLocationAssert(speculativeNonce, locationNonceLimit)
  }
  const payer = isFree ? makerAddress : owner

  const locTxn = await createLocationTxn({
    gateway,
    owner,
    lat,
    lng,
    decimalGain,
    elevation,
    currentLocation,
    dataOnly,
    makerAddress,
    locationNonceLimit,
  })

  const keypair = await getKeypair(ownerKeypairRaw)
  const ownerIsPayer = payer === owner

  locTxn.sign({
    owner: keypair,
    payer: ownerIsPayer ? keypair : undefined,
  })

  return { signedTxn: locTxn, isFree }
}

export const createLocationTxn = async ({
  gateway,
  owner,
  lat,
  lng,
  decimalGain = 1.2,
  elevation = 0,
  currentLocation: previousLocation,
  dataOnly = false,
  makerAddress,
  locationNonceLimit,
}: {
  gateway: string
  owner: string
  lat: number
  lng: number
  decimalGain?: number
  elevation?: number
  currentLocation?: string
  dataOnly?: boolean
  makerAddress: string
  locationNonceLimit: number
}) => {
  if (!lat || !lng) {
    throw new Error('Lat Lng invalid')
  }

  const nextLocation = getH3Location(lat, lng)
  const updatingLocation =
    !previousLocation || previousLocation !== nextLocation

  let speculativeNonce = 0
  try {
    const response = await heliumHttpClient.hotspots.get(gateway)
    speculativeNonce = response.speculativeNonce || 0
  } catch {
    // this is expected if the hotspot has not yet been added
    console.log(`Could not find hotspot details for ${gateway}`)
  }
  const newNonce = speculativeNonce + 1
  let isFree = false
  if (!dataOnly) {
    isFree = hasFreeLocationAssert(speculativeNonce, locationNonceLimit)
  }
  const payer = isFree ? makerAddress : owner

  const antennaGain = decimalGain * 10
  let stakingFee = 0
  if (updatingLocation) {
    if (dataOnly) {
      const chainVars = await heliumHttpClient.vars.get()
      const { stakingFeeTxnAssertLocationDataonlyGatewayV1: fee } = chainVars
      stakingFee = fee
    } else {
      stakingFee = Transaction.stakingFeeTxnAssertLocationV1
    }
  }
  return makeAssertLocTxn({
    ownerB58: owner,
    gatewayB58: gateway,
    payerB58: payer,
    location: nextLocation,
    nonce: newNonce,
    gain: antennaGain,
    elevation,
    stakingFee,
  })
}

/**
 * Get all required fee information for a Hotspot Assert Location transaction.
 * @param nonce
 * @param accountIntegerBalance
 * @param locationNonceLimit
 * @param makerAddress
 * @param dataOnly
 * @param owner
 */
export const loadLocationFeeData = async ({
  nonce = 0,
  accountIntegerBalance,
  locationNonceLimit,
  makerAddress,
  dataOnly = false,
  owner,
}: {
  nonce?: number
  accountIntegerBalance: number
  locationNonceLimit: number
  makerAddress: string
  dataOnly?: boolean
  owner: string
}) => {
  let isFree = false
  if (!dataOnly) {
    isFree = hasFreeLocationAssert(nonce, locationNonceLimit)
  }
  const payer = isFree ? makerAddress : owner

  if (!owner || !payer) {
    throw new Error('Missing payer or owner')
  }

  const { price: oraclePrice } = await heliumHttpClient.oracle.getCurrentPrice()

  let totalStakingAmountDC = new Balance(0, CurrencyType.dataCredit)

  if (!dataOnly) {
    const { stakingFee, fee } = calculateAssertLocFee(owner, payer, nonce)

    totalStakingAmountDC = new Balance(
      stakingFee + fee,
      CurrencyType.dataCredit
    )
  } else {
    const chainVars = await heliumHttpClient.vars.get()
    const { stakingFeeTxnAssertLocationDataonlyGatewayV1: fee } = chainVars
    totalStakingAmountDC = new Balance(fee, CurrencyType.dataCredit)
  }

  const totalStakingAmount = totalStakingAmountDC.toNetworkTokens(oraclePrice)
  const totalStakingAmountUsd = totalStakingAmountDC.toUsd(oraclePrice)

  const hasSufficientBalance =
    accountIntegerBalance >= totalStakingAmount.integerBalance
  const remainingFreeAsserts = locationNonceLimit - nonce

  return {
    isFree,
    hasSufficientBalance,
    remainingFreeAsserts,
    totalStakingAmount,
    totalStakingAmountDC,
    totalStakingAmountUsd,
  }
}
