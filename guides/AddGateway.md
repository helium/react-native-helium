Use this module to assist adding gateways to the Helium Network.

For example calculate add Hotspot fees with {@link calculateAddGatewayFee}, and sign add gateway transactions with {@link signGatewayTxn}.

## Import the module

```ts
import { AddGateway } from '@helium/react-native-sdk'
```

## Sign an Add Gateway Transaction

To add a gateway to the helium network you must create a signed
[AddGatewayV1](https://helium.github.io/helium-js/classes/transactions.AddGatewayV1.html) transaction. You can use
[@helium/transactions](https://helium.github.io/helium-js/modules/transactions.html) to create an [AddGatewayV1](https://helium.github.io/helium-js/classes/transactions.AddGatewayV1.html)
transaction and then use {@link signGatewayTxn} to sign it.

Here is a short example. For more information you can see the fully working
[example app](https://github.com/helium/react-native-helium/blob/main/example/src/AddGatewayTxn/AddGatewayTxn.tsx).


```ts
import { AddGatewayV1 } from '@helium/transactions'
import { AddGateway, Account, heliumHttpClient } from '@helium/react-native-sdk'

// the hotspot owners account
const { keypairRaw, address } = await Account.createKeypair() // could also pass in a mnemonic

const owner = Address.fromB58(address.b58)
const gateway = Address.fromB58('hotspotB58Address')
const payer = Address.fromB58(address.b58) // payer could also be a maker account, in which you would use the Onboarding module to sign the txn

const fees = AddGateway.calculateAddGatewayFee(address.b58, address.b58)
const txn = new AddGatewayV1({
  owner,
  gateway,
  payer,
  stakingFee: fees.stakingFee,
  fee: fees.fee,
})

const signedTxn = AddGateway.signGatewayTxn(txn.toString(), keypairRaw)
heliumHttpClient.transactions.submit(signedTxn)
```
