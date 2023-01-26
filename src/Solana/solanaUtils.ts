import { Buffer } from 'buffer'
import * as web3 from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { PROGRAM_ID as BUBBLEGUM_PROGRAM_ID } from '@metaplex-foundation/mpl-bubblegum'
import { SolHotspot } from '../Solana/solanaTypes'
import { WrappedConnection } from './WrappedConnection'

export const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new web3.PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
)

export const TXN_FEE_IN_LAMPORTS = 5000
export const TXN_FEE_IN_SOL = TXN_FEE_IN_LAMPORTS / web3.LAMPORTS_PER_SOL

export const SolanaConnection = {
  'devnet': new WrappedConnection('https://rpc-devnet.aws.metaplex.com/'),
  'testnet': new WrappedConnection(web3.clusterApiUrl('testnet')),
  'mainnet-beta': new WrappedConnection(web3.clusterApiUrl('mainnet-beta')),
} as const

export const isSolHotspot = (hotspot: any): hotspot is SolHotspot =>
  Object.keys(hotspot).includes('numLocationAsserts')

export const getSolanaKeypair = (secretKey: string) => {
  return web3.Keypair.fromSecretKey(Buffer.from(secretKey, 'base64'))
}

export const stringToTransaction = (solanaTransaction: string) =>
  web3.Transaction.from(Buffer.from(solanaTransaction))

export const bufferToTransaction = (solanaTransaction: Buffer) =>
  web3.Transaction.from(solanaTransaction)

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

export const mapProof = (assetProof: {
  proof: string[]
}): web3.AccountMeta[] => {
  if (!assetProof.proof || assetProof.proof.length === 0) {
    throw new Error('Proof is empty')
  }
  return assetProof.proof.map((node) => ({
    pubkey: new web3.PublicKey(node),
    isSigner: false,
    isWritable: false,
  }))
}
