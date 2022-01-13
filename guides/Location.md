Use this module to assist asserting gateway locations on the Helium Network. You will be able to both change the
location of the hotspot, and update its antenna gain and elevation.

For example creating and signing an assert location transaction with {@link assertLocationTxn} and calculating its fees
with {@link calculateAssertLocFee}.

## Import the module

```ts
import { Location } from '@helium/react-native-sdk';
```

## Create a signed Assert Location Transaction

To assert a gateway's location you must create a signed
[AssertLocationV2](https://helium.github.io/helium-js/classes/transactions.AssertLocationV2.html) transaction. This is done using
[@helium/transactions](https://helium.github.io/helium-js/modules/transactions.html), and packaged nicely into the
{@link assertLocationTxn} function. This function will take in the required fields and return you a signed transaction.
If you only want to change gain and elevation you do not need to pass in the lat and lng properties. Likewise, if you
only want to change location don't pass in the gain and elevation. The transaction fee depends on what is passed, see the
fee section below to learn more.

Here is a short example. For more information you can see the fully working
[example app](https://github.com/helium/react-native-helium/blob/main/example/src/AssertLocation/AssertLocation.tsx).

```ts
import { Location, Account, heliumHttpClient } from '@helium/react-native-sdk';
import OnboardingClient, { OnboardingRecord } from '@helium/onboarding';

// the hotspot owners account
const { keypairRaw, address } = await Account.createKeypair(); // could also pass in a mnemonic

// Use Onboarding to get the hotspots onboarding record
const onboardingRecord = await new OnboardingClient().getOnboardingRecord(
  hotspotAddress
)?.data;

const signedTxn = await Location.assertLocationTxn({
  gateway: hotspot.address, // from the current hotspot
  owner: address,
  lat: 37.773972, // location latitude
  lng: -122.431297, // location longitude
  decimalGain: 1.0, // dbi
  elevation: 5, // meters
  locationNonceLimit: onboardingRecord.maker.locationNonceLimit,
  makerAddress: onboardingRecord.maker.address,
  ownerKeypairRaw: keypairRaw,
  currentLocation: hotspot.location, // from the current hotspot
});

heliumHttpClient.transactions.submit(signedTxn);
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
