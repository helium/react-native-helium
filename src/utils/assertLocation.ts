import { Address } from '@helium/crypto-react-native'
import { AssertLocationV2, Transaction } from '@helium/transactions'
import { heliumHttpClient } from '..'
import { getKeypair, SodiumKeyPair } from '../Account/account'
import { getStakingSignedTransaction } from '../Staking/stakingClient'
import { geoToH3 } from 'h3-js'
import { Balance, CurrencyType } from '@helium/currency'

const DEFAULT_H3_RES = 12

export const getH3Location = (lat: number, lng: number, res = DEFAULT_H3_RES) =>
  geoToH3(lat, lng, res)

export const hasFreeLocationAssert = (
  nonce: number,
  locationNonceLimit: number
) => nonce < locationNonceLimit

const emptyB58Address = () =>
  Address.fromB58('13PuqyWXzPYeXcF1B9ZRx7RLkEygeL374ZABiQdwRSNzASdA1sn')
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

export const makeAssertLocTxn = async ({
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
  const keypair = await getKeypair(ownerKeypairRaw)
  const owner = Address.fromB58(ownerB58)
  const gateway = Address.fromB58(gatewayB58)
  const payer = Address.fromB58(payerB58)
  const ownerIsPayer = payerB58 === ownerB58

  const assertLocTxn = new AssertLocationV2({
    owner,
    gateway,
    payer,
    nonce,
    gain,
    elevation,
    location,
    stakingFee,
  })

  return assertLocTxn.sign({
    owner: keypair,
    payer: ownerIsPayer ? keypair : undefined,
  })
}

export const assertLocationTxn = async ({
  gateway,
  owner,
  lat,
  lng,
  decimalGain = 1.2,
  elevation = 0,
  currentLocation: previousLocation,
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

  const nextLocation = getH3Location(lat, lng)
  const updatingLocation =
    !previousLocation || previousLocation !== nextLocation

  let speculativeNonce = 0
  const response = await heliumHttpClient.hotspots.get(gateway)
  speculativeNonce = response.speculativeNonce || 0
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

  const txn = await makeAssertLocTxn({
    ownerB58: owner,
    gatewayB58: gateway,
    payerB58: payer,
    location: nextLocation,
    nonce: newNonce,
    gain: antennaGain,
    elevation,
    stakingFee,
    ownerKeypairRaw,
  })

  let finalTxn = txn

  if (isFree) {
    const stakingServerSignedTxn = await getStakingSignedTransaction(
      gateway,
      txn.toString()
    )
    finalTxn = AssertLocationV2.fromString(stakingServerSignedTxn)
  }

  return finalTxn.toString()
}

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
