import { Buffer } from 'buffer'
import * as web3 from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, AccountLayout } from '@solana/spl-token'
import { AnchorProvider, Wallet, Program } from '@project-serum/anchor'
import { heliumAddressToSolPublicKey } from '../Account/account'
import {
  hotspotConfigKey,
  init,
  iotInfoKey,
} from '@helium/helium-entity-manager-sdk'
import { HeliumEntityManager } from '@helium/idls/lib/types/helium_entity_manager'
import BN from 'bn.js'
import { Hotspot } from '@helium/http'
import { subDaoKey } from '@helium/helium-sub-daos-sdk'
import { sendAndConfirmWithRetry } from '@helium/spl-utils'
import {
  getPythProgramKeyForCluster,
  PriceStatus,
  PythHttpClient,
} from '@pythnetwork/client'

export type SolHotspot = {
  asset: web3.PublicKey
  bumpSeed: number
  elevation: number
  gain: number
  hotspotKey: string
  isFullHotspot: boolean
  location: BN | null
  numLocationAsserts: number
}

export const getSolanaKeypair = (secretKey: string) => {
  return web3.Keypair.fromSecretKey(Buffer.from(secretKey, 'base64'))
}

export const createHeliumEntityManagerProgram = async ({
  publicKey,
  connection,
}: {
  publicKey: web3.PublicKey
  connection: web3.Connection
}) => {
  const provider = new AnchorProvider(
    connection,
    {
      publicKey,
    } as Wallet,
    {}
  )
  return init(provider)
}

export const getHeliumBalance = async ({
  heliumAddress,
  mint,
  connection,
}: {
  heliumAddress: string
  mint: string
  connection: web3.Connection
}) => {
  const key = heliumAddressToSolPublicKey(heliumAddress)

  const tokenAccounts = await connection.getTokenAccountsByOwner(key, {
    programId: TOKEN_PROGRAM_ID,
  })

  const tokenAcct = tokenAccounts.value.find((ta) => {
    const accountData = AccountLayout.decode(ta.account.data)
    return accountData.mint.toBase58() === mint
  })
  if (!tokenAcct) return

  return Number(AccountLayout.decode(tokenAcct.account.data).amount)
}

export const getSolBalance = async ({
  connection,
  heliumAddress,
}: {
  connection: web3.Connection
  heliumAddress: string
}) => {
  const key = heliumAddressToSolPublicKey(heliumAddress)
  return connection.getBalance(key)
}

export const getSolHotspotInfo = async ({
  iotMint,
  hotspotAddress,
  program,
}: {
  iotMint: string
  hotspotAddress: string
  program: Program<HeliumEntityManager>
}) => {
  const sdkey = subDaoKey(new web3.PublicKey(iotMint))[0]
  const hckey = hotspotConfigKey(sdkey, 'IOT')[0]
  const infoKey = iotInfoKey(hckey, hotspotAddress)[0]
  const info = await program.account.iotHotspotInfoV0.fetchNullable(infoKey)
  if (info) {
    return info as SolHotspot
  }
  return null
}

export const submitSolana = async ({
  txn,
  connection,
}: {
  txn: Buffer
  connection: web3.Connection
}) => {
  const { txid } = await sendAndConfirmWithRetry(
    connection,
    txn,
    { skipPreflight: true },
    'confirmed'
  )

  return txid
}

export const submitAllSolana = ({
  txns,
  connection,
}: {
  txns: Buffer[]
  connection: web3.Connection
}) => {
  return Promise.all(txns.map((txn) => submitSolana({ connection, txn })))
}

export const isSolHotspot = (
  hotspot: SolHotspot | Hotspot
): hotspot is SolHotspot => Object.keys(hotspot).includes('numLocationAsserts')

export const stringToTransaction = (solanaTransaction: string) =>
  web3.Transaction.from(Buffer.from(solanaTransaction))

export const bufferToTransaction = (solanaTransaction: Buffer) =>
  web3.Transaction.from(solanaTransaction)

export const getOraclePriceFromSolana = async ({
  connection,
  cluster,
  tokenType,
}: {
  connection: web3.Connection
  cluster: web3.Cluster
  tokenType: 'HNT'
}) => {
  const pythPublicKey = getPythProgramKeyForCluster(cluster)
  connection.getProgramAccounts
  const pythClient = new PythHttpClient(connection, pythPublicKey)
  const data = await pythClient.getData()

  let symbol = ''
  switch (tokenType) {
    case 'HNT':
      symbol = 'Crypto.HNT/USD'
  }

  const price = data.productPrice.get(symbol)

  if (price?.price) {
    console.log(`${symbol}: $${price.price} \xB1$${price.confidence}`)
    return price.price
  }

  console.log(
    `${symbol}: price currently unavailable. status is ${
      PriceStatus[price?.status || 0]
    }`
  )

  // TODO: Remove and throw an error
  return 2.86
}
