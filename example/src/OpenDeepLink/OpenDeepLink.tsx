import React, { useState } from 'react'
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Input from '../Input'
const OpenDeepLink = () => {
  const [deepLink, setDeepLink] = useState('')

  return (
    <View style={styles.container}>
      <Input
        title="Deep Link"
        style={styles.innnerContainer}
        inputProps={{
          multiline: true,
          onChangeText: setDeepLink,
          value: deepLink,
          placeholder: 'Enter Deep Link',
          style: styles.input,
        }}
      />
      <TouchableOpacity
        style={styles.buttonContainer}
        disabled={!deepLink.includes('://')}
        onPress={() => Linking.openURL(deepLink)}
      >
        <Text style={styles.buttonText}>Open Url</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    margin: 24,
  },
  innnerContainer: { marginTop: 16, maxHeight: 300 },
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

export default OpenDeepLink
