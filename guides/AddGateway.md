### The following high level steps need to be taken to add a new hotspot

1. Connect to Hotspot over BLE, get onboarding address
2. Get the onboarding record from the onboarding server
3. Create an AddGatewayV1 transaction
4. Sign the transaction
5. Post the transaction to the onboarding server to have the maker pay for the transaction
6. Submit the onboarding txn to the helium api

Your app can utilize the `OnboardingProvider` and `HotspotBle` providers to simplify these interactions

```ts
import {
  HotspotBleProvider,
  OnboardingProvider,
} from '@helium/react-native-sdk';

// Dewi is the default url. You do not need to assign baseUrl if you plan to use it.
<OnboardingProvider baseUrl="https://onboarding.dewi.org/api/v2">
  <HotspotBleProvider>
    <YourApp />
  </HotspotBleProvider>
</OnboardingProvider>;
```

They can then be used like

```ts
import { useHotspotBle, useOnboarding } from '@helium/react-native-sdk';

const { getOnboardingRecord, postPaymentTransaction } = useOnboarding()}
const { createGatewayTxn } = useHotspotBle()
```
