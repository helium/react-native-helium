import { useCallback, useRef } from 'react'
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
import { subDaoKey } from '@helium/helium-sub-daos-sdk'
import { sendAndConfirmWithRetry } from '@helium/spl-utils'
import {
  getPythProgramKeyForCluster,
  PriceStatus,
  PythHttpClient,
} from '@pythnetwork/client'
import { createTransferInstruction } from '@metaplex-foundation/mpl-bubblegum'
import {
  ConcurrentMerkleTreeAccount,
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
} from '@solana/spl-account-compression'
import bs58 from 'bs58'
import { SolHotspot, AssetProof, CompressedNFT } from './solanaTypes'
import {
  getBubblegumAuthorityPDA,
  mapProof,
  SolanaConnection,
} from './solanaUtils'
import { useSolanaStatus, useSolanaVars } from './solanaSentinel'

const useSolana = ({
  cluster = 'devnet',
}: {
  cluster?: 'mainnet-beta' | 'devnet' | 'testnet'
}) => {
  const { isHelium, isSolana, inProgress } = useSolanaStatus()
  const { data: vars } = useSolanaVars(cluster)
  const solPubKey = useRef<web3.PublicKey>()
  const hemProgram = useRef<Program<HeliumEntityManager>>()
  const connection = useRef(SolanaConnection[cluster])

  const getHeliumEntityManagerProgram = useCallback(
    async (publicKey: web3.PublicKey) => {
      if (
        hemProgram.current &&
        solPubKey.current &&
        publicKey.equals(solPubKey.current)
      ) {
        return hemProgram.current
      }

      const provider = new AnchorProvider(
        connection.current,
        {
          publicKey,
        } as Wallet,
        {}
      )
      const nextHemProgram = await init(provider)

      hemProgram.current = nextHemProgram
      solPubKey.current = publicKey

      return nextHemProgram
    },
    []
  )

  const getHeliumBalance = useCallback(
    async ({
      heliumAddress,
      mint,
    }: {
      heliumAddress: string
      mint: string
    }) => {
      const key = heliumAddressToSolPublicKey(heliumAddress)

      const tokenAccounts = await connection.current.getTokenAccountsByOwner(
        key,
        {
          programId: TOKEN_PROGRAM_ID,
        }
      )

      const tokenAcct = tokenAccounts.value.find((ta) => {
        const accountData = AccountLayout.decode(ta.account.data)
        return accountData.mint.toBase58() === mint
      })
      if (!tokenAcct) return

      return Number(AccountLayout.decode(tokenAcct.account.data).amount)
    },
    []
  )

  const getSolBalance = useCallback(
    async ({ heliumAddress }: { heliumAddress: string }) => {
      const key = heliumAddressToSolPublicKey(heliumAddress)
      return connection.current.getBalance(key)
    },
    []
  )

  const getSolHotspotInfo = useCallback(
    async ({
      iotMint,
      hotspotAddress,
      pubKey,
    }: {
      iotMint: string
      hotspotAddress: string
      pubKey: web3.PublicKey
    }) => {
      const sdkey = subDaoKey(new web3.PublicKey(iotMint))[0]
      const hckey = hotspotConfigKey(sdkey, 'IOT')[0]
      const infoKey = iotInfoKey(hckey, hotspotAddress)[0]
      const program = await getHeliumEntityManagerProgram(pubKey)
      const info = await program.account.iotHotspotInfoV0.fetchNullable(infoKey)
      if (info) {
        return info as SolHotspot
      }
      return null
    },
    [getHeliumEntityManagerProgram]
  )

  const submitSolana = useCallback(async ({ txn }: { txn: Buffer }) => {
    const { txid } = await sendAndConfirmWithRetry(
      connection.current,
      txn,
      { skipPreflight: true },
      'confirmed'
    )

    return txid
  }, [])

  const submitAllSolana = useCallback(
    ({ txns }: { txns: Buffer[] }) =>
      Promise.all(txns.map((txn) => submitSolana({ txn }))),
    [submitSolana]
  )

  const getOraclePriceFromSolana = useCallback(
    async ({ tokenType }: { tokenType: 'HNT' }) => {
      const pythPublicKey = getPythProgramKeyForCluster(cluster)
      connection.current.getProgramAccounts
      const pythClient = new PythHttpClient(connection.current, pythPublicKey)
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
    },
    [cluster]
  )

  const createTransferCompressedCollectableTxn = useCallback(
    async ({
      collectable,
      ownerHeliumAddress,
      newOwnerHeliumAddress,
    }: {
      collectable: CompressedNFT
      ownerHeliumAddress: string
      newOwnerHeliumAddress: string
    }): Promise<web3.VersionedTransaction | undefined> => {
      const payer = heliumAddressToSolPublicKey(ownerHeliumAddress)
      const recipientPubKey = heliumAddressToSolPublicKey(newOwnerHeliumAddress)
      const instructions: web3.TransactionInstruction[] = []

      const { result: assetProof } = await connection.current.getAssetProof<{
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
        connection.current,
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
              ...Buffer.from(
                bs58.decode(collectable.compression.data_hash.trim())
              ),
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

      const { blockhash } = await connection.current.getLatestBlockhash()
      const messageV0 = new web3.TransactionMessage({
        payerKey: payer,
        recentBlockhash: blockhash,
        instructions,
      }).compileToLegacyMessage()
      return new web3.VersionedTransaction(
        web3.VersionedMessage.deserialize(messageV0.serialize())
      )
    },
    []
  )

  const getHotspots = useCallback(
    async ({
      heliumAddress,
      oldestCollectable,
    }: {
      heliumAddress: string
      oldestCollectable?: string
    }) => {
      const owner = heliumAddressToSolPublicKey(heliumAddress)
      const response = await connection.current.getAssetsByOwner<{
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
    },
    []
  )

  return {
    connection: connection.current,
    createTransferCompressedCollectableTxn,
    getHeliumBalance,
    getHotspots,
    getOraclePriceFromSolana,
    getSolBalance,
    getSolHotspotInfo,
    status: {
      inProgress,
      isHelium,
      isSolana,
    },
    submitSolana,
    submitAllSolana,
    vars,
  }
}

export default useSolana
