import { useCallback, useRef } from 'react'
import OnboardingClient from '@helium/onboarding'
import * as web3 from '@solana/web3.js'
import { Buffer } from 'buffer'
import { sendAndConfirmWithRetry } from '@helium/spl-utils'
import { Client, Hotspot, PendingTransaction } from '@helium/http'
import { useSolanaVars, useSolanaStatus } from '../utils/solanaSentinel'
import { subDaoKey } from '@helium/helium-sub-daos-sdk'
import {
  hotspotConfigKey,
  init,
  iotInfoKey,
} from '@helium/helium-entity-manager-sdk'
import { AnchorProvider, Wallet, Program } from '@project-serum/anchor'
import { SolHotspot } from './onboardingTypes'
import { HeliumEntityManager } from '@helium/idls/lib/types/helium_entity_manager'
import { heliumHttpClient } from '../utils/httpClient'

export const isSolHotspot = (
  hotspot: SolHotspot | Hotspot
): hotspot is SolHotspot => Object.keys(hotspot).includes('numLocationAsserts')

const useOnboarding = (
  baseUrl?: string,
  solanaCluster?: 'mainnet-beta' | 'devnet' | 'testnet'
) => {
  const { data: solanaStatus } = useSolanaStatus()
  const { data: solanaVars } = useSolanaVars(solanaCluster)
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

  const submitSolana = useCallback(async (txn: string) => {
    const { txid } = await sendAndConfirmWithRetry(
      solConnection.current,
      Buffer.from(txn),
      { skipPreflight: true },
      'confirmed'
    )

    return txid
  }, [])

  const submitAllSolana = useCallback(
    (txns: string[]) => {
      return Promise.all(txns.map(submitSolana))
    },
    [submitSolana]
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

  const getHeliumHotspotInfo = useCallback(
    async ({
      hotspotAddress,
      httpClient,
    }: {
      hotspotAddress: string
      httpClient?: Client
    }) => {
      const client = httpClient || heliumHttpClient
      try {
        return await client.hotspots.get(hotspotAddress)
      } catch {
        return null
      }
    },
    []
  )

  const getHotspotForCurrentChain = useCallback(
    async ({
      hotspotAddress,
      userSolPubKey,
      httpClient,
    }: {
      hotspotAddress: string
      userSolPubKey: web3.PublicKey
      httpClient?: Client
    }) => {
      const migrationStatus = solanaStatus?.migrationStatus
      if (migrationStatus === 'in_progress') {
        throw new Error('Chain migration in progress')
      }

      if (!solanaVars?.iot.mint) {
        throw new Error('Failed to fetch mint from solana vars')
      }

      if (migrationStatus === 'not_started') {
        return getHeliumHotspotInfo({ hotspotAddress, httpClient })
      }

      const hotspotInfo = await getSolHotspotInfo({
        iotMint: solanaVars.iot.mint,
        hotspotAddress,
        userSolPubKey,
      })
      return hotspotInfo
    },
    [getHeliumHotspotInfo, getSolHotspotInfo, solanaStatus, solanaVars]
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
    }): Promise<{
      solanaResponses?: string[]
      pendingTxn?: PendingTransaction
    }> => {
      const client = httpClient || heliumHttpClient
      const migrationStatus = solanaStatus?.migrationStatus

      if (migrationStatus === 'in_progress') {
        throw new Error('Chain transfer in progress')
      }

      const hotspotExists = !!(await getHotspotForCurrentChain({
        hotspotAddress,
        userSolPubKey,
        httpClient: client,
      }))

      if (hotspotExists) {
        throw new Error('Hotspot already on chain')
      }

      const onboardResponse =
        await onboardingClient.current.postPaymentTransaction(
          hotspotAddress,
          transaction
        )

      handleError(
        onboardResponse,
        `unable to post payment transaction for ${hotspotAddress}`
      )

      if (migrationStatus === 'not_started') {
        if (!onboardResponse.data?.transaction) {
          throw new Error('Onboarding server failure - txn missing')
        }
        const pendingTxn = await client.transactions.submit(
          onboardResponse.data?.transaction
        )
        return {
          pendingTxn,
        }
      }

      if (!onboardResponse.data?.solanaTransactions) {
        throw new Error('Onboarding server failure - sol txn missing')
      }

      const solanaResponses = await submitAllSolana(
        onboardResponse.data.solanaTransactions
      )

      return {
        solanaResponses,
      }
    },
    [
      getHotspotForCurrentChain,
      handleError,
      solanaStatus?.migrationStatus,
      submitAllSolana,
    ]
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
    }): Promise<{ solTxId?: string; pendingTxn?: PendingTransaction }> => {
      const migrationStatus = solanaStatus?.migrationStatus
      if (migrationStatus === 'in_progress') {
        throw new Error('Chain transfer in progress')
      }

      let transaction = originalTxn
      const client = httpClient || heliumHttpClient

      if (isFree) {
        const onboardResponse =
          await onboardingClient.current.postPaymentTransaction(
            gatewayAddress,
            transaction
          )

        handleError(
          onboardResponse,
          `unable to post payment transaction for ${gatewayAddress}`
        )

        if (!onboardResponse?.data?.transaction) {
          throw new Error('failed to fetch txn from onboarding server')
        }
        transaction = onboardResponse.data?.transaction
      }

      if (migrationStatus === 'not_started') {
        const pendingTxn = await client.transactions.submit(transaction)
        return {
          pendingTxn,
        }
      }

      // submit to solana

      const solTxId = await submitSolana(transaction)
      return {
        solTxId,
      }
    },
    [handleError, solanaStatus?.migrationStatus, submitSolana]
  )

  const transferHotspot = useCallback(
    async ({
      transaction,
      httpClient,
    }: {
      transaction: string
      httpClient?: Client
    }): Promise<{ solTxId?: string; pendingTxn?: PendingTransaction }> => {
      const migrationStatus = solanaStatus?.migrationStatus
      if (migrationStatus === 'in_progress') {
        throw new Error('Chain transfer in progress')
      }

      const client = httpClient || heliumHttpClient

      if (migrationStatus === 'not_started') {
        // submit to helium if transition not started
        const pendingTxn = await client.transactions.submit(transaction)
        return {
          pendingTxn,
        }
      }

      // submit to solana
      const solTxId = await submitSolana(transaction)
      return {
        solTxId,
      }
    },
    [solanaStatus, submitSolana]
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
    submitAllSolana,
    submitSolana,
    transferHotspot,
  }
}

export default useOnboarding
