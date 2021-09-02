import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Device, useHotspotBle } from 'react-native-helium';
import {
  request,
  check,
  PERMISSIONS,
  RESULTS,
  PermissionStatus,
} from 'react-native-permissions';

const ScanHotspots = () => {
  const { startScan, stopScan } = useHotspotBle();
  const [devices, setDevices] = useState<Record<string, Device>>({});
  const [scanning, setScanning] = useState(false);
  const [canScan, setCanScan] = useState<boolean | undefined>(undefined);

  const showError = (error: any) => {
    console.log(error);
    Alert.alert(error.toString());
  };

  const updateCanScan = useCallback((result: PermissionStatus) => {
    switch (result) {
      case RESULTS.UNAVAILABLE:
      case RESULTS.BLOCKED:
      case RESULTS.DENIED:
      case RESULTS.LIMITED:
        setCanScan(false);
        break;
      case RESULTS.GRANTED:
        setCanScan(true);
        break;
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      setCanScan(true);
      return;
    }

    check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION)
      .then(updateCanScan)
      .catch(showError);
  }, [updateCanScan]);

  useEffect(() => {
    if (canScan !== false) return;

    request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION)
      .then(updateCanScan)
      .catch(showError);
  }, [canScan, updateCanScan]);

  const handleScanPress = useCallback(() => {
    const shouldScan = !scanning;
    setScanning(shouldScan);

    if (shouldScan) {
      startScan((error, device) => {
        if (error) {
          showError(error);
        }
        if (error || !device) return;

        setDevices((prevDevices) => ({ ...prevDevices, [device.id]: device }));
      });
    } else {
      stopScan();
    }
  }, [scanning, startScan, stopScan]);

  const renderItem = React.useCallback(
    ({ item: id }: { index: number; item: string }) => {
      const { name } = devices[id];
      return (
        <TouchableOpacity onPress={() => {}} style={styles.listItemContainer}>
          <Text>{name}</Text>
        </TouchableOpacity>
      );
    },
    [devices]
  );

  const keyExtractor = React.useCallback((id: string) => id, []);

  const data = useMemo(() => Object.keys(devices), [devices]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        contentContainerStyle={styles.container}
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
      />
      {canScan && (
        <Button
          title={scanning ? 'Stop Scan' : 'Start Scan'}
          onPress={handleScanPress}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listItemContainer: {
    height: 60,
    padding: 16,
    backgroundColor: 'white',
    justifyContent: 'center',
    borderBottomColor: 'lightgray',
    borderBottomWidth: 1,
  },
});

export default ScanHotspots;
