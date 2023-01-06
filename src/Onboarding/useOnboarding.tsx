import { useCallback, useRef } from 'react'
import OnboardingClient from '@helium/onboarding'
import * as web3 from '@solana/web3.js'
import { Buffer } from 'buffer'
import { sendAndConfirmWithRetry } from '@helium/spl-utils'
import { getSolanaStatus, heliumHttpClient } from '@helium/react-native-sdk'
import { Client, Hotspot, PendingTransaction } from '@helium/http'
import { getSolanaVars, SolanaStatus } from '../utils/solanaSentinel'
import { subDaoKey } from '@helium/helium-sub-daos-sdk'
import {
  hotspotConfigKey,
  init,
  iotInfoKey,
} from '@helium/helium-entity-manager-sdk'
import { AnchorProvider, Wallet, Program } from '@project-serum/anchor'
import { SolHotspot } from './onboardingTypes'
import { HeliumEntityManager } from '@helium/idls/lib/types/helium_entity_manager'

export const isSolHotspot = (
  hotspot: SolHotspot | Hotspot
): hotspot is SolHotspot => Object.keys(hotspot).includes('numLocationAsserts')

const useOnboarding = (
  baseUrl?: string,
  solanaCluster?: 'mainnet-beta' | 'devnet' | 'testnet'
) => {
  const onboardingClient = useRef(new OnboardingClient(baseUrl))
  const solPubKey = useRef<web3.PublicKey>()
  const hemProgram = useRef<Program<HeliumEntityManager>>()
  const solConnection = useRef(
    new web3.Connection(web3.clusterApiUrl(solanaCluster))
  )

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
        solConnection.current,
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

  const submit = useCallback(async (txn: string) => {
    const { txid } = await sendAndConfirmWithRetry(
      solConnection.current,
      Buffer.from(txn),
      { skipPreflight: true },
      'confirmed'
    )

    return txid
  }, [])

  const submitAll = useCallback(
    (txns: string[]) => {
      return Promise.all(txns.map(submit))
    },
    [submit]
  )

  const handleError = useCallback(
    (
      {
        success,
        errorMessage,
      }: {
        code: number
        success: boolean
        errorMessage?: string
        errors?: Array<any>
      },
      fallbackErrorMessage: string
    ) => {
      if (success) {
        return
      }

      throw new Error(errorMessage || fallbackErrorMessage)
    },
    []
  )

  const getMinFirmware = useCallback(async () => {
    const response = await onboardingClient.current.getFirmware()

    handleError(response, 'unable to get min firmware version')

    return response.data?.version || null
  }, [handleError])

  const getMakers = useCallback(async () => {
    const response = await onboardingClient.current.getMakers()

    handleError(response, 'unable to get makers')

    return response.data
  }, [handleError])

  const getOnboardingRecord = useCallback(
    async (hotspotAddress: string) => {
      const response = await onboardingClient.current.getOnboardingRecord(
        hotspotAddress
      )

      handleError(
        response,
        `unable to get onboarding record for ${hotspotAddress}`
      )

      return response.data
    },
    [handleError]
  )

  const postPaymentTransaction = useCallback(
    async (
      hotspotAddress: string,
      transaction: string,
      submitToSolana: boolean = true
    ) => {
      const response = await onboardingClient.current.postPaymentTransaction(
        hotspotAddress,
        transaction
      )

      handleError(
        response,
        `unable to post payment transaction for ${hotspotAddress}`
      )

      if (!response.data) {
        return null
      }

      if (response.data.solanaTransactions?.length && submitToSolana) {
        const solanaResponses = await submitAll(
          response.data.solanaTransactions
        )
        return {
          transaction: response.data.transaction,
          solanaResponses,
        }
      }

      return { transaction: response.data.transaction, solanaResponses: [] }
    },
    [handleError, submitAll]
  )

  const getSolHotspotInfo = useCallback(
    async ({
      iotMint,
      hotspotAddress,
      userSolPubKey,
    }: {
      iotMint: string
      hotspotAddress: string
      userSolPubKey: web3.PublicKey
    }) => {
      const program = await getHeliumEntityManagerProgram(userSolPubKey)

      const sdkey = subDaoKey(new web3.PublicKey(iotMint))[0]
      const hckey = hotspotConfigKey(sdkey, 'IOT')[0]
      const infoKey = iotInfoKey(hckey, hotspotAddress)[0]
      const info = await program.account.iotHotspotInfoV0.fetchNullable(infoKey)
      if (info) {
        return info as SolHotspot
      }
      return null
    },
    [getHeliumEntityManagerProgram]
  )

  const getHotspotForCurrentChain = useCallback(
    async ({
      hotspotAddress,
      solanaStatus,
      userSolPubKey,
      httpClient,
    }: {
      hotspotAddress: string
      solanaStatus?: SolanaStatus
      userSolPubKey: web3.PublicKey
      httpClient?: Client
    }) => {
      const client = httpClient || heliumHttpClient

      try {
        let solStatus = solanaStatus
        if (!solStatus) {
          solStatus = await getSolanaStatus()
        }

        if (solanaStatus === 'complete') {
          const {
            iot: { mint: iotMint },
          } = await getSolanaVars(solanaCluster)
          const hotspotInfo = await getSolHotspotInfo({
            iotMint,
            hotspotAddress,
            userSolPubKey,
          })
          return hotspotInfo
        }

        const hotspot = await client.hotspots.get(hotspotAddress)
        return hotspot
      } catch {
        return null
      }
    },
    [getSolHotspotInfo, solanaCluster]
  )

  const addGateway = useCallback(
    async ({
      hotspotAddress,
      transaction,
      userSolPubKey,
      httpClient,
    }: {
      hotspotAddress: string
      transaction: string
      userSolPubKey: web3.PublicKey
      httpClient?: Client
    }) => {
      const client = httpClient || heliumHttpClient

      const solanaStatus = await getSolanaStatus()
      if (solanaStatus === 'in_progress') {
        throw new Error('Chain transfer in progress')
      }

      const hotspotExists = !!(await getHotspotForCurrentChain({
        hotspotAddress,
        solanaStatus,
        userSolPubKey,
        httpClient: client,
      }))

      if (hotspotExists) {
        throw new Error('Hotspot already on chain')
      }

      let submitStatus: 'failure' | 'complete' | 'pending' = 'failure'

      const response = await postPaymentTransaction(hotspotAddress, transaction)
      if (!response) return null

      if (solanaStatus === 'complete') {
        submitStatus = 'complete'
      }

      let pendingTxn: null | PendingTransaction = null
      if (response?.transaction && solanaStatus === 'not_started') {
        pendingTxn = await client.transactions.submit(response.transaction)
        submitStatus = 'pending'
      }

      return { pendingTxn, ...response, solanaStatus, submitStatus }
    },
    [getHotspotForCurrentChain, postPaymentTransaction]
  )

  const hasFreeAssert = useCallback(
    async ({ hotspot }: { hotspot?: Hotspot | SolHotspot | null }) => {
      if (!hotspot) {
        // TODO: Is this right?
        // assume free as it hasn't been added the chain
        return true
      }
      let address = ''
      if (isSolHotspot(hotspot)) {
        // TODO: Is this right?
        if (!hotspot.isFullHotspot) return false

        address = hotspot.hotspotKey
      } else {
        // TODO: Is this right?
        if (hotspot.mode !== 'full') return false

        address = hotspot.address
      }

      const onboardingRecord = await getOnboardingRecord(address)
      if (!onboardingRecord) {
        throw new Error('Onboarding record not found')
      }

      if (hotspot && isSolHotspot(hotspot)) {
        return (
          onboardingRecord.maker.locationNonceLimit > hotspot.numLocationAsserts
        )
      }

      return (
        onboardingRecord.maker.locationNonceLimit >
        (hotspot?.speculativeNonce || 0)
      )
    },
    [getOnboardingRecord]
  )

  const assertLocation = useCallback(
    async ({
      gatewayAddress,
      transaction: originalTxn,
      isFree,
      httpClient,
    }: {
      gatewayAddress: string
      isFree?: boolean
      transaction: string
      httpClient?: Client
    }) => {
      const solanaStatus = await getSolanaStatus()
      if (solanaStatus === 'in_progress') {
        throw new Error('Chain transfer in progress')
      }

      let transaction = originalTxn
      const client = httpClient || heliumHttpClient

      let submitStatus: 'failure' | 'complete' | 'pending' = 'failure'

      if (isFree) {
        // if assert is free, need to post to onboarding server to have the txn re-signed
        const response = await postPaymentTransaction(
          gatewayAddress,
          transaction.toString(),
          false
        )
        if (!response?.transaction) {
          throw new Error('failed to fetch txn from onboarding server')
        }
        transaction = response.transaction
      }

      if (solanaStatus === 'complete') {
        submitStatus = 'complete'
      }

      let pendingTxn: null | PendingTransaction = null
      if (solanaStatus === 'not_started') {
        // submit to helium if transition not started
        submitStatus = 'pending'
        pendingTxn = await client.transactions.submit(transaction)
      }

      // submit to solana
      const solTxId = await submit(transaction)
      return { solTxId, pendingTxn, submitStatus, solanaStatus }
    },
    [postPaymentTransaction, submit]
  )

  return {
    addGateway,
    assertLocation,
    baseUrl,
    getHotspotForCurrentChain,
    getMakers,
    getMinFirmware,
    getOnboardingRecord,
    getSolHotspotInfo,
    hasFreeAssert,
    postPaymentTransaction,
    submitAllSolana: submitAll,
    submitSolana: submit,
  }
}

export default useOnboarding
