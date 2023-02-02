import Address from '@helium/address'
import {
  AddGatewayV1,
  Keypair,
  useOnboarding,
  useSolana,
} from '@helium/react-native-sdk'
import axios from 'axios'
import { useCallback, useState } from 'react'
import { getKeypairRaw } from '../Account/secureAccount'
import { Buffer } from 'buffer'

function random(len: number): string {
  return new Array(len).join().replace(/(.|$)/g, function () {
    // eslint-disable-next-line no-bitwise
    return ((Math.random() * 36) | 0).toString(36)
  })
}

const useCreateRandomHotspot = () => {
  const [txn, setTxn] = useState('')
  const { baseUrl, onboardingClient } = useOnboarding()
  const solana = useSolana()

  const createHotspot = useCallback(
    async (signedTxn: AddGatewayV1) => {
      const createTxns = await onboardingClient.createHotspot({
        transaction: signedTxn.toString(),
      })

      return solana.submitAllSolana({
        txns: (createTxns.data?.solanaTransactions || []).map((t) => {
          const buff = Buffer.from(t)
          console.log(buff.toString('base64'))
          return buff
        }),
      })
    },
    [onboardingClient, solana]
  )

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
      owner: me.address,
      gateway: gateway.address,
      payer: maker,
    })

    const signedTxn = await nextTxn.sign({
      gateway,
    })

    setTxn(signedTxn.toString())

    return createHotspot(signedTxn)
  }

  return { txn, create }
}

export default useCreateRandomHotspot
