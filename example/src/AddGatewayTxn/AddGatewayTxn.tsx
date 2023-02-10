import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  Button,
  TouchableOpacity,
  Switch,
} from 'react-native'
import {
  AddGateway,
  AddGatewayV1,
  useOnboarding,
  useSolana,
} from '@helium/react-native-sdk'
import { getPendingTxn } from '../../appDataClient'
import { getAddressStr, getKeypairRaw } from '../Account/secureAccount'
import Clipboard from '@react-native-community/clipboard'
import { HotspotType } from '@helium/onboarding'
import { bufferToTransaction, getSolanaKeypair } from '@helium/spl-utils'
import { Buffer } from 'buffer'
import Input from '../Input'
import Address from '@helium/address'
import animalName from 'angry-purple-tiger'

const AddGatewayTxn = () => {
  const [txnStr, setTxnStr] = useState('')
  const [hotspotAddress, setHotspotAddress] = useState('')
  const [macAddress, setMacAddress] = useState('')
  const [ownerAddress, setOwnerAddress] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [hash, setHash] = useState('')
  const [solTxId, setSolTxId] = useState('')
  const [status, setStatus] = useState('')
  const [failedReason, setFailedReason] = useState('')
  const [hotspotTypes, setHotspotTypes] = useState<HotspotType[]>([])
  const {
    createHotspot,
    getOnboardingRecord,
    getOnboardTransactions,
    submitTransactions,
  } = useOnboarding()
  const {
    status: { isSolana },
  } = useSolana()

  useEffect(() => {
    if (!hotspotAddress) return

    getOnboardingRecord(hotspotAddress).then((r) => {
      console.log(r)
      setMacAddress(r?.macEth0 || 'unknown')
    })
  }, [getOnboardingRecord, hotspotAddress])

  useEffect(() => {
    if (!txnStr) return

    try {
      const txn = AddGateway.txnFromString(txnStr)

      setHotspotAddress(txn.gateway?.b58 || '')
      setOwnerAddress(txn.owner?.b58 || '')
    } catch (e) {
      console.log(e)
    }
  }, [txnStr])

  const submitOnboardingTxns = useCallback(async () => {
    setSubmitted(true)

    const createResponse = await createHotspot(txnStr)
    if (!createResponse?.length) {
      throw new Error('Could not create hotspot')
    }

    const { addGatewayTxn, solanaTransactions } = await getOnboardTransactions({
      txn: txnStr,
      hotspotAddress,
      hotspotTypes,
    })

    let solanaSignedTransactions: string[] | undefined

    if (solanaTransactions) {
      const keypair = await getKeypairRaw()
      const solanaKeypair = getSolanaKeypair(keypair.sk)

      solanaSignedTransactions = solanaTransactions.map((txn) => {
        const tx = bufferToTransaction(Buffer.from(txn, 'base64'))
        tx.partialSign(solanaKeypair)
        return tx.serialize().toString('base64')
      })
    }

    const userAddress = await getAddressStr()
    if (!userAddress) {
      throw new Error('No user found')
    }

    let txnOwnerSigned: AddGatewayV1 | undefined
    if (addGatewayTxn) {
      const keypair = await getKeypairRaw()
      txnOwnerSigned = await AddGateway.signGatewayTxn(txnStr, keypair)
    }

    const response = await submitTransactions({
      hotspotAddress,
      addGatewayTxn: txnOwnerSigned?.toString(),
      solanaTransactions: solanaSignedTransactions,
    })

    if (response?.pendingGatewayTxn) {
      setHash(response.pendingGatewayTxn.hash)
      setStatus(response.pendingGatewayTxn.status)
      setFailedReason(response.pendingGatewayTxn.failedReason || '')
      return
    }

    if (response?.solanaTxnIds?.length) {
      setSolTxId(response.solanaTxnIds.join(', '))
      setStatus('Solana Success')
    }
  }, [
    createHotspot,
    getOnboardTransactions,
    hotspotAddress,
    hotspotTypes,
    submitTransactions,
    txnStr,
  ])

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
    <View style={styles.container}>
      <Text style={styles.topMargin}>{`mac: ${macAddress}`}</Text>
      {/* <Text style={styles.topMargin}>{`owner: ${ownerAddress}`}</Text> */}
      <Input
        title="Owner Address"
        style={styles.innerContainer}
        inputProps={{
          editable: !submitted,
          onChangeText: setOwnerAddress,
          value: ownerAddress,
          placeholder: 'Enter Owner Address',
          style: styles.input,
        }}
      />
      <TextInput
        onChangeText={setTxnStr}
        value={txnStr}
        placeholder="Enter transaction"
        style={styles.wordInput}
        editable={!submitted}
        autoCapitalize="none"
        autoCompleteType="off"
        multiline
        autoCorrect={false}
      />

      {isSolana && (
        <>
          <View style={styles.switchRow}>
            <Switch
              onValueChange={handleHotspotTypeChange('iot')}
              value={hotspotTypes.includes('iot')}
            />
            <Text style={styles.leftMargin}>is this an IOT Hotspot?</Text>
          </View>

          <View style={styles.switchRow}>
            <Switch
              onValueChange={handleHotspotTypeChange('mobile')}
              value={hotspotTypes.includes('mobile')}
            />
            <Text style={styles.leftMargin}>is this a MOBILE Hotspot?</Text>
          </View>
        </>
      )}

      <Button
        title="Submit Transaction"
        disabled={
          !txnStr ||
          submitted ||
          (isSolana && !hotspotTypes.length) ||
          !Address.isValid(ownerAddress)
        }
        onPress={submitOnboardingTxns}
      />

      <TouchableOpacity onPress={() => Clipboard.setString(hotspotAddress)}>
        <View>
          <Text style={styles.topMargin}>Hotspot Address:</Text>
          <Text>{hotspotAddress}</Text>
          <Text>{animalName(hotspotAddress)}</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.topMargin}>Sol Tx Id(s):</Text>
      <Text style={styles.topMargin} selectable>
        {solTxId}
      </Text>
      <Text style={styles.topMargin}>Txn Hash:</Text>
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
    padding: 16,
  },
  wordInput: {
    borderRadius: 12,
    fontSize: 12,
    padding: 16,
    backgroundColor: 'white',
    minHeight: 200,
    marginTop: 16,
  },
  topMargin: { marginTop: 16 },
  leftMargin: { marginLeft: 8 },
  switchRow: {
    flexDirection: 'row',
    marginTop: 16,
    alignItems: 'center',
  },
  innerContainer: { marginTop: 16 },
  input: {
    borderRadius: 12,
    fontSize: 11,
    paddingVertical: 16,
    paddingLeft: 4,
    backgroundColor: 'white',
    marginTop: 4,
  },
})
export default AddGatewayTxn
