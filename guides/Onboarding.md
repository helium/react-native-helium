Use this module to assist in using the onboarding server to sign transactions and get information about hotspot makers.

## Import the module

```ts
import { Onboarding } from '@helium/react-native-sdk'
```

## Use the module
After importing the module, you are free to interact with any of its function. For example, you may want to call {@link getMakers}
to get information about the Helium hotspot makers or {@link getOnboardingRecord} to get an onboarding record for a hotspot.

```ts
import { Onboarding } from '@helium/react-native-sdk'

const makers = await Onboarding.getMakers()
const onboardingRecord = await Onboarding.getOnboardingRecord("hotspotAddress")
```

