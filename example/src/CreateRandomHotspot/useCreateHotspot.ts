import Address from '@helium/address'
import { AddGatewayV1, Keypair, useOnboarding } from '@helium/react-native-sdk'
import axios from 'axios'
import { useState } from 'react'
import { getKeypairRaw } from '../Account/secureAccount'

function random(len: number): string {
  return new Array(len).join().replace(/(.|$)/g, function () {
    // eslint-disable-next-line no-bitwise
    return ((Math.random() * 36) | 0).toString(36)
  })
}

const useCreateRandomHotspot = () => {
  const [txn, setTxn] = useState('')
  const { baseUrl } = useOnboarding()

  const create = async ({
    authorization,
    makerAddress,
  }: {
    makerAddress: string
    authorization: string
  }) => {
    const me = new Keypair(await getKeypairRaw())
    const gateway = await Keypair.makeRandom()
    const maker = Address.fromB58(makerAddress)
    const onboardingKey = random(10)

    await axios.post(
      `${baseUrl}/hotspots`,
      {
        onboardingKey,
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
      owner: me.address,
      gateway: gateway.address,
      payer: maker,
    })

    const signedTxn = await nextTxn.sign({
      gateway,
    })

    setTxn(signedTxn.toString())

    return axios.post(`${baseUrl}/transactions/pay/${onboardingKey}`, {
      transaction: signedTxn.toString(),
    })
  }

  return { txn, create }
}

export default useCreateRandomHotspot