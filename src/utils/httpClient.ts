import Client, { Network } from '@helium/http'
import { Transaction } from '@helium/transactions'

/**
 * The heliumHttpClient provides access to the [Helium Blockchain API](https://docs.helium.com/api/blockchain/introduction).
 * You can find the [Client](https://helium.github.io/helium-js/classes/http.Client.html)
 * documentation in the [helium-js](https://helium.github.io/helium-js) repo.
 *
 * This client uses the [Helium Blockchain API](https://docs.helium.com/api/blockchain/introduction)
 * by default, you also have the option to host your own blockchain API. To use a
 * custom blockchain api see {@link createHttpClient}.
 */
export const heliumHttpClient = new Client()

/**
 * If you don't want to use the [Helium Blockchain API](https://docs.helium.com/api/blockchain/introduction)
 * you can host your own blockchain api and use this method to create a client.
 *
 * For example:
 * ```ts
 * const customHttpClient = await createHttpClient("https://blockchain-base-url.com")
 * await customHttpClient.transactions.submit(txn)
 * ```
 * @param baseURL
 */
export const createHttpClient = async (baseURL: string): Promise<Client> => {
  const network = new Network({ baseURL, version: 1 })
  const client = new Client(network)
  const vars = await client.vars.get()
  Transaction.config(vars)
  return client
}

const configChainVars = async () => {
  const vars = await heliumHttpClient.vars.get()
  Transaction.config(vars)
}
configChainVars()
