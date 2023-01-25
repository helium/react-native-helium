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
import { Hotspot } from '@helium/http'
import { subDaoKey } from '@helium/helium-sub-daos-sdk'
import { sendAndConfirmWithRetry } from '@helium/spl-utils'
import {
  getPythProgramKeyForCluster,
  PriceStatus,
  PythHttpClient,
} from '@pythnetwork/client'
import { WrappedConnection } from './WrappedConnection'
import { AssetProof, CompressedNFT, SolHotspot } from '../types/solTypes'
import {
  createTransferInstruction,
  PROGRAM_ID as BUBBLEGUM_PROGRAM_ID,
} from '@metaplex-foundation/mpl-bubblegum'
import {
  ConcurrentMerkleTreeAccount,
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
} from '@solana/spl-account-compression'
import bs58 from 'bs58'

export const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new web3.PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
)

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

export function createAssociatedTokenAccountInstruction(
  associatedTokenAddress: web3.PublicKey,
  payer: web3.PublicKey,
  walletAddress: web3.PublicKey,
  splTokenMintAddress: web3.PublicKey
) {
  const keys = [
    {
      pubkey: payer,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: associatedTokenAddress,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: walletAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: splTokenMintAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: web3.SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ]
  return new web3.TransactionInstruction({
    keys,
    programId: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    data: Buffer.from([]),
  })
}

export const getBubblegumAuthorityPDA = async (
  merkleRollPubKey: web3.PublicKey
) => {
  const [bubblegumAuthorityPDAKey] = await web3.PublicKey.findProgramAddress(
    [merkleRollPubKey.toBuffer()],
    BUBBLEGUM_PROGRAM_ID
  )
  return bubblegumAuthorityPDAKey
}

const mapProof = (assetProof: { proof: string[] }): web3.AccountMeta[] => {
  if (!assetProof.proof || assetProof.proof.length === 0) {
    throw new Error('Proof is empty')
  }
  return assetProof.proof.map((node) => ({
    pubkey: new web3.PublicKey(node),
    isSigner: false,
    isWritable: false,
  }))
}

export const createTransferCompressedCollectableTxn = async ({
  collectable,
  ownerHeliumAddress,
  newOwnerHeliumAddress,
  connection: conn,
}: {
  collectable: CompressedNFT
  ownerHeliumAddress: string
  newOwnerHeliumAddress: string
  connection: WrappedConnection
}) => {
  const payer = heliumAddressToSolPublicKey(ownerHeliumAddress)
  const recipientPubKey = heliumAddressToSolPublicKey(newOwnerHeliumAddress)
  const instructions: web3.TransactionInstruction[] = []

  const { result: assetProof } = await conn.getAssetProof<{
    result: AssetProof
  }>(collectable.id)

  const treeAuthority = await getBubblegumAuthorityPDA(
    new web3.PublicKey(assetProof.tree_id)
  )

  const leafDelegate = collectable.ownership.delegate
    ? new web3.PublicKey(collectable.ownership.delegate)
    : new web3.PublicKey(collectable.ownership.owner)
  const merkleTree = new web3.PublicKey(assetProof.tree_id)
  const tree = await ConcurrentMerkleTreeAccount.fromAccountAddress(
    conn,
    merkleTree,
    'confirmed'
  )
  const canopyHeight = tree.getCanopyDepth()
  const proofPath = mapProof(assetProof)
  const anchorRemainingAccounts = proofPath.slice(
    0,
    proofPath.length - (canopyHeight || 0)
  )
  instructions.push(
    createTransferInstruction(
      {
        treeAuthority,
        leafOwner: new web3.PublicKey(collectable.ownership.owner),
        leafDelegate,
        newLeafOwner: recipientPubKey,
        merkleTree,
        logWrapper: SPL_NOOP_PROGRAM_ID,
        compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
        anchorRemainingAccounts,
      },
      {
        root: [...Buffer.from(bs58.decode(assetProof.root))],
        dataHash: [
          ...Buffer.from(bs58.decode(collectable.compression.data_hash.trim())),
        ],
        creatorHash: [
          ...Buffer.from(
            bs58.decode(collectable.compression.creator_hash.trim())
          ),
        ],
        nonce: collectable.compression.leaf_id,
        index: collectable.compression.leaf_id,
      }
    )
  )

  const { blockhash } = await conn.getLatestBlockhash()
  const messageV0 = new web3.TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToLegacyMessage()
  return new web3.VersionedTransaction(
    web3.VersionedMessage.deserialize(messageV0.serialize())
  )
}

export const getHotspots = async ({
  heliumAddress,
  connection,
  oldestCollectable,
}: {
  heliumAddress: string
  connection: WrappedConnection
  oldestCollectable: string
}) => {
  const owner = heliumAddressToSolPublicKey(heliumAddress)
  const response = await connection.getAssetsByOwner<{
    result: { items: CompressedNFT[] }
  }>(
    owner.toString(),
    { sortBy: 'created', sortDirection: 'asc' },
    50,
    1,
    '',
    oldestCollectable || ''
  )

  return response.result.items
}
