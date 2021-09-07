import React, { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { getMnemonic, makeKeypair } from './secureAccount'

const AccountCreate = () => {
  const [words, setWords] = useState<string[]>([])

  const createAccount = useCallback(async () => {
    await makeKeypair()
    const addy = await getMnemonic()
    setWords(addy?.words || [])
  }, [])

  useEffect(() => {
    createAccount()
  }, [createAccount])

  return (
    <View style={styles.container}>
      {words.map((word) => (
        <Text key={word} style={styles.word}>
          {word}
        </Text>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 32 },
  word: {
    fontSize: 17,
    paddingVertical: 8,
  },
})

export default AccountCreate
