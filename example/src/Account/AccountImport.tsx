import { useNavigation } from '@react-navigation/core'
import React, { useCallback, useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { makeKeypair } from './secureAccount'

const TOTAL_WORDS = 12
const AccountImport = () => {
  const navigation = useNavigation()
  const [words, setWords] = useState<string[]>([])

  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const importAccount = useCallback(async () => {
    await makeKeypair(words)
    navigation.goBack()
  }, [navigation, words])

  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSelectWord = useCallback(
    (selectedWord: string) => {
      if (words.length === TOTAL_WORDS) {
        return
      }

      setWords((prevWords) => [...prevWords, selectedWord])
    },
    [words.length]
  )

  return (
    <View style={styles.container}>
      <TextInput
        // onChangeText=
        // value=
        placeholder="Enter Word x"
        style={styles.wordInput}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 32 },
  wordInput: {
    borderRadius: 12,
    flex: 1,
    fontSize: 19,
    padding: 16,
    backgroundColor: 'white',
  },
})

export default AccountImport
