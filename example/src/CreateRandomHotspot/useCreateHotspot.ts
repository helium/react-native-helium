import Address from '@helium/address'
import { Keypair } from '@helium/crypto'
import { AddGatewayV1, useOnboarding } from '@helium/react-native-sdk'
import axios from 'axios'
import { useState } from 'react'

function random(len: number): string {
  return new Array(len).join().replace(/(.|$)/g, function () {
    // eslint-disable-next-line no-bitwise
    return ((Math.random() * 36) | 0).toString(36)
  })
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
    let me: Keypair
    let gateway: Keypair
    const maker = Address.fromB58(makerAddress)
    const onboardingKey = random(10)

    me = await Keypair.makeRandom()
    gateway = await Keypair.makeRandom()

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

    await sleep(2000)

    await axios.get(`${baseUrl}/hotspots/${onboardingKey}`)

    await sleep(2000)

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
