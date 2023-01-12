import React, { useState, useEffect, useCallback } from 'react'
import { View, TextInput, StyleSheet, Text, Button } from 'react-native'
import { Transfer, useOnboarding } from '@helium/react-native-sdk'
import { getPendingTxn } from '../../appDataClient'
import { getKeypairRaw } from '../Account/secureAccount'

const TransferHotspot = () => {
  const [txnStr, setTxnStr] = useState('')
  const [gatewayAddress, setGatewayAddress] = useState('')
  const [ownerAddress, setOwnerAddress] = useState('')
  const [newOwnerAddress, setNewOwnerAddress] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [hash, setHash] = useState('')
  const [status, setStatus] = useState('')
  const [failedReason, setFailedReason] = useState('')
  const { submitTransferHotspot } = useOnboarding()

  useEffect(() => {
    if (!txnStr) return

    try {
      const txn = Transfer.txnFromString(txnStr)

      setGatewayAddress(txn.gateway?.b58 || '')
      setOwnerAddress(txn.owner?.b58 || '')
      setNewOwnerAddress(txn.newOwner?.b58 || '')
    } catch (e) {
      console.log(e)
    }
  }, [txnStr])

  const submitTxn = useCallback(async () => {
    setSubmitted(true)

    // construct and publish transfer v2
    const keypair = await getKeypairRaw()
    const signedTxn = await Transfer.signTransferV2Txn(txnStr, keypair)
    if (!signedTxn.gateway?.b58) {
      throw new Error('Error signing transfer txn')
    }

    const { pendingTxn, solTxId } = await submitTransferHotspot({
      transaction: signedTxn.toString(),
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
  }, [submitTransferHotspot, txnStr])

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

  return (
    <View style={styles.container}>
      <Text style={styles.topMargin}>{`gateway: ${gatewayAddress}`}</Text>
      <Text style={styles.topMargin}>{`owner: ${ownerAddress}`}</Text>
      <Text style={styles.topMargin}>{`newOwner: ${newOwnerAddress}`}</Text>
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
        onPress={submitTxn}
      />
      <Text style={styles.topMargin}>Txn:</Text>
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
export default TransferHotspot
