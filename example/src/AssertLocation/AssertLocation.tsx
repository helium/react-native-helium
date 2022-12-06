import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import {
  AssertLocationV2,
  Location,
  useOnboarding,
} from '@helium/react-native-sdk'
import Address from '@helium/address'
import {
  getAccount,
  getHotspotDetails,
  getPendingTxn,
  submitPendingTxn,
} from '../../appDataClient'
import type { Account, Hotspot } from '@helium/http'
import { getKeypair, getSecureItem } from '../Account/secureAccount'
import type {
  Balance,
  DataCredits,
  NetworkTokens,
  USDollars,
} from '@helium/currency'
import { OnboardingRecord } from '@helium/onboarding'
import Input from '../Input'
import animalName from 'angry-purple-tiger'
import getSolanaStatus from '../../../src/utils/getSolanaStatus'
import { TransactionError } from '@solana/web3.js'

const AssertLocation = () => {
  const { getOnboardingRecord, postPaymentTransaction, submitSolana } =
    useOnboarding()
  const [account, setAccount] = useState<Account>()
  const [gatewayAddress, setGatewayAddress] = useState('')
  const [gatewayName, setGatewayName] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [gain, setGain] = useState('')
  const [elevation, setElevation] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [hash, setHash] = useState('')
  const [status, setStatus] = useState('')
  const [failedReason, setFailedReason] = useState('')
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null)
  const [hotspot, setHotspot] = useState<Hotspot>()
  const [onboardingRecord, setOnboardingRecord] =
    useState<OnboardingRecord | null>(null)
  const [feeData, setFeeData] = useState<{
    isFree: boolean
    hasSufficientBalance: boolean
    remainingFreeAsserts: number
    totalStakingAmount: Balance<NetworkTokens>
    totalStakingAmountDC: Balance<DataCredits>
    totalStakingAmountUsd: Balance<USDollars>
  }>()

  useEffect(() => {
    getSecureItem('address').then(setOwnerAddress)
  }, [])

  useEffect(() => {
    if (!ownerAddress) return
    getAccount(ownerAddress).then(setAccount)
  }, [ownerAddress])

  useEffect(() => {
    if (!Address.isValid(gatewayAddress)) {
      setFeeData(undefined)
      setLat('')
      setLng('')
      setGain('')
      setElevation('')
      return
    }

    setGatewayName(animalName(gatewayAddress))
    getHotspotDetails(gatewayAddress)
      .then(setHotspot)
      .catch((e) => console.log(e))

    getOnboardingRecord(gatewayAddress)
      .then((d) => setOnboardingRecord(d))
      .catch((e) => console.log(e))
  }, [gatewayAddress, getOnboardingRecord])

  useEffect(() => {
    if (!hotspot || !onboardingRecord || !ownerAddress || !account?.balance) {
      return
    }

    Location.loadLocationFeeData({
      nonce: 0,
      accountIntegerBalance: account.balance.integerBalance,
      dataOnly: false,
      owner: ownerAddress,
      locationNonceLimit: onboardingRecord.maker.locationNonceLimit,
      makerAddress: onboardingRecord.maker.address,
    }).then(setFeeData)
  }, [hotspot, onboardingRecord, ownerAddress, account])

  useEffect(() => {
    if (!hotspot || !hotspot.lat || !hotspot.lng) {
      return
    }

    setLat(hotspot.lat.toString())
    setLng(hotspot.lng.toString())
    setGain(hotspot.gain ? (hotspot.gain / 10).toString() : '')
    setElevation(hotspot.elevation?.toString() || '')
  }, [hotspot])

  const handleAssert = useCallback(async () => {
    const solanaStatus = await getSolanaStatus()
    if (solanaStatus === 'in_progress') {
      throw new Error('Chain transfer in progress')
    }

    if (
      !gatewayAddress ||
      !ownerAddress ||
      !lat ||
      !lng ||
      !gain ||
      !elevation ||
      !onboardingRecord
    )
      return

    setSubmitted(true)
    const ownerKeypairRaw = await getKeypair()
    const { isFree, signedTxn } = await Location.createAndSignAssertLocationTxn(
      {
        gateway: gatewayAddress,
        owner: ownerAddress,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        decimalGain: parseFloat(gain),
        elevation: parseFloat(elevation),
        locationNonceLimit: onboardingRecord.maker.locationNonceLimit,
        makerAddress: onboardingRecord.maker.address,
        ownerKeypairRaw,
        currentLocation: hotspot?.location,
      }
    )

    let finalTxn = signedTxn
    let solanaResponses: {
      err: TransactionError | null
      slot: number
      signature: string
    }[] = []

    if (isFree) {
      // Note: This submits to solana 👇
      const onboardResponse = await postPaymentTransaction(
        gatewayAddress,
        finalTxn.toString()
      )

      solanaResponses = onboardResponse?.solanaResponses || []

      if (onboardResponse?.transaction) {
        finalTxn = AssertLocationV2.fromString(onboardResponse.transaction)
      }
    } else {
      // Need to submit to solana
      const response = await submitSolana(finalTxn.toString())
      solanaResponses = [response]
    }

    if (solanaStatus === 'not_started') {
      const pendingTxn = await submitPendingTxn(finalTxn.toString())
      setHash(pendingTxn.hash)
      setStatus(pendingTxn.status)
      setFailedReason(pendingTxn.failedReason || '')
      return
    }

    if (solanaResponses.length) {
      const sigs = solanaResponses.map((r) => r.signature).join(',')
      setHash(sigs)
      const errors = solanaResponses.map((r) => r.err?.toString())
      const hasError = !!solanaResponses.find((r) => !!r.err)
      setFailedReason(errors.join(','))
      setStatus(hasError ? 'Success' : 'Error')
    }
  }, [
    elevation,
    gain,
    gatewayAddress,
    hotspot?.location,
    lat,
    lng,
    onboardingRecord,
    ownerAddress,
    postPaymentTransaction,
    submitSolana,
  ])

  const updateTxnStatus = useCallback(async () => {
    if (!hash) return
    const pendingTxns = await (await getPendingTxn(hash)).data
    if (!pendingTxns.length) return
    setStatus(pendingTxns[0].status)
    setFailedReason(pendingTxns[0].failedReason || '')
  }, [hash])

  useEffect(() => {
    const interval = setInterval(() => {
      updateTxnStatus()
    }, 3000)
    return () => clearInterval(interval)
  }, [updateTxnStatus])

  const canAssert = useMemo(() => {
    if (
      !hotspot ||
      !onboardingRecord ||
      !lat ||
      !lng ||
      !feeData?.hasSufficientBalance ||
      submitted
    )
      return false
    const h3Location = Location.getH3Location(parseFloat(lat), parseFloat(lng))

    // location hasn't changed, just update antenna info, no charge
    if (h3Location === hotspot.location) return false
    return true
  }, [
    feeData?.hasSufficientBalance,
    hotspot,
    lat,
    lng,
    onboardingRecord,
    submitted,
  ])

  const canUpdateAntenna = useMemo(() => {
    if (
      !hotspot ||
      !onboardingRecord ||
      !feeData ||
      !gain ||
      !elevation ||
      submitted
    )
      return false

    const h3Location = Location.getH3Location(parseFloat(lat), parseFloat(lng))
    // location has changed, assert will be charged
    if (h3Location !== hotspot.location) return false

    return true
  }, [elevation, feeData, gain, hotspot, lat, lng, onboardingRecord, submitted])

  return (
    <View style={styles.container}>
      <Input
        title={`Gateway${gatewayName ? `: ${gatewayName}` : ''}`}
        inputProps={{
          editable: !submitted,
          onChangeText: setGatewayAddress,
          value: gatewayAddress,
          placeholder: 'Enter Gateway Address',
          style: styles.input,
        }}
      />

      <View style={styles.inputRow}>
        <Input
          style={{ ...styles.inputRowItem, ...styles.marginRight }}
          title="Lat"
          inputProps={{
            editable: !submitted,
            onChangeText: setLat,
            value: lat,
            placeholder: 'Lat',
            style: styles.input,
            keyboardType: 'decimal-pad',
          }}
        />
        <Input
          style={styles.inputRowItem}
          title="Lng"
          inputProps={{
            editable: !submitted,
            onChangeText: setLng,
            value: lng,
            placeholder: 'Lng',
            style: styles.input,
            keyboardType: 'decimal-pad',
          }}
        />
      </View>
      <View style={styles.inputRow}>
        <Input
          style={{ ...styles.inputRowItem, ...styles.marginRight }}
          title="Gain"
          inputProps={{
            editable: !submitted,
            onChangeText: setGain,
            value: gain,
            placeholder: 'Gain',
            style: styles.input,
            keyboardType: 'decimal-pad',
          }}
        />
        <Input
          style={styles.inputRowItem}
          title="Elevation"
          inputProps={{
            editable: !submitted,
            onChangeText: setElevation,
            value: elevation,
            placeholder: 'Elevation',
            style: styles.input,
            keyboardType: 'decimal-pad',
          }}
        />
      </View>

      {feeData && (
        <>
          <Text style={styles.heading}>Amount to assert hotspot location</Text>
          <Text style={styles.text}>{`isFree: ${feeData.isFree}`}</Text>
          <Text
            style={styles.text}
          >{`hasSufficientBalance: ${feeData.hasSufficientBalance}`}</Text>
          <Text
            style={styles.text}
          >{`totalStakingAmount: ${feeData.totalStakingAmount.toString()}`}</Text>
          <Text
            style={styles.text}
          >{`totalStakingAmountDC: ${feeData.totalStakingAmountDC.toString()}`}</Text>
          <Text
            style={styles.text}
          >{`totalStakingAmountUSD: ${feeData.totalStakingAmountUsd.toString()}`}</Text>
        </>
      )}
      <View style={styles.buttonRow}>
        <Button
          title="Assert Location"
          onPress={handleAssert}
          disabled={!canAssert}
        />
        <Button
          title="Update Antenna"
          onPress={handleAssert}
          disabled={!canUpdateAntenna}
        />
      </View>
      <Text style={styles.topMargin}>Pending Txn Hash:</Text>
      <Text style={styles.topMargin} selectable>
        {hash}
      </Text>
      <Text style={styles.topMargin}>{`Pending Txn Status: ${status}`}</Text>
      <Text
        style={styles.topMargin}
      >{`Pending Txn Failed Reason: ${failedReason}`}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    margin: 24,
  },
  topMargin: { marginTop: 16 },
  marginRight: { marginRight: 16 },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 16,
  },
  inputRowItem: { flex: 1 },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 24,
  },
  input: {
    borderRadius: 12,
    fontSize: 17,
    padding: 16,
    backgroundColor: 'white',
    marginTop: 4,
  },
  heading: {
    fontSize: 19,
    marginLeft: 16,
    marginTop: 16,
  },
  text: {
    fontSize: 15,
    marginLeft: 24,
  },
})

export default AssertLocation
