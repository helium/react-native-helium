# @helium/react-native-sdk

Helium React Native SDK

## Installation

```sh
yarn add @helium/react-native-sdk
npm install @helium/react-native-sdk
```

## Usage

You can import the different modules such as [Account](https://helium.github.io/react-native-helium/modules/Account.html),
[Location](https://helium.github.io/react-native-helium/modules/Location.html),
[Onboarding](https://helium.github.io/react-native-helium/modules/Onboarding.html),
[HotspotBleManager](https://helium.github.io/react-native-helium/interfaces/HotspotBleManager.html),
and [AddGateway](https://helium.github.io/react-native-helium/modules/AddGateway.html) to get started. Visit the
[documentation](https://helium.github.io/react-native-helium/index.html) for more examples.
```ts
import { Account, Location, Onboarding, AddGateway } from '@helium/react-native-sdk'

// example usage of Account.createKeypair
const { keypairRaw, address, mnemonic } = await Account.createKeypair()
```

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

[Apache License 2.0](https://github.com/helium/react-native-helium/blob/main/LICENSE)
