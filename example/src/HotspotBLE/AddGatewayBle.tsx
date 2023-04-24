import React, { useCallback, useState } from 'react'
import { Button, StyleSheet, Text, View, Alert, Switch } from 'react-native'
import {
  getAddressStr,
  getKeypairRaw,
  getSecureItem,
} from '../Account/secureAccount'
import { useHotspotBle, useOnboarding } from '@helium/react-native-sdk'
import { HotspotType } from '@helium/onboarding'
import { bufferToTransaction, getSolanaKeypair } from '@helium/spl-utils'
import { Buffer } from 'buffer'

const AddGatewayBle = () => {
  const {
    getOnboardingRecord,
    submitTransactions,
    getOnboardTransactions,
    createHotspot,
  } = useOnboarding()
  const { createAndSignGatewayTxn, getOnboardingAddress } = useHotspotBle()
  const [solTxId, setSolTxId] = useState('')
  const [status, setStatus] = useState('')
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

    await createHotspot(txnOwnerSigned?.toString())

    const { solanaTransactions } = await getOnboardTransactions({
      hotspotAddress: onboardAddress,
      hotspotTypes,
    })
    let solanaSignedTransactions: string[] | undefined

    if (solanaTransactions) {
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

    const { solanaTxnIds } = await submitTransactions({
      solanaTransactions: solanaSignedTransactions,
    })

    if (solanaTxnIds?.length) {
      setSolTxId(solanaTxnIds[0])
      setStatus('Solana Success')
    }
  }, [
    getOnboardingAddress,
    getOnboardingRecord,
    createAndSignGatewayTxn,
    createHotspot,
    getOnboardTransactions,
    hotspotTypes,
    submitTransactions,
  ])

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
      <Text style={styles.topMargin}>{`Pending Txn Status: ${status}`}</Text>
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
