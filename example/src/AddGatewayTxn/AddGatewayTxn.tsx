import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  Button,
  TouchableOpacity,
} from 'react-native'
import { Account, AddGateway, useOnboarding } from '@helium/react-native-sdk'
import { getPendingTxn } from '../../appDataClient'
import { getAddressStr, getKeypair } from '../Account/secureAccount'
import Clipboard from '@react-native-community/clipboard'

const AddGatewayTxn = () => {
  const [txnStr, setTxnStr] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [macAddress, setMacAddress] = useState('')
  const [ownerAddress, setOwnerAddress] = useState('')
  const [hotspotAddress, setHotspotAddress] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [hash, setHash] = useState('')
  const [solTxIds, setSolTxIds] = useState('')
  const [status, setStatus] = useState('')
  const [failedReason, setFailedReason] = useState('')
  const { getOnboardingRecord, addGateway } = useOnboarding()

  useEffect(() => {
    if (!publicKey) return

    getOnboardingRecord(publicKey).then((r) =>
      setMacAddress(r?.macEth0 || 'unknown')
    )
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

  const submitOnboardingTxns = useCallback(async () => {
    setSubmitted(true)

    // construct and publish add gateway
    const keypair = await getKeypair()
    const txnOwnerSigned = await AddGateway.signGatewayTxn(txnStr, keypair)
    if (!txnOwnerSigned.gateway?.b58) {
      throw new Error('Error signing gateway txn')
    }

    setHotspotAddress(txnOwnerSigned.gateway.b58)

    const userAddress = await getAddressStr()
    if (!userAddress) {
      throw new Error('No user found')
    }

    const userSolPubKey = Account.heliumAddressToSolPublicKey(userAddress)

    const addGatewayResponse = await addGateway({
      hotspotAddress: txnOwnerSigned.gateway.b58,
      transaction: txnOwnerSigned.toString(),
      userSolPubKey,
    })

    if (addGatewayResponse?.pendingTxn) {
      setHash(addGatewayResponse.pendingTxn.hash)
      setStatus(addGatewayResponse.pendingTxn.status)
      setFailedReason(addGatewayResponse.pendingTxn.failedReason || '')
      return
    }

    if (addGatewayResponse?.solanaResponses) {
      const txIds = addGatewayResponse.solanaResponses.join(',')
      setSolTxIds(txIds)
      setStatus(`${addGatewayResponse.solanaResponses.length} responses`)
    }
  }, [addGateway, txnStr])

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

      <TouchableOpacity onPress={() => Clipboard.setString(hotspotAddress)}>
        <View>
          <Text style={styles.topMargin}>Hotspot Address:</Text>
          <Text>{hotspotAddress}</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.topMargin}>Sol Tx Ids</Text>
      <Text style={styles.topMargin} selectable>
        {solTxIds}
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
})
export default AddGatewayTxn
