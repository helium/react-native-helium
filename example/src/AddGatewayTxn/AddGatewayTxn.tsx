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
  Account,
  AddGateway,
  HotspotType,
  SolUtils,
  useOnboarding,
  useSolana,
} from '@helium/react-native-sdk'
import { getPendingTxn } from '../../appDataClient'
import { getAddressStr, getKeypairRaw } from '../Account/secureAccount'
import Clipboard from '@react-native-community/clipboard'

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
  const { getOnboardingRecord, submitAddGateway, getOnboardTransactions } =
    useOnboarding()
  const {
    status: { isSolana },
  } = useSolana()

  useEffect(() => {
    if (!hotspotAddress) return

    getOnboardingRecord(hotspotAddress).then((r) =>
      setMacAddress(r?.macEth0 || 'unknown')
    )
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

    // construct and publish add gateway
    const keypair = await getKeypairRaw()
    const { addGatewayTxn, solanaTransactions } = await getOnboardTransactions({
      txn: txnStr,
      hotspotAddress,
      hotspotTypes,
    })

    let addGatewaySignedTxn: string | undefined
    let solanaSignedTransactions: Buffer[] | undefined

    if (addGatewayTxn) {
      const txnOwnerSigned = await AddGateway.signGatewayTxn(
        addGatewayTxn,
        keypair
      )
      if (!txnOwnerSigned.gateway?.b58) {
        throw new Error('Error signing gateway txn')
      }

      addGatewaySignedTxn = txnOwnerSigned.toString()
    } else if (solanaTransactions) {
      const solanaKeypair = SolUtils.getSolanaKeypair(keypair.sk)

      solanaSignedTransactions = solanaTransactions.map((txn) => {
        const tx = SolUtils.bufferToTransaction(txn)
        tx.partialSign(solanaKeypair)
        return tx.serialize()
      })
    }

    const userAddress = await getAddressStr()
    if (!userAddress) {
      throw new Error('No user found')
    }

    const userSolPubKey = Account.heliumAddressToSolPublicKey(userAddress)

    const addGatewayResponse = await submitAddGateway({
      hotspotAddress,
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
      setSolTxId(addGatewayResponse.solanaTxnIds.join(', '))
      setStatus('Solana Success')
    }
  }, [
    getOnboardTransactions,
    hotspotAddress,
    hotspotTypes,
    submitAddGateway,
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
        disabled={!txnStr || submitted}
        onPress={submitOnboardingTxns}
      />

      <TouchableOpacity onPress={() => Clipboard.setString(hotspotAddress)}>
        <View>
          <Text style={styles.topMargin}>Hotspot Address:</Text>
          <Text>{hotspotAddress}</Text>
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
})
export default AddGatewayTxn
