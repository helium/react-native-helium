import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import { AssertData, useOnboarding } from '@helium/react-native-sdk'
import Address from '@helium/address'
import { getPendingTxn } from '../../appDataClient'
import { getAddressStr, getKeypair } from '../Account/secureAccount'
import Input from '../Input'
import animalName from 'angry-purple-tiger'
import Config from 'react-native-config'

const AssertLocation = () => {
  const { getOnboardingRecord, submitAssertLocation, getAssertData } =
    useOnboarding()
  const [gatewayAddress, setGatewayAddress] = useState('')
  const [gatewayName, setGatewayName] = useState('')
  const [lat, setLat] = useState<string>()
  const [lng, setLng] = useState<string>()
  const [gain, setGain] = useState<string>()
  const [elevation, setElevation] = useState<string>()
  const [submitted, setSubmitted] = useState(false)
  const [hash, setHash] = useState('')
  const [status, setStatus] = useState('')
  const [failedReason, setFailedReason] = useState('')
  const [assertData, setAssertData] = useState<AssertData>()

  const updateAssertData = useCallback(async () => {
    if (!gatewayAddress || !lat || !lng) {
      setAssertData(undefined)
      return
    }

    const userAddress = await getAddressStr()
    const ownerKeypairRaw = await getKeypair()

    const data = await getAssertData({
      decimalGain: gain ? parseFloat(gain) : undefined,
      elevation: elevation ? parseFloat(elevation) : undefined,
      gateway: gatewayAddress,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      maker: Config.ONBOARDING_MAKER_ADDRESS || '',
      owner: userAddress,
      ownerKeypairRaw,
    })
    setAssertData(data)
  }, [elevation, gain, gatewayAddress, getAssertData, lat, lng])

  useEffect(() => {
    if (!Address.isValid(gatewayAddress)) {
      return
    }

    setGatewayName(animalName(gatewayAddress))
  }, [gatewayAddress, getOnboardingRecord])

  const handleAssert = useCallback(async () => {
    if (!assertData?.transaction) {
      return
    }

    setSubmitted(true)

    const { solTxId, pendingTxn } = await submitAssertLocation({
      transaction: assertData.transaction,
      gateway: gatewayAddress,
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
  }, [assertData, gatewayAddress, submitAssertLocation])

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
    if (!assertData || submitted) {
      return true
    }
    return false
  }, [assertData, submitted])

  return (
    <View style={styles.container}>
      <Input
        title={`Gateway${gatewayName ? `: ${gatewayName}` : ''}`}
        inputProps={{
          editable: !submitted,
          onChangeText: (t) => {
            setAssertData(undefined)
            setGatewayAddress(t)
          },
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
            onChangeText: (t) => {
              setAssertData(undefined)
              setLat(t)
            },
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
            onChangeText: (t) => {
              setAssertData(undefined)
              setLng(t)
            },
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
            onChangeText: (t) => {
              setAssertData(undefined)
              setGain(t)
            },
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
            onChangeText: (t) => {
              setAssertData(undefined)
              setElevation(t)
            },
            value: elevation,
            placeholder: 'Elevation',
            style: styles.input,
            keyboardType: 'decimal-pad',
          }}
        />
      </View>

      {assertData && (
        <>
          <Text style={styles.heading}>Amount to assert hotspot location</Text>
          <Text style={styles.text}>{`isFree: ${assertData.isFree}`}</Text>
          <Text
            style={styles.text}
          >{`hasSufficientBalance: ${assertData.hasSufficientBalance}`}</Text>
          <Text
            style={styles.text}
          >{`Helium Fees as HNT: ${assertData.heliumFee?.hnt?.toString()}`}</Text>
          <Text
            style={styles.text}
          >{`Helium Fees as DC: ${assertData.heliumFee?.dc.toString()}`}</Text>
          <Text
            style={styles.text}
          >{`Helium Fees as USD: ${assertData.heliumFee?.usd?.toString()}`}</Text>
          <Text
            style={styles.text}
          >{`Sol Fee: ${assertData.solFee?.toString()}`}</Text>
        </>
      )}
      <View style={styles.buttonRow}>
        <Button title="Update Assert Data" onPress={updateAssertData} />
      </View>
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
