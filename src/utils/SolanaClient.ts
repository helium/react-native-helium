import * as web3 from '@solana/web3.js'
import { Buffer } from 'buffer'

export default class SolanaClient {
  private connection!: web3.Connection

  constructor(cluster: 'mainnet-beta' | 'devnet' | 'testnet' = 'devnet') {
    this.connection = new web3.Connection(web3.clusterApiUrl(cluster))
  }

  async submitAll(txns: string[]) {
    return Promise.all(txns.map(this.submit))
  }

  async submit(txn: string) {
    const signature = await this.connection.sendRawTransaction(Buffer.from(txn))
    const confirmation = await this.confirmTxn(signature)
    return {
      err: confirmation.value.err,
      slot: confirmation.context.slot,
      signature,
    }
  }

  private async confirmTxn(signature: string) {
    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash()

    return this.connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature,
    })
  }
}
