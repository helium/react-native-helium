import React, { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Input from '../Input'
import useCreateHotspot from './useCreateHotspot'
import Clipboard from '@react-native-clipboard/clipboard'
import Config from 'react-native-config'
import { getAddressStr } from '../Account/secureAccount'
import { AddGateway } from '@helium/react-native-sdk'
import animalName from 'angry-purple-tiger'

const CreateSolanaHotspot = () => {
  const [hotspotAddress, setHotspotAddress] = useState('')
  const [ownerAddress, setOwnerAddress] = useState('')

  const [makerAddress, setMakerAddress] = useState(
    Config.ONBOARDING_MAKER_ADDRESS || ''
  )
  const [authorization, setAuthorization] = useState(
    Config.ONBOARDING_AUTH_TOKEN || ''
  )
  const [deepLinkScheme, setDeepLinkScheme] = useState('makerappscheme://')
  const [submitted, setSubmitted] = useState(false)
  const { txn, create } = useCreateHotspot()

  useEffect(() => {
    getAddressStr().then(setOwnerAddress)
  }, [])

  useEffect(() => {
    if (!txn) return

    const addGateway = AddGateway.txnFromString(txn)

    setHotspotAddress(addGateway.gateway?.b58 || '')
  }, [txn])

  const createHotspot = useCallback(async () => {
    setSubmitted(true)
    try {
      await create({ makerAddress, authorization, ownerAddress })
    } catch (e) {
      console.error(e)
    }
    setSubmitted(false)
  }, [authorization, create, makerAddress, ownerAddress])

  return (
    <View style={styles.container}>
      <Input
        title="Maker Address"
        style={styles.innnerContainer}
        inputProps={{
          multiline: true,
          editable: !submitted,
          onChangeText: setMakerAddress,
          value: makerAddress,
          placeholder: 'Enter Maker Address',
          style: styles.input,
        }}
      />
      <Input
        title="Owner Address"
        style={styles.innnerContainer}
        inputProps={{
          multiline: true,
          editable: !submitted,
          onChangeText: setOwnerAddress,
          value: ownerAddress,
          placeholder: 'Enter Owner Address',
          style: styles.input,
        }}
      />
      <Input
        title="Authorization"
        style={styles.innnerContainer}
        inputProps={{
          multiline: true,
          editable: !submitted,
          onChangeText: setAuthorization,
          value: authorization,
          placeholder: 'Enter Auth Token',
          style: styles.input,
        }}
      />
      <Input
        title="Deep Link Scheme"
        style={styles.innnerContainer}
        inputProps={{
          editable: !submitted,
          onChangeText: setDeepLinkScheme,
          value: deepLinkScheme,
          placeholder: 'Enter Deep Link Scheme',
          style: styles.input,
        }}
      />
      {hotspotAddress && (
        <Text style={styles.container}>{animalName(hotspotAddress)}</Text>
      )}
      <View style={styles.innnerContainer}>
        <Button title="Create" disabled={submitted} onPress={createHotspot} />
      </View>
      <TouchableOpacity
        style={styles.buttonContainer}
        disabled={!deepLinkScheme.includes('://') || !txn}
        onPress={() => Linking.openURL(`${deepLinkScheme}add_gateway/${txn}`)}
      >
        <Text style={styles.buttonText}>Open Url</Text>
      </TouchableOpacity>
      <TouchableOpacity
        disabled={!txn}
        onPress={() => Clipboard.setString(txn)}
      >
        <View>
          <Text>{txn}</Text>
        </View>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    margin: 24,
  },
  innnerContainer: { marginTop: 16 },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { padding: 16, color: '#147EFB', fontSize: 17 },
  input: {
    borderRadius: 12,
    fontSize: 17,
    padding: 16,
    backgroundColor: 'white',
    marginTop: 4,
  },
})

export default CreateSolanaHotspot
