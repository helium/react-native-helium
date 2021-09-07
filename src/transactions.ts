import { AddGatewayV1 } from '@helium/transactions'

export interface SignableKeypair {
  sign(message: string | Uint8Array): Promise<Uint8Array>
}
export const makeAddGatewayTxn = async (
  partialTxnBin: string,
  ownerKeypair: SignableKeypair
) => {
  const addGatewayTxn = AddGatewayV1.fromString(partialTxnBin)

  if (!ownerKeypair) return null

  return addGatewayTxn.sign({
    owner: ownerKeypair,
  })
}
