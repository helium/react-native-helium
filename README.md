# Helium React Native SDK

The Helium React Native SDK is a collection of modules that can be used by a [React Native](https://reactnative.dev/)
application to interact with [Hotspots](https://docs.helium.com/mine-hnt) and the [Helium Blockchain](https://docs.helium.com/blockchain).
It has first class support for [Typescript](https://www.typescriptlang.org/).

For usage, refer to the [Helium Maker Starter App](https://github.com/helium/maker-starter-app) which utilizes this
SDK to build out the base features needed to add Hotspots to the Helium Blockchain.

Along with this you may find the following Helium documentation useful:

- [Helium Developer Site](https://docs.helium.com/)
- [Helium Blockchain API](https://docs.helium.com/api/blockchain/introduction/)
- [Helium JS](https://helium.github.io/helium-js/)

## Installation

```sh
yarn add @helium/react-native-sdk
# or
npm install @helium/react-native-sdk
```

## Usage

Please browse the [documentation](https://helium.github.io/react-native-helium/index.html) for more information.

You can import the different modules such as [Account](https://helium.github.io/react-native-helium/modules/Account.html),
[Location](https://helium.github.io/react-native-helium/modules/Location.html),
[Onboarding](https://helium.github.io/react-native-helium/modules/Onboarding.html),
[HotspotBleManager](https://helium.github.io/react-native-helium/interfaces/HotspotBleManager.html),
[heliumHttpClient](https://helium.github.io/react-native-helium/docs/modules.html#heliumHttpClient),
and [AddGateway](https://helium.github.io/react-native-helium/modules/AddGateway.html) to get started.

```ts
import {
  Account,
  Location,
  Onboarding,
  AddGateway,
} from '@helium/react-native-sdk'

// example usage of Account.createKeypair
const { keypairRaw, address, mnemonic } = await Account.createKeypair()
```

## Example App

There is an example app included with this SDK. It's intended for reference only and currently does not build on the Apple M1 processor.
A practical use of this SDK can be seen here [Helium Maker Starter App](https://github.com/helium/maker-starter-app)

## Using Bluetooth

Use the {@link HotspotBleManager} to interact with a Hotspot via bluetooth.

### Import the Bluetooth modules

```ts
import { HotspotBleProvider, useHotspotBle } from '@helium/react-native-sdk'

// some examples of the functions you may want to use
const { startScan, stopScan, connect, scannedDevices } = useHotspotBle()
```

### Getting Started with Bluetooth

In order to get started with the {@link HotspotBleManager} you must first wrap your root app component in a
{@link HotspotBleProvider}.

For example:

```tsx
import React from 'react'
import { HotspotBleProvider } from '@helium/react-native-sdk'

const App = () => (
  <HotspotBleProvider>
    <YourRootAppComponent />
  </HotspotBleProvider>
)
```

You are now ready to use the {@link HotspotBleManager} throughout your application.

### Scanning for Hotspots

You can use the {@link HotspotBleManager} to {@link startScan}, {@link stopScan}, and read information from {@link scannedDevices}. Check
out the {@link Device} docs for more info on scanned devices.

For a full working example see the [example app](https://github.com/helium/react-native-helium/blob/main/example/src/HotspotBLE/ScanHotspots.tsx).

```tsx
import React, { useEffect } from 'react'
import { useHotspotBle } from '@helium/react-native-sdk'

const { startScan, stopScan, scannedDevices } = useHotspotBle()

useEffect(() => {
  // you would probably want to call this on a button click, we scan right away
  startScan((error) => {
    if (error) {
      console.error(error)
    }
  })
}, [])

useEffect(() => {
  // you would probably want to call this on a button click, but we stop after 10 seconds
  setTimeout(stopScan, 10000)
}, [])

const ScanComponent = () => <Text>{scannedDevices[0]?.localName}</Text>
```

### Connect to a Hotspot

After scanning, you can connect to {@link scannedDevices} by calling {@link connect}.

```ts
import { useHotspotBle } from '@helium/react-native-sdk'

const { connect, scannedDevices } = useHotspotBle()
connect(scannedDevices[0])
```

### Interact with a connected Hotspot

Once {@link connect} has been called you can use the other {@link HotspotBleManager} to interact with a connected {@link Device}. For
example, you may want to call {@link getDiagnosticInfo} to read the hotspot's diagnostic information or {@link readWifiNetworks}
to display available wifi networks the hotspot can see and then {@link setWifi} to set a network.

Visit the example app for full examples of
[Wifi Setup](https://github.com/helium/react-native-helium/blob/main/example/src/HotspotBLE/WifiSetup.tsx),
[WifiSettings](https://github.com/helium/react-native-helium/blob/main/example/src/HotspotBLE/WifiSettings.tsx), or
[Diagnostics](https://github.com/helium/react-native-helium/blob/main/example/src/HotspotBLE/Diagnostics.tsx).

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

[Apache License 2.0](https://github.com/helium/react-native-helium/blob/main/LICENSE)
