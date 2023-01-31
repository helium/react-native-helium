import React, { useCallback, useState } from 'react'
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
import Clipboard from '@react-native-community/clipboard'
import Config from 'react-native-config'

const CreateSolanaHotspot = () => {
  const [makerAddress, setMakerAddress] = useState(
    Config.ONBOARDING_MAKER_ADDRESS || ''
  )
  const [authorization, setAuthorization] = useState(
    Config.ONBOARDING_AUTH_TOKEN || ''
  )
  const [deepLinkScheme, setDeepLinkScheme] = useState('makerappscheme://')
  const [submitted, setSubmitted] = useState(false)
  const { txn, create } = useCreateHotspot()

  const createHotspot = useCallback(async () => {
    setSubmitted(true)
    try {
      const txIds = await create({ makerAddress, authorization })
      console.log({ txIds, txn })
    } catch (e) {
      console.error(e)
    }
    setSubmitted(false)
  }, [authorization, create, makerAddress, txn])

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
      <View style={styles.innnerContainer}>
        <Button title="Create" disabled={submitted} onPress={createHotspot} />
      </View>
      <Text>
        Note: You will need to wait at least a minute to onboard this hotspot
      </Text>
      <TouchableOpacity
        style={styles.buttonContainer}
        disabled={!deepLinkScheme.includes('://') || !txn}
        onPress={() => Linking.openURL(`${deepLinkScheme}add_gateway/${txn}`)}
      >
        <Text style={styles.buttonText}>Open Url</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => Clipboard.setString(txn)}>
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