import { useNavigation } from '@react-navigation/core'
import React, { useCallback, useState } from 'react'
import { Button, StyleSheet, Text, TextInput, View } from 'react-native'
import { getMatchingWords } from '../../../src/Account/account'
import { makeKeypair } from './secureAccount'

const TOTAL_WORDS = 12
const AccountImport = () => {
  const navigation = useNavigation()
  const [word, setWord] = useState('')
  const [words, setWords] = useState<string[]>([])
  const [matchingWords, setMatchingWords] = useState<string[]>([])

  const importAccount = useCallback(async () => {
    await makeKeypair(words)
    navigation.goBack()
  }, [navigation, words])

  const handleSelectWord = useCallback(
    (selectedWord: string) => () => {
      if (words.length === TOTAL_WORDS) {
        return
      }

      setWords((prevWords) => [...prevWords, selectedWord])
      setWord('')
      setMatchingWords([])
    },
    [words.length]
  )

  const handleChangeText = (text: string) => {
    setWord(text)
    setMatchingWords(getMatchingWords(text))
  }

  const suggestionButton = (index: number) => {
    if (index >= matchingWords.length) return null

    return (
      <Button
        title={matchingWords[index]}
        onPress={handleSelectWord(matchingWords[index])}
      />
    )
  }

  return (
    <View style={styles.container}>
      {words.length < TOTAL_WORDS && (
        <TextInput
          onChangeText={handleChangeText}
          value={word}
          placeholder={`Enter Word ${words.length + 1}`}
          style={styles.wordInput}
          autoCapitalize="none"
          autoCompleteType="off"
          autoCorrect={false}
        />
      )}
      {words.length === TOTAL_WORDS && (
        <Button title="Import Account" onPress={importAccount} />
      )}
      <View style={styles.matchingContainer}>
        {suggestionButton(0)}
        {suggestionButton(1)}
        {suggestionButton(2)}
      </View>
      <Text style={styles.words}>{words.join(', ')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 32 },
  wordInput: {
    borderRadius: 12,
    fontSize: 19,
    padding: 16,
    backgroundColor: 'white',
  },
  matchingContainer: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  words: { padding: 16 },
})

export default AccountImport
