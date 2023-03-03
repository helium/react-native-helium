import Address from '@helium/address'
import { AddGatewayV1, Keypair, useOnboarding } from '@helium/react-native-sdk'
import { heliumAddressFromSolAddress } from '@helium/spl-utils'
import axios from 'axios'
import { useState } from 'react'

function random(len: number): string {
  return new Array(len).join().replace(/(.|$)/g, function () {
    // eslint-disable-next-line no-bitwise
    return ((Math.random() * 36) | 0).toString(36)
  })
}

const useCreateHotspot = () => {
  const [txn, setTxn] = useState('')
  const { baseUrl } = useOnboarding()

  const create = async ({
    authorization,
    makerAddress,
    ownerAddress,
  }: {
    ownerAddress?: string
    makerAddress: string
    authorization: string
  }) => {
    const gateway = await Keypair.makeRandom()
    const maker = Address.fromB58(makerAddress)
    let owner: Address | undefined
    if (ownerAddress) {
      try {
        owner = Address.fromB58(ownerAddress)
      } catch {
        owner = Address.fromB58(heliumAddressFromSolAddress(ownerAddress))
      }
    }

    // Adds hotspot to onboarding server db
    await axios.post(
      `${baseUrl}/v3/hotspots`,
      {
        onboardingKey: gateway.address.b58,
        macWlan0: random(10),
        macEth0: random(10),
        rpiSerial: random(10),
        heliumSerial: random(10),
        batch: 'example-batch',
      },
      {
        headers: {
          authorization,
        },
      }
    )

    const nextTxn = new AddGatewayV1({
      owner,
      gateway: gateway.address,
      payer: maker,
    })

    const signedTxn = await nextTxn.sign({
      gateway,
    })

    setTxn(signedTxn.toString())
  }

  return { txn, create }
}

export default useCreateHotspot
