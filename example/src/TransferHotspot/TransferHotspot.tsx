import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import { Transfer, useOnboarding } from '@helium/react-native-sdk'
import Solana from '@helium/solana'
import { getAddressStr, getKeypairRaw } from '../Account/secureAccount'
import animalName from 'angry-purple-tiger'
import Input from '../Input'
import Address from '@helium/address'

type Props = {}
const TransferHotspot = ({}: Props) => {
  const { createTransferTransaction, submitTransferHotspot } = useOnboarding()
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
        const { pendingTxn } = await submitTransferHotspot({
          transferHotspotTxn: signedTxn.toString(),
        })
        if (pendingTxn) {
          setHash(pendingTxn.hash)
          setStatus(pendingTxn.status)
          setFailedReason(pendingTxn.failedReason || '')
          return
        }
      } else if (solanaTransaction) {
        const solanaKeypair = Solana.getSolanaKeypair(keypairRaw.sk)
        const tx = Solana.bufferToTransaction(solanaTransaction)
        tx.partialSign(solanaKeypair)

        const { solTxId } = await submitTransferHotspot({
          solanaTransaction: tx.serialize(),
        })
        if (solTxId) {
          setHash(solTxId)
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
    submitTransferHotspot,
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
