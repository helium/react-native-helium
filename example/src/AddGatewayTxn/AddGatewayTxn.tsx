import React, { useState, useEffect, useCallback } from 'react'
import { View, TextInput, StyleSheet, Text, Button } from 'react-native'
import { AddGateway, useOnboarding } from '@helium/react-native-sdk'
import {
  getHotspotDetails,
  getPendingTxn,
  submitPendingTxn,
} from '../../appDataClient'
import { getKeypair } from '../Account/secureAccount'
import { OnboardingRecord } from '@helium/onboarding'
import getSolanaStatus from '../../../src/utils/getSolanaStatus'

const AddGatewayTxn = () => {
  const [txnStr, setTxnStr] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [macAddress, setMacAddress] = useState('')
  const [ownerAddress, setOwnerAddress] = useState('')
  const [onboardingRecord, setOnboardingRecord] =
    useState<OnboardingRecord | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [hash, setHash] = useState('')
  const [status, setStatus] = useState('')
  const [failedReason, setFailedReason] = useState('')
  const { getOnboardingRecord, postPaymentTransaction } = useOnboarding()

  useEffect(() => {
    if (!publicKey) return

    const getRecord = async () => {
      const record = await getOnboardingRecord(publicKey)
      if (!record) return
      setMacAddress(record.macEth0 || 'unknown')
      setOnboardingRecord(record)
    }
    getRecord()
  }, [getOnboardingRecord, publicKey])

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
    const solanaStatus = await getSolanaStatus()
    if (solanaStatus === 'in_progress') {
      throw new Error('Chain transfer in progress')
    }

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
    const txnOwnerSigned = await AddGateway.signGatewayTxn(txnStr, keypair)
    if (!txnOwnerSigned.gateway?.b58) {
      throw new Error('Error signing gateway txn')
    }

    const onboardTxn = await postPaymentTransaction(
      txnOwnerSigned.gateway.b58,
      txnOwnerSigned.toString()
    )

    if (!onboardTxn?.transaction) return

    if (solanaStatus === 'not_started') {
      const pendingTxn = await submitPendingTxn(onboardTxn.transaction)
      setHash(pendingTxn.hash)
      setStatus(pendingTxn.status)
      setFailedReason(pendingTxn.failedReason || '')
      return
    }

    if (onboardTxn.solanaResponses) {
      const sigs = onboardTxn.solanaResponses.map((r) => r.signature).join(',')
      setHash(sigs)
      const errors = onboardTxn.solanaResponses.map((r) => r.err?.toString())
      const hasError = !!onboardTxn.solanaResponses.find((r) => !!r.err)
      setFailedReason(errors.join(','))
      setStatus(hasError ? 'Success' : 'Error')
    }
  }, [
    hotspotOnChain,
    onboardingRecord?.publicAddress,
    postPaymentTransaction,
    txnStr,
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
