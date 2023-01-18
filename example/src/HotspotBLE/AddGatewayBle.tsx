import React, { useCallback, useEffect, useState } from 'react'
import { Button, StyleSheet, Text, View, Alert, Switch } from 'react-native'
import { getPendingTxn } from '../../appDataClient'
import {
  getAddressStr,
  getKeypairRaw,
  getSecureItem,
} from '../Account/secureAccount'
import {
  Account,
  HotspotType,
  SolUtils,
  useHotspotBle,
  useOnboarding,
} from '@helium/react-native-sdk'

const AddGatewayBle = () => {
  const { getOnboardingRecord, submitAddGateway, getOnboardTransactions } =
    useOnboarding()
  const { createAndSignGatewayTxn, getOnboardingAddress } = useHotspotBle()
  const [hash, setHash] = useState('')
  const [solTxId, setSolTxId] = useState('')
  const [status, setStatus] = useState('')
  const [failedReason, setFailedReason] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [hotspotTypes, setHotspotTypes] = useState<HotspotType[]>([])

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

    const { addGatewayTxn, solanaTransactions } = await getOnboardTransactions({
      txn: txnOwnerSigned.toString(),
      hotspotAddress: onboardAddress,
      hotspotTypes,
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
    getOnboardTransactions,
    hotspotTypes,
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
  switchRow: {
    flexDirection: 'row',
    marginTop: 16,
    alignItems: 'center',
  },
  leftMargin: { marginLeft: 8 },
})

export default AddGatewayBle
