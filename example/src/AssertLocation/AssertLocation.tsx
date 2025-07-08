import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { AssertData, useOnboarding } from '@helium/react-native-sdk'
import Address from '@helium/address'
import { getPendingTxn } from '../../appDataClient'
import { getAddressStr, getKeypairRaw } from '../Account/secureAccount'
import Input from '../Input'
import animalName from 'angry-purple-tiger'
import { bufferToTransaction, getSolanaKeypair } from '@helium/spl-utils'
import { Buffer } from 'buffer'
import { HotspotType } from '../AddGatewayTxn/AddGatewayTxn'

const AssertLocation = () => {
  const { getOnboardingRecord, submitTransactions, getAssertData } =
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
  const [hotspotTypes, setHotspotTypes] = useState<HotspotType[]>([])

  const updateAssertData = useCallback(async () => {
    if (!gatewayAddress || !lat || !lng) {
      setAssertData(undefined)
      return
    }

    const userAddress = await getAddressStr()

    const data = await getAssertData({
      gateway: gatewayAddress,
      owner: userAddress,
      networkDetails: hotspotTypes.map((hotspotType) => ({
        hotspotType,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        decimalGain: gain ? parseFloat(gain) : undefined,
        elevation: elevation ? parseFloat(elevation) : undefined,
      })),
    })
    setAssertData(data)
  }, [elevation, gain, gatewayAddress, getAssertData, hotspotTypes, lat, lng])

  useEffect(() => {
    if (!Address.isValid(gatewayAddress)) {
      return
    }

    setGatewayName(animalName(gatewayAddress))
  }, [gatewayAddress, getOnboardingRecord])

  const handleAssert = useCallback(async () => {
    if (!assertData?.solanaTransactions?.length) {
      return
    }

    setSubmitted(true)
    const ownerKeypairRaw = await getKeypairRaw()

    let solanaTransactions: string[] | undefined

    if (assertData.solanaTransactions) {
      const solanaKeypair = getSolanaKeypair(ownerKeypairRaw.sk)

      solanaTransactions = assertData.solanaTransactions.map((txn) => {
        const tx = bufferToTransaction(Buffer.from(txn, 'base64'))
        tx.partialSign(solanaKeypair)
        return tx.serialize().toString('base64')
      })
    }

    const { solanaTxnIds } = await submitTransactions({
      solanaTransactions,
    })

    if (solanaTxnIds?.length) {
      setHash(solanaTxnIds.join(', '))
      setStatus('complete')
    } else {
      setStatus('fail')
    }
    setSubmitted(false)
  }, [assertData, submitTransactions])

  const updateTxnStatus = useCallback(async () => {
    if (!hash) return
    const pendingTxns = (await getPendingTxn(hash)).data
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
    if (!assertData?.hasSufficientBalance || submitted) {
      return true
    }
    return false
  }, [assertData, submitted])

  const handleHotspotTypeChange = useCallback(
    (hotspotType: HotspotType) => (val: boolean) => {
      const next = hotspotTypes.filter((t) => t !== hotspotType)
      if (!val) {
        setHotspotTypes(next)
      } else {
        setHotspotTypes([...next, hotspotType])
      }
    },
    [hotspotTypes]
  )

  return (
    // eslint-disable-next-line react-native/no-inline-styles
    <ScrollView style={{ marginTop: 48 }} canCancelContentTouches>
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
          <Text style={[styles.text, styles.topMargin]}>
            {`isFree: ${assertData.isFree}\n`}
            {`hasSufficientBalance: ${assertData.hasSufficientBalance}\n`}
            {`hasSufficientHnt: ${assertData.hasSufficientHnt}\n`}
            {`DC Fee to Owner: ${assertData.ownerFees?.dc?.toString()}\n`}
            {`SOL Fee to Owner: ${assertData.ownerFees?.sol?.toString()}\n`}
            {`DC Fee to Maker: ${assertData.makerFees?.dc?.toString()}\n`}
            {`SOL Fee to Maker: ${assertData.makerFees?.sol?.toString()}\n`}
            {`Amount to Burn: ${assertData.dcNeeded?.toString()}\n`}
          </Text>
        )}

        <>
          <View style={styles.switchRow}>
            <Switch
              onValueChange={handleHotspotTypeChange('IOT')}
              value={hotspotTypes.includes('IOT')}
            />
            <Text style={styles.leftMargin}>is this an IOT Hotspot?</Text>
          </View>

          <View style={styles.switchRow}>
            <Switch
              onValueChange={handleHotspotTypeChange('MOBILE')}
              value={hotspotTypes.includes('MOBILE')}
            />
            <Text style={styles.leftMargin}>is this a MOBILE Hotspot?</Text>
          </View>
        </>
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
    </ScrollView>
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
  leftMargin: { marginLeft: 8 },
  switchRow: {
    flexDirection: 'row',
    marginTop: 16,
    alignItems: 'center',
  },
})

export default AssertLocation
