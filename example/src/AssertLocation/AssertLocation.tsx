import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import {
  Account as AccountUtil,
  Location,
  useOnboarding,
} from '@helium/react-native-sdk'
import Address from '@helium/address'
import { getPendingTxn } from '../../appDataClient'
import { getAddressStr, getKeypair } from '../Account/secureAccount'
import type {
  Balance,
  DataCredits,
  NetworkTokens,
  USDollars,
} from '@helium/currency'
import Input from '../Input'
import animalName from 'angry-purple-tiger'
import Config from 'react-native-config'

const AssertLocation = () => {
  const {
    getOnboardingRecord,
    hasFreeAssert,
    getHotspotForCurrentChain,
    assertLocation,
  } = useOnboarding()
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
  const [feeData, setFeeData] = useState<{
    isFree: boolean
    hasSufficientBalance: boolean
    remainingFreeAsserts: number
    totalStakingAmount: Balance<NetworkTokens>
    totalStakingAmountDC: Balance<DataCredits>
    totalStakingAmountUsd: Balance<USDollars>
  }>()

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
  }, [gatewayAddress, getOnboardingRecord])

  const handleAssert = useCallback(async () => {
    const userAddress = await getAddressStr()
    const userSolPubKey = AccountUtil.heliumAddressToSolPublicKey(userAddress)

    const hotspot = await getHotspotForCurrentChain({
      userSolPubKey,
      hotspotAddress: gatewayAddress,
    })

    const isFree = await hasFreeAssert({
      hotspot,
    })

    const ownerKeypairRaw = await getKeypair()

    const transaction = (
      await Location.createAndSignAssertLocationTxn({
        hotspot,
        gateway: gatewayAddress,
        owner: userAddress,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        decimalGain: parseFloat(gain),
        elevation: parseFloat(elevation),
        ownerKeypairRaw,
        makerAddress: Config.ONBOARDING_MAKER_ADDRESS || '',
        isFree,
      })
    ).toString()

    setSubmitted(true)

    const { solTxId, pendingTxn } = await assertLocation({
      gatewayAddress,
      isFree,
      transaction,
    })

    if (pendingTxn) {
      setHash(pendingTxn.hash)
      setStatus(pendingTxn.status)
      setFailedReason(pendingTxn.failedReason || '')
    } else if (solTxId) {
      setHash(solTxId)
      setStatus('complete')
    } else {
      setStatus('fail')
    }
  }, [
    assertLocation,
    elevation,
    gain,
    gatewayAddress,
    getHotspotForCurrentChain,
    hasFreeAssert,
    lat,
    lng,
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

  const disabled = useMemo(() => {
    if (!lat || !lng || !gatewayAddress || submitted) {
      return true
    }
    return false
  }, [gatewayAddress, lat, lng, submitted])

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
          disabled={disabled}
        />
      </View>
      <Text style={styles.topMargin}>Txn</Text>
      <Text style={styles.topMargin} selectable>
        {hash}
      </Text>
      <Text style={styles.topMargin}>{`Txn Status: ${status}`}</Text>
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
