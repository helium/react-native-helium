### The following high level steps need to be taken to transfer a hotspot

1. Create a TransferHotspotV2 transaction
2. Sign the transaction with the owners keypair
3. Submit the signed transaction to the helium api

Example:

```ts
import { Transfer, heliumHttpClient } from '@helium/react-native-sdk';

// create a TransferHotspotV2 transaction
const transferV2 = Transfer.createTransferV2(
  gatewayB58,
  ownerB58,
  newOwnerB58,
  nonce
);

// Sign the transaction with the owners keypair
const signedTransferV2 = transferV2.sign({
  owner: ownerKeypair,
})

// Submit the signed transaction to the helium api, the pending transaction is returned
const pendingTxn = await heliumHttpClient.transactions.submit(signedTransferV2.toString())
```
