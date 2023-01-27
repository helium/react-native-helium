import { useCallback, useRef } from 'react'
import OnboardingClient, {
  OnboardingRecord,
  HotspotType,
} from '@helium/onboarding'
import * as web3 from '@solana/web3.js'
import { Client, Hotspot, PendingTransaction } from '@helium/http'
import { AssertData } from './onboardingTypes'
import { heliumHttpClient } from '../utils/httpClient'
import { heliumAddressToSolAddress, SodiumKeyPair } from '../Account/account'
import {
  createLocationTxn,
  getH3Location,
  getStakingFee,
} from '../utils/assertLocation'
import Balance, { CurrencyType, USDollars } from '@helium/currency'
import * as Transfer from '../utils/transferHotspot'
import { Buffer } from 'buffer'
import { BN } from 'bn.js'
import { useSolanaContext } from '../Solana/SolanaProvider'
import { SolHotspot } from '@helium/hotspot-utils'
import { isSolHotspot } from '../utils/isSolHotspot'

export const TXN_FEE_IN_LAMPORTS = 5000
export const TXN_FEE_IN_SOL = TXN_FEE_IN_LAMPORTS / web3.LAMPORTS_PER_SOL

const useOnboarding = ({ baseUrl }: { baseUrl: string }) => {
  const onboardingClient = useRef(new OnboardingClient(baseUrl))
  const solana = useSolanaContext()

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
      try {
        const response = await onboardingClient.current.getOnboardingRecord(
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
    [handleError]
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
    }): Promise<{ addGatewayTxn?: string; solanaTransactions?: Buffer[] }> => {
      // TODO: check solana status, check if hotspot exists

      if (solana.status.isHelium) {
        return { addGatewayTxn: txn }
      }

      const createTxns = await onboardingClient.current.createHotspot({
        transaction: txn,
      })

      await solana.submitAllSolana({
        txns: (createTxns.data?.solanaTransactions || []).map((t) =>
          Buffer.from(t)
        ),
      })

      const gain = decimalGain ? Math.round(decimalGain * 10.0) : undefined

      let location: string | undefined
      if (lat && lng && lat !== 0 && lng !== 0) {
        location = new BN(getH3Location(lat, lng), 'hex').toString()
      }

      const promises = hotspotTypes.map((type) =>
        onboardingClient.current.onboard({
          hotspotAddress,
          type,
          gain,
          elevation,
          location,
        })
      )

      const solResponses = await Promise.all(promises)
      const solanaTransactions = solResponses
        .flatMap((r) => r.data?.solanaTransactions || [])
        .map((tx) => Buffer.from(tx))

      if (!solanaTransactions?.length) {
        throw new Error('failed to create solana onboard txns')
      }

      return { solanaTransactions }
    },
    [solana]
  )

  const submitAddGateway = useCallback(
    async ({
      hotspotAddress,
      addGatewayTxn,
      solanaTransactions,
      httpClient,
    }: {
      hotspotAddress: string
      addGatewayTxn?: string
      solanaTransactions?: Buffer[]
      httpClient?: Client
    }): Promise<{
      solanaTxnIds?: string[]
      pendingTxn?: PendingTransaction
    }> => {
      checkSolanaStatus()

      const client = httpClient || heliumHttpClient

      if (solana.status.isHelium) {
        if (!addGatewayTxn) {
          throw new Error('Transaction is missing')
        }
        // If L1 is helium, must submit to onboard server for payer signature
        const onboardResponse =
          await onboardingClient.current.postPaymentTransaction(
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
        const pendingTxn = await client.transactions.submit(
          onboardResponse.data?.transaction
        )
        return {
          pendingTxn,
        }
      }

      if (!solanaTransactions?.length) {
        throw new Error('No solana transactions to submit')
      }

      const solanaTxnIds = await solana.submitAllSolana({
        txns: solanaTransactions,
      })

      return {
        solanaTxnIds,
      }
    },
    [checkSolanaStatus, handleError, solana]
  )

  const hasFreeAssert = useCallback(
    ({
      hotspot,
      onboardingRecord: paramsOnboardRecord,
    }: {
      hotspot?: Hotspot | SolHotspot | null
      onboardingRecord: OnboardingRecord | null
    }) => {
      if (!hotspot) {
        // TODO: Is this right?
        // assume free as it hasn't been added the chain
        return true
      }
      let onboardingRecord: OnboardingRecord | null | undefined =
        paramsOnboardRecord
      if (isSolHotspot(hotspot)) {
        // TODO: Is this right?
        if (!hotspot.isFullHotspot) return false
      } else {
        // TODO: Is this right?
        if (hotspot.mode !== 'full') return false
      }

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
        const hntAmount = await solana.getHeliumBalance({
          mint: solana.vars?.hnt.mint,
        })

        return {
          hnt: new Balance(hntAmount || 0, CurrencyType.networkToken),
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

      return Balance.fromFloat(hntPrice, CurrencyType.usd)
    },
    [checkSolanaStatus, solana]
  )
  const locationInfo = useCallback(
    ({
      lat,
      lng,
      hotspot,
      onboardingRecord,
    }: {
      lat: number
      lng: number
      hotspot?: Hotspot | SolHotspot | null
      onboardingRecord: OnboardingRecord
    }) => {
      const nextLocation = getH3Location(lat, lng)
      let updatingLocation = !hotspot
      if (hotspot) {
        if (!isSolHotspot(hotspot)) {
          updatingLocation = hotspot.location !== nextLocation
        } else if (hotspot.location) {
          // TODO: Not sure if this is correct
          const loc = hotspot.location.toString('hex')
          updatingLocation = loc !== nextLocation
        }
      }
      const isFree =
        hasFreeAssert({ hotspot, onboardingRecord }) || !updatingLocation
      return { updatingLocation, nextLocation, isFree }
    },
    [hasFreeAssert]
  )

  const getAssertData = useCallback(
    async ({
      gateway,
      owner,
      lat,
      lng,
      decimalGain = 1.2,
      elevation = 0,
      ownerKeypairRaw,
      httpClient,
      dataOnly,
      hotspotTypes,
      onboardingRecord: paramsOnboardRecord,
      createSolanaTransactions = true,
    }: {
      gateway: string
      owner: string
      lat: number
      lng: number
      decimalGain?: number
      elevation?: number
      ownerKeypairRaw?: SodiumKeyPair
      httpClient?: Client
      dataOnly?: boolean
      hotspotTypes: HotspotType[]
      onboardingRecord?: OnboardingRecord | null
      createSolanaTransactions?: boolean
    }): Promise<AssertData> => {
      checkSolanaStatus()

      const client = httpClient || heliumHttpClient

      let record = paramsOnboardRecord || (await getOnboardingRecord(gateway))

      if (!record) {
        throw new Error('Onboarding record not found')
      }

      const onboardingRecord = record

      const balances = await getBalances({ heliumAddress: owner, httpClient })
      let hasSufficientBalance = true

      const oraclePrice = await getOraclePrice(client)

      const gain = Math.round(decimalGain * 10.0)

      if (solana.status.isHelium) {
        const hotspot = await getHeliumHotspotInfo({
          hotspotAddress: gateway,
          httpClient,
        })

        const { isFree, nextLocation, updatingLocation } = locationInfo({
          hotspot,
          onboardingRecord,
          lat,
          lng,
        })

        const maker = onboardingRecord.maker
        const payer = isFree ? maker.address : owner

        const transaction = await createLocationTxn({
          gateway,
          owner,
          gain,
          elevation,
          ownerKeypairRaw,
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
        const totalStakingAmountUsd = totalStakingAmountDC.toUsd(oraclePrice)
        // if not free and we're still on helium the user needs hnt for fee and staking fee
        hasSufficientBalance = isFree
          ? true
          : (balances.hnt?.integerBalance || 0) >=
            totalStakingAmountHnt.integerBalance

        return {
          balances,
          hasSufficientBalance,
          hotspot,
          isFree,
          heliumFee: {
            dc: totalStakingAmountDC,
            hnt: totalStakingAmountHnt,
            usd: totalStakingAmountUsd,
          },
          solFee: new Balance(0, CurrencyType.solTokens),
          assertLocationTxn: txnStr,
          payer,
          maker,
        }
      }

      const hotspotInfos = await Promise.all(
        hotspotTypes.map(async (t) => {
          const hotspot = await solana.getSolHotspotInfo({
            hotspotAddress: gateway,
            symbol: t,
          })
          const { isFree, nextLocation, updatingLocation } = locationInfo({
            lat,
            lng,
            onboardingRecord,
            hotspot,
          })
          const stakingFee = getStakingFee({ dataOnly, updatingLocation })
          const totalStakingAmountDC = new Balance(
            stakingFee,
            CurrencyType.dataCredit
          )

          const solFee = new Balance(TXN_FEE_IN_SOL, CurrencyType.solTokens)
          return {
            hotspot,
            totalStakingAmountDC,
            solFee,
            isFree,
            nextLocation,
          }
        })
      )

      const { isFree, totalStakingAmountDC, solFee, nextLocation } =
        hotspotInfos.reduce(
          (acc, curr) => {
            return {
              isFree: acc.isFree || curr.isFree,
              totalStakingAmountDC: acc.totalStakingAmountDC.plus(
                curr.totalStakingAmountDC
              ),
              solFee: acc.solFee.plus(curr.solFee),
              nextLocation: acc.nextLocation || curr.nextLocation,
            }
          },
          {
            isFree: false,
            totalStakingAmountDC: new Balance(0, CurrencyType.dataCredit),
            solFee: new Balance(0, CurrencyType.solTokens),
            nextLocation: '',
          }
        )

      const totalStakingAmountHnt =
        totalStakingAmountDC.toNetworkTokens(oraclePrice)
      const totalStakingAmountUsd = totalStakingAmountDC.toUsd(oraclePrice)

      if (isFree) {
        hasSufficientBalance = true
      } else {
        const hasSufficientSol =
          balances.sol.integerBalance >= solFee.integerBalance
        const hasSufficientHnt =
          (balances.hnt?.integerBalance || 0) >=
          totalStakingAmountHnt.integerBalance
        hasSufficientBalance = hasSufficientHnt && hasSufficientSol
      }

      let solanaTransactions: Buffer[] | undefined

      if (createSolanaTransactions) {
        const solanaAddress = heliumAddressToSolAddress(owner)
        const location = new BN(nextLocation, 'hex').toString()

        const promises = hotspotTypes.map((type) =>
          onboardingClient.current.updateMetadata({
            type,
            solanaAddress,
            hotspotAddress: gateway,
            location,
            elevation,
            gain,
          })
        )
        const solResponses = await Promise.all(promises)
        solanaTransactions = solResponses
          .flatMap((r) => r.data?.solanaTransactions || [])
          .map((txn) => Buffer.from(txn))
      }
      const maker = onboardingRecord.maker
      const payer = isFree ? maker.address : owner
      return {
        balances,
        hasSufficientBalance,
        hotspot: null,
        isFree,
        heliumFee: {
          dc: totalStakingAmountDC,
          hnt: totalStakingAmountHnt,
          usd: totalStakingAmountUsd,
        },
        solFee,
        solanaTransactions,
        payer,
        maker,
      }
    },
    [
      checkSolanaStatus,
      getOnboardingRecord,
      getBalances,
      getOraclePrice,
      solana,
      getHeliumHotspotInfo,
      locationInfo,
    ]
  )

  const submitAssertLocation = useCallback(
    async ({
      assertLocationTxn,
      solanaTransactions,
      httpClient,
      gateway,
    }: {
      assertLocationTxn?: string
      solanaTransactions?: Buffer[]
      httpClient?: Client
      gateway: string
    }): Promise<{
      solanaTxnIds?: string[]
      pendingTxn?: PendingTransaction
    }> => {
      checkSolanaStatus()

      const client = httpClient || heliumHttpClient

      if (assertLocationTxn) {
        let txnStr = assertLocationTxn

        const hotspot = await getHeliumHotspotInfo({
          hotspotAddress: gateway,
          httpClient,
        })

        const onboardingRecord = await getOnboardingRecord(gateway)
        const isFree = hasFreeAssert({ hotspot, onboardingRecord })
        if (isFree) {
          // If L1 is helium and txn is free, must submit to onboard server for payer signature
          const onboardResponse =
            await onboardingClient.current.postPaymentTransaction(
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
        const pendingTxn = await client.transactions.submit(txnStr)
        return {
          pendingTxn,
        }
      }

      if (!solanaTransactions?.length) {
        throw new Error('No solana transactions to submit')
      }

      const solanaTxnIds = await solana.submitAllSolana({
        txns: solanaTransactions,
      })
      return {
        solanaTxnIds,
      }
    },
    [
      checkSolanaStatus,
      solana,
      getHeliumHotspotInfo,
      getOnboardingRecord,
      hasFreeAssert,
      handleError,
    ]
  )

  const submitTransferHotspot = useCallback(
    async ({
      transferHotspotTxn,
      solanaTransaction,
      httpClient,
    }: {
      transferHotspotTxn?: string
      solanaTransaction?: Buffer
      httpClient?: Client
    }): Promise<{ solTxId?: string; pendingTxn?: PendingTransaction }> => {
      if (!transferHotspotTxn && !solanaTransaction) {
        throw new Error('No txn found')
      }

      const client = httpClient || heliumHttpClient

      if (transferHotspotTxn) {
        // submit to helium if transition not started
        const pendingTxn = await client.transactions.submit(transferHotspotTxn)
        return {
          pendingTxn,
        }
      }

      // submit to solana
      const solTxId = await solana.submitSolana({
        txn: solanaTransaction!,
      })
      return {
        solTxId,
      }
    },
    [solana]
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
      solanaTransaction?: Buffer | undefined
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

      // TODO: Page until you find it?
      const hotspots = await solana.getHotspots({
        oldestCollectable: '',
      })

      const hotspot = hotspots.find((h) => {
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
      return { solanaTransaction: Buffer.from(txn.serialize()) }
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

  return {
    baseUrl,
    createTransferTransaction,
    getAssertData,
    getMakers,
    getMinFirmware,
    getOnboardingRecord,
    getOnboardTransactions,
    getOraclePrice,
    hasFreeAssert,
    submitAddGateway,
    submitSolanaTransactions,
    submitAssertLocation,
    submitTransferHotspot,
  }
}

export default useOnboarding
