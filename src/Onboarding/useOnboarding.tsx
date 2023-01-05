import { useCallback, useRef } from 'react'
import OnboardingClient from '@helium/onboarding'
import * as web3 from '@solana/web3.js'
import { Buffer } from 'buffer'
import { sendAndConfirmWithRetry } from '@helium/spl-utils'
import { getSolanaStatus, heliumHttpClient } from '@helium/react-native-sdk'
import { Client, PendingTransaction } from '@helium/http'
import { getSolanaVars, SolanaStatus } from '../utils/solanaSentinel'
import { subDaoKey } from '@helium/helium-sub-daos-sdk'
import {
  hotspotConfigKey,
  init,
  iotInfoKey,
} from '@helium/helium-entity-manager-sdk'
import { AnchorProvider, Wallet } from '@project-serum/anchor'
import { SolHotspot } from './onboardingTypes'

const useOnboarding = (
  baseUrl?: string,
  solanaCluster?: 'mainnet-beta' | 'devnet' | 'testnet'
) => {
  const onboardingClient = useRef(new OnboardingClient(baseUrl))
  const solConnection = useRef(
    new web3.Connection(web3.clusterApiUrl(solanaCluster))
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
    async (hotspotAddress: string, transaction: string) => {
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

      if (response.data.solanaTransactions?.length) {
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
      const provider = new AnchorProvider(
        solConnection.current,
        {
          publicKey: userSolPubKey,
        } as Wallet,
        {}
      )

      const sdkey = subDaoKey(new web3.PublicKey(iotMint))[0]
      const hckey = hotspotConfigKey(sdkey, 'IOT')[0]
      const infoKey = iotInfoKey(hckey, hotspotAddress)[0]
      const hemProgram = await init(provider)
      const info = await hemProgram.account.iotHotspotInfoV0.fetchNullable(
        infoKey
      )
      if (info) {
        return info as SolHotspot
      }
      return null
    },
    []
  )

  const getHotspotOnChain = useCallback(
    async ({
      hotspotAddress,
      solanaStatus,
      userSolPubKey: userSolPubKey,
      httpClient,
    }: {
      hotspotAddress: string
      solanaStatus: SolanaStatus
      userSolPubKey: web3.PublicKey
      httpClient?: Client
    }) => {
      const client = httpClient || heliumHttpClient

      if (solanaStatus === 'complete') {
        const {
          mints: { iot },
        } = await getSolanaVars()
        const hotspotInfo = await getSolHotspotInfo({
          iotMint: iot,
          hotspotAddress,
          userSolPubKey,
        })
        return !!hotspotInfo
      }

      try {
        const hotspot = await client.hotspots.get(hotspotAddress)
        return !!hotspot
      } catch (e) {
        return false
      }
    },
    [getSolHotspotInfo]
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

      const hotspotExists = await getHotspotOnChain({
        hotspotAddress,
        solanaStatus,
        userSolPubKey,
        httpClient: client,
      })

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
    [getHotspotOnChain, postPaymentTransaction]
  )

  return {
    addGateway,
    baseUrl,
    getMinFirmware,
    getMakers,
    getOnboardingRecord,
    postPaymentTransaction,
    getSolHotspotInfo,
    getHotspotOnChain,
    submitSolana: submit,
    submitAllSolana: submitAll,
  }
}

export default useOnboarding
