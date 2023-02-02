import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import { Transfer, useOnboarding } from '@helium/react-native-sdk'
import { getAddressStr, getKeypairRaw } from '../Account/secureAccount'
import animalName from 'angry-purple-tiger'
import Input from '../Input'
import Address from '@helium/address'
import { bufferToTransaction, getSolanaKeypair } from '@helium/spl-utils'
import { Buffer } from 'buffer'

type Props = {}
const TransferHotspot = ({}: Props) => {
  const { createTransferTransaction, submitTransactions } = useOnboarding()
  const [hotspotAddress, setHotspotAddress] = useState('')
  const [hotspotName, setHotspotName] = useState('')
  const [newOwnerAddress, setNewOwnerAddress] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [hash, setHash] = useState('')
  const [status, setStatus] = useState('')
  const [failedReason, setFailedReason] = useState('')

  const handleTransfer = useCallback(async () => {
    try {
      setSubmitted(true)

      const address = await getAddressStr()
      const { transferHotspotTxn, solanaTransaction } =
        await createTransferTransaction({
          userAddress: address,
          hotspotAddress,
          newOwnerAddress,
        })

      const keypairRaw = await getKeypairRaw()
      if (transferHotspotTxn) {
        const signedTxn = await Transfer.signTransferV2Txn(
          transferHotspotTxn,
          keypairRaw
        )
        if (!signedTxn.gateway?.b58) {
          throw new Error('Error signing transfer txn')
        }
        const { pendingTransferTxn } = await submitTransactions({
          hotspotAddress,
          transferHotspotTxn: signedTxn.toString(),
        })
        if (pendingTransferTxn) {
          setHash(pendingTransferTxn.hash)
          setStatus(pendingTransferTxn.status)
          setFailedReason(pendingTransferTxn.failedReason || '')
          return
        }
      } else if (solanaTransaction) {
        const solanaKeypair = getSolanaKeypair(keypairRaw.sk)
        const tx = bufferToTransaction(Buffer.from(solanaTransaction, 'base64'))
        tx.partialSign(solanaKeypair)

        const { solanaTxnIds } = await submitTransactions({
          hotspotAddress,
          solanaTransactions: [tx.serialize().toString('base64')],
        })
        if (solanaTxnIds?.length) {
          setHash(solanaTxnIds[0])
          setStatus('complete')
          return
        }

        setStatus('Unknown Failure')
      }
    } catch (e) {
      setStatus((e as { toString: () => string }).toString())
    }
  }, [
    createTransferTransaction,
    hotspotAddress,
    newOwnerAddress,
    submitTransactions,
  ])

  const disabled = useMemo(
    () => !Address.isValid(hotspotAddress) || !Address.isValid(newOwnerAddress),
    [hotspotAddress, newOwnerAddress]
  )

  useEffect(() => {
    if (!Address.isValid(hotspotAddress)) {
      setHotspotName('')
      return
    }

    setHotspotName(animalName(hotspotAddress))
  }, [hotspotAddress])

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Transfer Hotspot</Text>
      <Text style={styles.animalName}>{hotspotName}</Text>
      <Input
        title="Hotspot Address"
        inputProps={{
          editable: !submitted,
          onChangeText: setHotspotAddress,
          value: hotspotAddress,
          placeholder: 'Enter Hotspot Address',
          style: styles.input,
          multiline: true,
          numberOfLines: 2,
        }}
      />
      <Input
        title="New Owner Address"
        inputProps={{
          editable: !submitted,
          onChangeText: setNewOwnerAddress,
          value: newOwnerAddress,
          placeholder: 'Enter New Owner Address',
          style: styles.input,
          multiline: true,
          numberOfLines: 2,
        }}
      />
      <Button
        title="Transfer Ownership"
        onPress={handleTransfer}
        disabled={disabled || submitted}
      />
      <Text style={styles.topMargin}>Txn</Text>
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

export default memo(TransferHotspot)

const styles = StyleSheet.create({
  heading: { fontSize: 36, textAlign: 'center', marginBottom: 12 },
  animalName: {
    fontSize: 18,
    marginBottom: 24,
    color: 'grey',
    textAlign: 'center',
  },
  container: { flex: 1, padding: 24 },
  input: { fontSize: 14, marginBottom: 24 },
  topMargin: { marginTop: 16 },
})
