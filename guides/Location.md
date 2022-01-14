### The following high level steps need to be taken to update hotspot location

1. Construct an AssertLocationV2 txn
2. Deep link to hotspot app for signing
3. If the assertion is to be paid for by the maker, send to onboarding server
4. Submit to helium api

Use this module to assist asserting gateway locations on the Helium Network. You will be able to both change the
location of the hotspot, and update its antenna gain and elevation.

For example creating and signing an assert location transaction with {@link assertLocationTxn} and calculating its fees
with {@link calculateAssertLocFee}.

## Import the module

```ts
import { Location } from '@helium/react-native-sdk';
```

## Create the Assert Location Transaction

```ts
const assertLocationTxn = await Location.createLocationTxn({
  gateway: hotspotAddress,
  lat,
  lng,
  decimalGain: params.gain,
  elevation: params.elevation,
  dataOnly: false,
  owner: ownerAddress,
  // currentLocation: '', // If reasserting location, put previous location here
  makerAddress: onboardingRecord.maker.address,
  location,
});
```

## Calculate Assert Location Fees

There are two fees associated with asserting hotspot location. These fees are paid by either the maker, or the hotspot
owner depending on how many free asserts the maker provides. If the payer account has no DC, HNT will be implicitly
burned to cover the transaction fees.

There are currently two fees that occur, if changing hotspot location a staking fee of 1,000,000 DC ($10) is added to
the base transaction fee of 55,000 DC ($0.55).

You can use the {@link calculateAssertLocFee} function to determine what fees the transaction will charge. The nonce
should be provided from the hotspot's nonce.

You can read more about transaction fees on the [Helium Docs](https://docs.helium.com/blockchain/transaction-fees).
