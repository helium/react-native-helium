Use this module to assist in signing transactions via app links. For example, you could sign a transaction in your
app using the Helium Wallet app.

## Import the module

```ts
import { WalletLink } from '@helium/react-native-sdk';
```

## Use the module

### Request a wallet link token

Request a token from your app to an app capable of signing a transaction (e.g. Helium Hotspot). This token is
required when requesting a signed transaction. See {@link createWalletLinkUrl} for more info.

```ts
import { WalletLink } from '@helium/react-native-sdk';
import { getBundleId } from 'react-native-device-info';
import { Linking } from 'react-native';

const url = WalletLink.createWalletLinkUrl({
  universalLink: WalletLink.delegateApps[0].universalLink,
  requestAppId: getBundleId(),
  callbackUrl: 'makerappscheme://', // Your app deep link url
  appName: 'Maker App', // Your app name
});
Linking.openURL(url);
```

### Request signed gateway transactions

Request signed gateway transactions from a supported app (e.g. Helium Hotspot).
You will need to submit these transactions `heliumHttpClient.transactions.submit(txn)`.
See {@link createUpdateHotspotUrl} for more info.

```ts
import { WalletLink } from '@helium/react-native-sdk';
import { getBundleId } from 'react-native-device-info';
import { Linking } from 'react-native';

const url = WalletLink.createUpdateHotspotUrl({
  assertLocationTxn: 'assert_location_v2',
  addGatewayTxn: 'add_gateway_v1',
  token: 'your_token',
});

Linking.openURL(url);
```
