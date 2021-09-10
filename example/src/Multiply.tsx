import React, { useState, useEffect } from 'react'
import { StyleSheet, View, Text } from 'react-native'
import { multiply } from 'react-native-helium'

const Mulitply = () => {
  const [result, setResult] = useState<number | undefined>()

  useEffect(() => {
    multiply(3, 8).then(setResult)
  }, [])

  return (
    <View style={styles.container}>
      <Text>Result: {result}</Text>
    </View>
  )
}

export default Mulitply

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 60,
    height: 60,
    marginVertical: 20,
  },
})
