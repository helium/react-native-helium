import { useNavigation } from '@react-navigation/native';
import * as React from 'react';

import { StyleSheet, Text, FlatList, TouchableOpacity } from 'react-native';
import type { RootNavigationProp } from './App';

const Home = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const data = React.useMemo(
    () => [
      { title: 'Multiply', handler: () => navigation.push('Multiply') },
      { title: 'HotspotBLE', handler: () => navigation.push('HotspotBLE') },
    ],
    [navigation]
  );

  const renderItem = React.useCallback(
    ({
      item,
    }: {
      index: number;
      item: { title: string; handler: () => void };
    }) => {
      return (
        <TouchableOpacity onPress={item.handler} style={styles.row}>
          <Text>{item.title}</Text>
        </TouchableOpacity>
      );
    },
    []
  );

  const keyExtractor = React.useCallback((item) => item.title, []);

  return (
    <FlatList data={data} renderItem={renderItem} keyExtractor={keyExtractor} />
  );
};

export default Home;

const styles = StyleSheet.create({
  row: {
    height: 60,
    padding: 16,
    backgroundColor: 'white',
    justifyContent: 'center',
    borderBottomColor: 'lightgray',
    borderBottomWidth: 1,
  },
});
