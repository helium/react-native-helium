Use this module to assist in signing transactions via app links. For example, you could sign a transaction in your
app using the Helium Wallet app.

## Import the module

```ts
import { WalletLink } from '@helium/react-native-sdk';
```

## Use the module

Follow these steps to use deep links in your app:
1. Call {@link createWalletLinkUrl} to create a deeplink from your app to an app capable of signing transactions (e.g. Helium Hotspot). See "Request a wallet link token" below.
2. Open this `createWalletLinkUrl` using `Linking.openURL(url)`.
3. This will open the authenticated app (e.g. Helium Hotspot) and approve link permission, creating a wallet link token and passing it back to your app via the callback url.
4. Use {@link createUpdateHotspotUrl} to create a deeplink to sign Add Gateway, Assert Location and Transfer Hotspot transactions. You must pass the unsigned transaction and the wallet link token. See "Request signed gateway transactions" below.
5. Open this `createUpdateHotspotUrl` using `Linking.openURL(url)`. The authorized app will call back with the signed transaction.
6. Submit the signed transaction to the blockchain using the [Helium Blockchain API](https://docs.helium.com/api/blockchain/pending-transactions#submit-a-new-transaction) or [Helium JS](https://helium.github.io/helium-js/index.html) e.g. `heliumHttpClient.transactions.submit(txn)`


### Request a wallet link token

The first step to deep linking is to request a token from an app capable of signing transactions (e.g. Helium Hotspot).
To do this you must use {@link createWalletLinkUrl} to create a deep link URL which will provide your app with a wallet link token.
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

Request signing of gateway transactions by a supported app (e.g. Helium Hotspot). This is used for assert location,
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

// sign an add_gateway_v1 transaction
const addUrl = WalletLink.createUpdateHotspotUrl({
  addGatewayTxn: 'add_gateway_v1', // unsigned add_gateway_v1 txn string
  token: 'your_token',
});
Linking.openURL(addUrl);

// sign an assert_location_v2 transaction
const assertUrl = WalletLink.createUpdateHotspotUrl({
  assertLocationTxn: 'assert_location_v2', // unsigned assert_location_v2 txn string
  token: 'your_token',
});
Linking.openURL(assertUrl);

// sign a transfer_hotspot_v2 transaction
const transferUrl = WalletLink.createUpdateHotspotUrl({
  transferHotspotTxn: 'transfer_hotspot_v2', // unsigned transfer_hotspot_v2 txn string
  token: 'your_token',
});
Linking.openURL(transferUrl);
```
