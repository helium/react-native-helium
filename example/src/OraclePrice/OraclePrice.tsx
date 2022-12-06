import React, { memo, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Balance, USDollars, useOnboarding } from '@helium/react-native-sdk'

type Props = {}
const OraclePrice = ({}: Props) => {
  const { getOraclePrice } = useOnboarding()
  const [oraclePrice, setOraclePrice] = useState<Balance<USDollars>>()

  useEffect(() => {
    getOraclePrice().then(setOraclePrice)
  }, [getOraclePrice])

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {oraclePrice?.toString(undefined, { showTicker: true })}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 24,
  },
})

export default memo(OraclePrice)
