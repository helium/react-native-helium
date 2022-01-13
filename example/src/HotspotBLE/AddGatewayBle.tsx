import OnboardingClient from '@helium/onboarding'
import React, { useCallback, useEffect, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import { useHotspotBle } from '../../../src'
import { getPendingTxn, submitPendingTxn } from '../../appDataClient'
import { getKeypair, getSecureItem } from '../Account/secureAccount'

const AddGatewayBle = () => {
  const { createAndSignGatewayTxn } = useHotspotBle()
  const [hash, setHash] = useState('')
  const [status, setStatus] = useState('')
  const [failedReason, setFailedReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleAddGateway = useCallback(async () => {
    setSubmitted(true)
    const accountAddress = await getSecureItem('address')
    const keypair = await getKeypair()
    if (!accountAddress) return

    const txnOwnerSigned = await createAndSignGatewayTxn(
      accountAddress,
      keypair
    )

    if (!txnOwnerSigned?.gateway?.b58) {
      throw new Error('Error signing gateway txn')
    }

    const response = await new OnboardingClient().postPaymentTransaction(
      txnOwnerSigned.gateway.b58,
      txnOwnerSigned.toString()
    )
    const txn = response.data?.transaction
    if (!txn) {
      throw new Error('Could not get signed txn from onboarding server')
    }
    const pendingTxn = await submitPendingTxn(txn)
    setHash(pendingTxn.hash)
    setStatus(pendingTxn.status)
    setFailedReason(pendingTxn.failedReason || '')
  }, [createAndSignGatewayTxn])

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
      <Button
        title="Add Gateway"
        onPress={handleAddGateway}
        disabled={submitted}
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
  container: { padding: 16 },
  topMargin: { marginTop: 16 },
})

export default AddGatewayBle
