import { useCallback, useEffect, useState } from 'react'
import OnboardingClient, {
  OnboardingRecord,
  HotspotType,
} from '@helium/onboarding'
import * as web3 from '@solana/web3.js'
import { Client, Hotspot, PendingTransaction } from '@helium/http'
import { AssertData } from './onboardingTypes'
import { heliumHttpClient } from '../utils/httpClient'
import { heliumAddressToSolAddress, SodiumKeyPair } from '../Account/account'
import { createLocationTxn, getH3Location } from '../utils/assertLocation'
import Balance, {
  CurrencyType,
  NetworkTokens,
  SolTokens,
  TestNetworkTokens,
  USDollars,
} from '@helium/currency'
import * as Transfer from '../utils/transferHotspot'
import { Buffer } from 'buffer'
import { BN } from 'bn.js'
import { useSolanaContext } from '../Solana/SolanaProvider'
import { heliumAddressToSolPublicKey } from '@helium/spl-utils'

export const TXN_FEE_IN_LAMPORTS = 5000
export const TXN_FEE_IN_SOL = TXN_FEE_IN_LAMPORTS / web3.LAMPORTS_PER_SOL

const useOnboarding = ({ baseUrl }: { baseUrl: string }) => {
  const solana = useSolanaContext()
  const [onboardingClient, setOnboardingClient] = useState(
    new OnboardingClient(`${baseUrl}${solana.status.isHelium ? '/v2' : '/v3'}`)
  )

  useEffect(() => {
    setOnboardingClient(
      new OnboardingClient(
        `${baseUrl}${solana.status.isHelium ? '/v2' : '/v3'}`
      )
    )
  }, [baseUrl, solana.status.isHelium])

  const checkSolanaStatus = useCallback(() => {
    if (solana.status.inProgress) {
      throw new Error('Chain migration in progress')
    }
  }, [solana.status.inProgress])

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
    const response = await onboardingClient.getFirmware()

    handleError(response, 'unable to get min firmware version')

    return response.data?.version || null
  }, [handleError, onboardingClient])

  const getOnboardingRecord = useCallback(
    async (hotspotAddress: string) => {
      try {
        const response = await onboardingClient.getOnboardingRecord(
          hotspotAddress
        )

        handleError(
          response,
          `unable to get onboarding record for ${hotspotAddress}`
        )

        return response.data
      } catch {}
      return null
    },
    [handleError, onboardingClient]
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

  const getOnboardTransactions = useCallback(
    async ({
      txn,
      hotspotAddress,
      hotspotTypes,
      lat,
      lng,
      decimalGain,
      elevation,
    }: {
      txn: string
      hotspotAddress: string
      hotspotTypes: HotspotType[]
      lat?: number
      lng?: number
      decimalGain?: number
      elevation?: number
    }): Promise<{ addGatewayTxn?: string; solanaTransactions?: string[] }> => {
      if (solana.status.isHelium) {
        return { addGatewayTxn: txn }
      }

      const gain = decimalGain ? Math.round(decimalGain * 10.0) : undefined

      let location: string | undefined
      if (lat && lng && lat !== 0 && lng !== 0) {
        location = new BN(getH3Location(lat, lng), 'hex').toString()
      }

      const solResponses = await Promise.all(
        hotspotTypes.map(async (type) => {
          const onboardResponse = await onboardingClient.onboard({
            hotspotAddress,
            type,
            gain,
            elevation,
            location,
          })
          console.log({ onboardResponse })
          return onboardResponse
        })
      )

      const solanaTransactions = solResponses
        .flatMap((r) => r.data?.solanaTransactions || [])
        .map((tx) => Buffer.from(tx).toString('base64'))

      if (!solanaTransactions?.length) {
        throw new Error('failed to create solana onboard txns')
      }

      return { solanaTransactions }
    },
    [onboardingClient, solana.status.isHelium]
  )

  const submitAddGateway = useCallback(
    async ({
      hotspotAddress,
      addGatewayTxn,
      httpClient,
    }: {
      hotspotAddress: string
      addGatewayTxn: string
      httpClient?: Client
    }): Promise<PendingTransaction | undefined> => {
      const client = httpClient || heliumHttpClient

      if (!addGatewayTxn) {
        throw new Error('Transaction is missing')
      }
      // If L1 is helium, must submit to onboard server for payer signature
      const onboardResponse = await onboardingClient.postPaymentTransaction(
        hotspotAddress,
        addGatewayTxn
      )
      handleError(
        onboardResponse,
        `unable to post payment transaction for ${hotspotAddress}`
      )
      if (!onboardResponse.data?.transaction) {
        throw new Error('Onboarding server failure - txn missing')
      }

      // txn is now payerSignature is now signed by the maker, time to submit
      return client.transactions.submit(onboardResponse.data?.transaction)
    },
    [handleError, onboardingClient]
  )

  const hasFreeAssert = useCallback(
    ({
      hotspot,
      onboardingRecord: paramsOnboardRecord,
    }: {
      hotspot?: Hotspot | null
      onboardingRecord: OnboardingRecord | null
    }) => {
      if (!hotspot) {
        // assume free as it hasn't been added the chain
        return true
      }
      let onboardingRecord: OnboardingRecord | null | undefined =
        paramsOnboardRecord
      if (hotspot.mode !== 'full') return false

      if (!onboardingRecord) {
        throw new Error('Onboarding record not found')
      }

      return (
        onboardingRecord.maker.locationNonceLimit >
        (hotspot?.speculativeNonce || 0)
      )
    },
    []
  )

  const getBalances = useCallback(
    async ({
      heliumAddress,
      httpClient,
    }: {
      heliumAddress: string
      httpClient?: Client
    }) => {
      checkSolanaStatus()

      const solBalance = await solana.getSolBalance()

      if (solana.status.isSolana) {
        // GET hnt Balance from solana
        if (!solana.vars?.hnt.mint) {
          throw new Error('Hnt mint not found')
        }
        const balance = await solana.getHntBalance()

        return {
          hnt: Balance.fromIntAndTicker(Number(balance), 'HNT'),
          sol: new Balance(solBalance, CurrencyType.solTokens),
        }
      } else {
        // GET hnt balance from helium
        const client = httpClient || heliumHttpClient
        const heliumBalances = await client.accounts.get(heliumAddress)
        return {
          hnt: heliumBalances.balance,
          sol: new Balance(solBalance, CurrencyType.solTokens),
        }
      }
    },
    [checkSolanaStatus, solana]
  )

  const getOraclePrice = useCallback(
    async (httpClient?: Client): Promise<Balance<USDollars>> => {
      checkSolanaStatus()

      const client = httpClient || heliumHttpClient
      if (solana.status.isHelium) {
        const oraclePrice = await client.oracle.getCurrentPrice()
        if (!oraclePrice.price) {
          throw new Error('Failed to fetch oracle price from helium blockchain')
        }
        return oraclePrice.price
      }

      const hntPrice = await solana.getOraclePriceFromSolana({
        tokenType: 'HNT',
      })

      if (!hntPrice?.price) {
        throw new Error('Failed to fetch oracle price')
      }

      return Balance.fromFloat(hntPrice.price, CurrencyType.usd)
    },
    [checkSolanaStatus, solana]
  )

  const getHeliumAssertData = useCallback(
    async ({
      balances,
      dataOnly,
      elevation,
      gain,
      gateway,
      httpClient,
      nextLocation,
      onboardingRecord,
      oraclePrice,
      owner,
    }: {
      gateway: string
      owner: string
      gain?: number
      elevation?: number
      httpClient?: Client
      dataOnly?: boolean
      onboardingRecord: OnboardingRecord
      oraclePrice: Balance<USDollars>
      nextLocation: string
      balances: {
        hnt: Balance<NetworkTokens | TestNetworkTokens> | undefined
        sol: Balance<SolTokens>
      }
    }): Promise<AssertData> => {
      const hotspot = await getHeliumHotspotInfo({
        hotspotAddress: gateway,
        httpClient,
      })

      let updatingLocation = !hotspot
      if (hotspot) {
        updatingLocation = hotspot.location !== nextLocation
      }
      const isFree =
        hasFreeAssert({ hotspot, onboardingRecord }) || !updatingLocation

      const maker = onboardingRecord.maker
      const payer = isFree ? maker.address : owner

      const transaction = await createLocationTxn({
        gateway,
        owner,
        gain,
        elevation,
        maker: onboardingRecord.maker.address,
        hotspot,
        isFree,
        dataOnly,
        nextLocation,
        updatingLocation,
      })
      let txnStr = transaction.toString()
      const totalStakingAmountDC = new Balance(
        (transaction.stakingFee || 0) + (transaction.fee || 0),
        CurrencyType.dataCredit
      )
      let totalStakingAmountHnt =
        totalStakingAmountDC.toNetworkTokens(oraclePrice)
      // if not free and we're still on helium the user needs hnt for fee and staking fee
      const hasSufficientBalance = isFree
        ? true
        : (balances.hnt?.integerBalance || 0) >=
          totalStakingAmountHnt.integerBalance

      return {
        balances,
        hasSufficientBalance,
        isFree,
        fees: {
          dc: totalStakingAmountDC,
        },
        oraclePrice,
        assertLocationTxn: txnStr,
        payer,
        maker,
      }
    },
    [getHeliumHotspotInfo, hasFreeAssert]
  )
  const getSolanaAssertData = useCallback(
    async ({
      balances,
      elevation,
      gain,
      gateway,
      nextLocation,
      onboardingRecord,
      oraclePrice,
      owner,
      hotspotTypes,
    }: {
      gateway: string
      owner: string
      gain: number
      elevation: number
      onboardingRecord: OnboardingRecord
      oraclePrice: Balance<USDollars>
      nextLocation: string
      hotspotTypes: HotspotType[]
      balances: {
        hnt: Balance<NetworkTokens | TestNetworkTokens> | undefined
        sol: Balance<SolTokens>
      }
    }) => {
      let solanaTransactions: Buffer[] | undefined

      let hasSufficientBalance = true
      const maker = onboardingRecord.maker

      const solanaAddress = heliumAddressToSolAddress(owner)
      const location = new BN(nextLocation, 'hex').toString()

      const solResponses = await Promise.all(
        hotspotTypes.map((type) =>
          onboardingClient.updateMetadata({
            type,
            solanaAddress,
            hotspotAddress: gateway,
            location,
            elevation,
            gain,
          })
        )
      )

      solanaTransactions = solResponses
        .flatMap((r) => r.data?.solanaTransactions || [])
        .map((txn) => Buffer.from(txn))

      const makerKey = heliumAddressToSolPublicKey(maker.address)

      const simulated = await Promise.all(
        solanaTransactions.map((t) =>
          solana.simulateTxn(t, { maker: makerKey })
        )
      )
      console.log({ simulated })

      ///////////////////////////////////////////////////////////////////////////
      // TODO: Set all these based on simulated txn
      let payer = maker.address
      let isFree = true
      let solFee = new Balance(0, CurrencyType.solTokens)
      let totalStakingAmountDC = new Balance(0, CurrencyType.dataCredit)
      // const txns = solanaTransactions.map(web3.Transaction.from)
      ///////////////////////////////////////////////////////////////////////////

      return {
        balances,
        hasSufficientBalance,
        fees: {
          dc: totalStakingAmountDC,
          sol: solFee,
        },
        isFree,
        maker,
        payer,
        solanaTransactions: solanaTransactions.map((tx) =>
          tx.toString('base64')
        ),
        oraclePrice,
      }
    },
    [onboardingClient, solana]
  )

  const getAssertData = useCallback(
    async ({
      gateway,
      owner,
      lat,
      lng,
      decimalGain = 1.2,
      elevation = 0,
      httpClient,
      dataOnly,
      hotspotTypes,
      onboardingRecord: paramsOnboardRecord,
    }: {
      gateway: string
      owner: string
      lat: number
      lng: number
      decimalGain?: number
      elevation?: number
      httpClient?: Client
      dataOnly?: boolean
      hotspotTypes: HotspotType[]
      onboardingRecord?: OnboardingRecord | null
    }): Promise<AssertData> => {
      checkSolanaStatus()

      const client = httpClient || heliumHttpClient

      let record = paramsOnboardRecord || (await getOnboardingRecord(gateway))

      if (!record) {
        throw new Error('Onboarding record not found')
      }

      const onboardingRecord = record

      const nextLocation = getH3Location(lat, lng)

      const balances = await getBalances({ heliumAddress: owner, httpClient })
      const oraclePrice = await getOraclePrice(client)

      const gain = Math.round(decimalGain * 10.0)

      if (solana.status.isHelium) {
        return getHeliumAssertData({
          balances,
          dataOnly,
          elevation,
          gain,
          gateway,
          httpClient,
          nextLocation,
          onboardingRecord,
          oraclePrice,
          owner,
        })
      }

      return getSolanaAssertData({
        balances,
        elevation,
        gain,
        gateway,
        nextLocation,
        onboardingRecord,
        oraclePrice,
        owner,
        hotspotTypes,
      })
    },
    [
      checkSolanaStatus,
      getOnboardingRecord,
      getBalances,
      getOraclePrice,
      solana.status.isHelium,
      getSolanaAssertData,
      getHeliumAssertData,
    ]
  )

  const submitAssertLocation = useCallback(
    async ({
      assertLocationTxn,
      httpClient,
      gateway,
    }: {
      assertLocationTxn: string
      httpClient?: Client
      gateway: string
    }): Promise<PendingTransaction | undefined> => {
      checkSolanaStatus()

      const client = httpClient || heliumHttpClient

      let txnStr = assertLocationTxn

      const hotspot = await getHeliumHotspotInfo({
        hotspotAddress: gateway,
        httpClient,
      })

      const onboardingRecord = await getOnboardingRecord(gateway)
      const isFree = hasFreeAssert({ hotspot, onboardingRecord })
      if (isFree) {
        // If L1 is helium and txn is free, must submit to onboard server for payer signature
        const onboardResponse = await onboardingClient.postPaymentTransaction(
          gateway,
          assertLocationTxn.toString()
        )

        handleError(
          onboardResponse,
          `unable to post payment transaction for ${gateway}`
        )

        if (!onboardResponse?.data?.transaction) {
          throw new Error('failed to fetch txn from onboarding server')
        }
        txnStr = onboardResponse.data?.transaction
      }
      return client.transactions.submit(txnStr)
    },
    [
      checkSolanaStatus,
      getHeliumHotspotInfo,
      getOnboardingRecord,
      hasFreeAssert,
      onboardingClient,
      handleError,
    ]
  )

  const submitTransferHotspot = useCallback(
    async ({
      transferHotspotTxn,
      httpClient,
    }: {
      transferHotspotTxn: string
      httpClient?: Client
    }): Promise<PendingTransaction | undefined> => {
      const client = httpClient || heliumHttpClient
      return client.transactions.submit(transferHotspotTxn)
    },
    []
  )

  const createTransferTransaction = useCallback(
    async ({
      hotspotAddress,
      userAddress,
      newOwnerAddress,
      ownerKeypairRaw,
      httpClient,
    }: {
      hotspotAddress: string
      userAddress: string
      newOwnerAddress: string
      ownerKeypairRaw?: SodiumKeyPair
      httpClient?: Client
    }): Promise<{
      transferHotspotTxn?: string | undefined
      solanaTransaction?: string | undefined
    }> => {
      checkSolanaStatus()

      const client = httpClient || heliumHttpClient

      if (solana.status.isHelium) {
        const txn = await Transfer.createTransferTransaction({
          hotspotAddress,
          userAddress,
          newOwnerAddress,
          client,
          ownerKeypairRaw,
        })
        return { transferHotspotTxn: txn.toString() }
      }

      // TODO: Add paging
      const hotspots = await solana.getHotspots({ page: 0 })

      const hotspot = hotspots?.find((h) => {
        const addy = h.content.json_uri.split('/').slice(-1)[0]
        return addy === hotspotAddress
      })

      if (!hotspot) {
        throw new Error('Hotspot not found for user')
      }

      const txn = await solana.createTransferCompressedCollectableTxn({
        newOwnerHeliumAddress: newOwnerAddress,
        collectable: hotspot,
      })
      if (!txn) {
        throw new Error('Failed to create transfer transaction')
      }
      return {
        solanaTransaction: Buffer.from(txn.serialize()).toString('base64'),
      }
    },
    [checkSolanaStatus, solana]
  )

  const submitSolanaTransactions = useCallback(
    async ({
      solanaTransactions,
      encoding = 'base64',
    }: {
      solanaTransactions: string[]
      encoding?: BufferEncoding
    }) => {
      return solana.submitAllSolana({
        txns: solanaTransactions.map((txn) => Buffer.from(txn, encoding)),
      })
    },
    [solana]
  )

  const submitTransactions = useCallback(
    async ({
      solanaTransactions,
      hotspotAddress,
      addGatewayTxn,
      httpClient,
      transferHotspotTxn,
      assertLocationTxn,
    }: {
      solanaTransactions?: string[]
      hotspotAddress: string
      addGatewayTxn?: string
      httpClient?: Client
      transferHotspotTxn?: string
      assertLocationTxn?: string
    }): Promise<{
      pendingTransferTxn?: PendingTransaction
      pendingAssertTxn?: PendingTransaction
      pendingGatewayTxn?: PendingTransaction
      solanaTxnIds?: string[]
    }> => {
      if (solanaTransactions?.length) {
        if (!solana.status.isSolana) {
          throw new Error('Solana transactions not yet supported')
        }
        const solanaTxnIds = await submitSolanaTransactions({
          solanaTransactions: solanaTransactions,
        })
        return { solanaTxnIds }
      }

      if (!solana.status.isHelium) {
        throw new Error('Helium transactions no longer supported')
      }

      const response = {} as {
        pendingTransferTxn?: PendingTransaction
        pendingAssertTxn?: PendingTransaction
        pendingGatewayTxn?: PendingTransaction
      }

      if (assertLocationTxn) {
        response.pendingAssertTxn = await submitAssertLocation({
          assertLocationTxn,
          httpClient,
          gateway: hotspotAddress,
        })
      }

      if (addGatewayTxn) {
        response.pendingGatewayTxn = await submitAddGateway({
          hotspotAddress,
          addGatewayTxn,
          httpClient,
        })
      }

      if (transferHotspotTxn) {
        response.pendingTransferTxn = await submitTransferHotspot({
          transferHotspotTxn,
          httpClient,
        })
      }

      return response
    },
    [
      solana,
      submitAddGateway,
      submitAssertLocation,
      submitSolanaTransactions,
      submitTransferHotspot,
    ]
  )

  return {
    baseUrl,
    createTransferTransaction,
    getAssertData,
    getMinFirmware,
    getOnboardingRecord,
    getOnboardTransactions,
    getOraclePrice,
    onboardingClient,
    submitTransactions,
  }
}

export default useOnboarding
