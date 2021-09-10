import React, { useState, useEffect, useCallback } from 'react'
import { View, TextInput, StyleSheet, Text, Button } from 'react-native'
import { Onboarding, AddGateway } from '@helium/react-native-sdk'
import {
  getHotspotDetails,
  getPendingTxn,
  submitPendingTxn,
} from '../../appDataClient'
import { getKeypair } from '../Account/secureAccount'

const AddGatewayTxn = () => {
  const [txnStr, setTxnStr] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [macAddress, setMacAddress] = useState('')
  const [ownerAddress, setOwnerAddress] = useState('')
  const [onboardingRecord, setOnboardingRecord] =
    useState<Onboarding.OnboardingRecord>()
  const [submitted, setSubmitted] = useState(false)
  const [hash, setHash] = useState('')
  const [status, setStatus] = useState('')
  const [failedReason, setFailedReason] = useState('')

  useEffect(() => {
    if (!publicKey) return

    const getRecord = async () => {
      const record = await Onboarding.getOnboardingRecord(publicKey)
      setMacAddress(record.macEth0 || 'unknown')
      setOnboardingRecord(record)
    }
    getRecord()
  }, [publicKey])

  useEffect(() => {
    if (!txnStr) return

    try {
      const txn = AddGateway.txnFromString(txnStr)

      setPublicKey(txn.gateway?.b58 || '')
      setOwnerAddress(txn.owner?.b58 || '')
    } catch (e) {
      console.log(e)
    }
  }, [txnStr])

  const hotspotOnChain = useCallback(async () => {
    if (!onboardingRecord?.publicAddress) return false

    try {
      await getHotspotDetails(onboardingRecord.publicAddress)
      return true
    } catch (error) {
      return false
    }
  }, [onboardingRecord?.publicAddress])

  const submitOnboardingTxns = useCallback(async () => {
    setSubmitted(true)

    // check if add gateway needed
    const isOnChain = await hotspotOnChain()
    if (
      isOnChain || // gateway already exists, handle error
      !onboardingRecord?.publicAddress
    )
      return

    // construct and publish add gateway
    const keypair = await getKeypair()
    const txn = await AddGateway.signGatewayTxn(txnStr, keypair)
    const pendingTxn = await submitPendingTxn(txn)
    setHash(pendingTxn.hash)
    setStatus(pendingTxn.status)
    setFailedReason(pendingTxn.failedReason || '')
  }, [hotspotOnChain, onboardingRecord?.publicAddress, txnStr])

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

  return (
    <View style={styles.container}>
      <Text style={styles.topMargin}>{`mac: ${macAddress}`}</Text>
      <Text style={styles.topMargin}>{`owner: ${ownerAddress}`}</Text>
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
      <Button
        title="Submit Transaction"
        disabled={!txnStr || submitted}
        onPress={submitOnboardingTxns}
      />
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
    padding: 16,
  },
  wordInput: {
    borderRadius: 12,
    fontSize: 19,
    padding: 16,
    backgroundColor: 'white',
    minHeight: 200,
    marginTop: 16,
  },
  topMargin: { marginTop: 16 },
})
export default AddGatewayTxn
