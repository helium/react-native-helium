Use this module to assist in signing transactions via app links. For example, you could sign a transaction in your
app using the Helium Wallet app.

## Import the module

```ts
import { WalletLink } from '@helium/react-native-sdk';
```

## Use the module

### Request a wallet link token

The first step to deep linking is to request a token from an app capable of signing transactions (e.g. Helium Hotspot).
To do this you must use {@link createWalletLinkUrl} to create a deep link URL for the app capable of signing transactions.
This will then redirect the user to the authenticated app (e.g. Helium Hotspot) and create a wallet link token. The token
will then be passed back to your app via deep link back to the `callbackUrl`. This token should then be saved in your
app, it is required when requesting a signed transaction.

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

### Request signed gateway transactions (Add Gateway, Assert Location, Transfer Hotspot)

Request signing a gateway transactions by a supported app (e.g. Helium Hotspot). This is used for assert location,
add gateway, and transfer hotspot transactions. Only one transaction should be passed at a time. After creating the url
and opening the deep link, the app capable of signing transactions (e.g. Helium Hotspot) will be opened and the user
must confirm the information. After confirmation the transaction passed will be signed and passed back to your app via
the callback URL set by {@link createWalletLinkUrl} which is contained in the wallet link token. After receiving the
signed transaction, you will need to submit it via the helium api or sdk `heliumHttpClient.transactions.submit(txn)`.
See {@link createUpdateHotspotUrl} for more info.

```ts
import { WalletLink } from '@helium/react-native-sdk';
import { getBundleId } from 'react-native-device-info';
import { Linking } from 'react-native';

const url = WalletLink.createUpdateHotspotUrl({
  assertLocationTxn: 'assert_location_v2',
  addGatewayTxn: 'add_gateway_v1',
  transferHotspotTxn: 'add_transfer_v2',
  token: 'your_token',
});

Linking.openURL(url);
```
