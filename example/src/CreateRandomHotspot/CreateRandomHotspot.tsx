import React, { useCallback, useState } from 'react'
import { Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Input from '../Input'
import useCreateRandomHotspot from './useCreateHotspot'
import Clipboard from '@react-native-community/clipboard'
import Config from 'react-native-config'

const CreateRandomHotspot = () => {
  const [makerAddress, setMakerAddress] = useState(
    Config.ONBOARDING_MAKER_ADDRESS || ''
  )
  const [authorization, setAuthorization] = useState(
    Config.ONBOARDING_AUTH_TOKEN || ''
  )
  const [submitted, setSubmitted] = useState(false)
  const { txn, create } = useCreateRandomHotspot()

  const createHotspot = useCallback(async () => {
    setSubmitted(true)
    try {
      await create({ makerAddress, authorization })
    } catch (e) {
      console.error(e)
    }
    setSubmitted(false)
  }, [authorization, create, makerAddress])

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
      <View style={styles.innnerContainer}>
        <Button title="Create" disabled={submitted} onPress={createHotspot} />
      </View>
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
  innnerContainer: { marginVertical: 16 },
  input: {
    borderRadius: 12,
    fontSize: 17,
    padding: 16,
    backgroundColor: 'white',
    marginTop: 4,
  },
})

export default CreateRandomHotspot
