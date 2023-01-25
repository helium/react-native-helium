import React, { useMemo, useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import { StyleSheet, Text, FlatList, TouchableOpacity } from 'react-native'
import type { RootNavigationProp } from './App'

const Home = () => {
  const navigation = useNavigation<RootNavigationProp>()
  const data = useMemo(
    () => [
      { title: 'Multiply', handler: () => navigation.push('Multiply') },
      { title: 'HotspotBLE', handler: () => navigation.push('HotspotBLE') },
      { title: 'Account', handler: () => navigation.push('Account') },
      {
        title: 'Create Random Hotspot',
        handler: () => navigation.push('CreateRandomHotspot'),
      },
      {
        title: 'Add Gateway from Transaction String',
        handler: () => navigation.push('AddGatewayTxn'),
      },
      {
        title: 'Assert Location',
        handler: () => navigation.push('AssertLocation'),
      },
      {
        title: 'Transfer Hotspot',
        handler: () => navigation.push('TransferHotspot'),
      },
      {
        title: 'Get Oracle Price',
        handler: () => navigation.push('OraclePrice'),
      },
    ],
    [navigation]
  )

  const renderItem = useCallback(
    ({
      item,
    }: {
      index: number
      item: { title: string; handler: () => void }
    }) => {
      return (
        <TouchableOpacity onPress={item.handler} style={styles.row}>
          <Text>{item.title}</Text>
        </TouchableOpacity>
      )
    },
    []
  )

  const keyExtractor = useCallback((item) => item.title, [])

  return (
    <FlatList data={data} renderItem={renderItem} keyExtractor={keyExtractor} />
  )
}

export default Home

const styles = StyleSheet.create({
  row: {
    height: 60,
    padding: 16,
    backgroundColor: 'white',
    justifyContent: 'center',
    borderBottomColor: 'lightgray',
    borderBottomWidth: 1,
  },
})
