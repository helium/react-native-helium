import React, { useCallback, useEffect, useState } from 'react'
import { Button, StyleSheet, Text, View, Alert } from 'react-native'
import { getPendingTxn } from '../../appDataClient'
import {
  getAddressStr,
  getKeypairRaw,
  getSecureItem,
} from '../Account/secureAccount'
import {
  Account,
  SolUtils,
  useHotspotBle,
  useOnboarding,
} from '@helium/react-native-sdk'

const AddGatewayBle = () => {
  const { getOnboardingRecord, submitAddGateway, getOnboardTransaction } =
    useOnboarding()
  const { createAndSignGatewayTxn, getOnboardingAddress } = useHotspotBle()
  const [hash, setHash] = useState('')
  const [solTxId, setSolTxId] = useState('')
  const [status, setStatus] = useState('')
  const [failedReason, setFailedReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleAddGateway = useCallback(async () => {
    setSubmitted(true)
    const accountAddress = await getSecureItem('address')
    const keypair = await getKeypairRaw()
    if (!accountAddress) {
      Alert.alert(
        'Error',
        'You must first add a wallet address from the main menu'
      )
      return
    }

    const onboardAddress = await getOnboardingAddress()
    const onboardRecord = await getOnboardingRecord(onboardAddress)

    if (!onboardRecord?.maker.address) {
      throw new Error('Could not get maker address')
    }

    const txnOwnerSigned = await createAndSignGatewayTxn({
      ownerAddress: accountAddress,
      ownerKeypairRaw: keypair,
      payerAddress: onboardRecord?.maker.address,
    })

    if (!txnOwnerSigned?.gateway?.b58) {
      throw new Error('Error signing gateway txn')
    }

    const { addGatewayTxn, solanaTransactions } = await getOnboardTransaction({
      txn: txnOwnerSigned.toString(),
      hotspotAddress: onboardAddress,
    })
    let addGatewaySignedTxn: string | undefined
    let solanaSignedTransactions: string[] | undefined

    if (addGatewayTxn) {
      addGatewaySignedTxn = txnOwnerSigned.toString()
    } else if (solanaTransactions) {
      const solanaKeypair = SolUtils.getSolanaKeypair(keypair.sk)

      solanaSignedTransactions = solanaTransactions.map((txn) => {
        const tx = SolUtils.stringToTransaction(txn)
        tx.partialSign(solanaKeypair)
        return tx.serialize().toString('base64')
      })
    }

    const userAddress = await getAddressStr()
    if (!userAddress) {
      throw new Error('No user found')
    }

    const userSolPubKey = Account.heliumAddressToSolPublicKey(userAddress)

    const addGatewayResponse = await submitAddGateway({
      hotspotAddress: onboardAddress,
      addGatewayTxn: addGatewaySignedTxn,
      solanaTransactions: solanaSignedTransactions,
      userSolPubKey,
    })

    if (addGatewayResponse?.pendingTxn) {
      setHash(addGatewayResponse.pendingTxn.hash)
      setStatus(addGatewayResponse.pendingTxn.status)
      setFailedReason(addGatewayResponse.pendingTxn.failedReason || '')
      return
    }

    if (addGatewayResponse?.solanaTxnIds?.length) {
      setSolTxId(addGatewayResponse.solanaTxnIds[0])
      setStatus('Solana Success')
    }
  }, [
    getOnboardingAddress,
    getOnboardingRecord,
    createAndSignGatewayTxn,
    getOnboardTransaction,
    submitAddGateway,
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

  return (
    <View style={styles.container}>
      <Button
        title="Add Gateway"
        onPress={handleAddGateway}
        disabled={submitted}
      />
      <Text style={styles.topMargin}>Sol Tx Id</Text>
      <Text style={styles.topMargin} selectable>
        {solTxId}
      </Text>
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
