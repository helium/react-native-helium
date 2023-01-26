import { useNavigation } from '@react-navigation/core'
import React, { useCallback, useState } from 'react'
import { Button, StyleSheet, Text, TextInput, View } from 'react-native'
import { makeKeypair } from './secureAccount'
import { Account } from '@helium/react-native-sdk'

const TOTAL_WORDS = 24
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
    setMatchingWords(Account.getMatchingWords(text))
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

  const handleSubmit = useCallback(() => {
    if (matchingWords.length === 0) return

    handleSelectWord(matchingWords[0])()
  }, [handleSelectWord, matchingWords])

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
          onSubmitEditing={handleSubmit}
          blurOnSubmit={false}
          returnKeyType={'next'}
          autoFocus={true}
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
