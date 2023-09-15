import React, {
  createContext,
  ReactNode,
  useContext,
  useCallback,
  useRef,
  useState,
} from 'react'
import OnboardingClient, {
  OnboardingRecord,
  HotspotType,
} from '@helium/onboarding'
import * as web3 from '@solana/web3.js'
import {
  AlreadyOnboardedError,
  AssertData,
  CreateHotspotExistsError,
} from './onboardingTypes'
import { heliumAddressToSolAddress } from '../Account/account'
import { getH3Location } from '../utils/assertLocation'
import Balance, {
  CurrencyType,
  DataCredits,
  NetworkTokens,
  SolTokens,
  TestNetworkTokens,
  USDollars,
} from '@helium/currency'
import { Buffer } from 'buffer'
import BN from 'bn.js'
import { useSolanaContext } from '../Solana/SolanaProvider'
import {
  getAsset,
  heliumAddressToSolPublicKey,
  HNT_MINT,
  IOT_MINT,
  MOBILE_MINT,
  DC_MINT,
  toBN,
} from '@helium/spl-utils'
import {
  iotInfoKey,
  keyToAssetKey,
  mobileInfoKey,
  rewardableEntityConfigKey,
} from '@helium/helium-entity-manager-sdk'
import { daoKey, subDaoKey } from '@helium/helium-sub-daos-sdk'
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { AddGatewayV1 } from '@helium/transactions'
import { without } from 'lodash'

export const TXN_FEE_IN_LAMPORTS = 5000
export const TXN_FEE_IN_SOL = TXN_FEE_IN_LAMPORTS / web3.LAMPORTS_PER_SOL
export const FULL_LOCATION_STAKING_FEE = 500000

const useOnboardingHook = ({ baseUrl }: { baseUrl: string }) => {
  const solana = useSolanaContext()

  const [onboardingClient] = useState(
    new OnboardingClient(`${baseUrl}${'/v3'}`)
  )

  const onboardingRecords = useRef<Record<string, OnboardingRecord>>({})

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
      const prevRecord = onboardingRecords.current[hotspotAddress]
      if (prevRecord) {
        return prevRecord
      }

      try {
        const response = await onboardingClient.getOnboardingRecord(
          hotspotAddress
        )

        if (String(response) === 'Too many requests, please try again later.') {
          console.error('Failed to get onboarding record. Rate limited.')
          return null
        }

        handleError(
          response,
          `unable to get onboarding record for ${hotspotAddress}`
        )

        if (response.data) {
          onboardingRecords.current[hotspotAddress] = response.data
        }
        return response.data
      } catch (e) {
        console.error(e)
      }
      return null
    },
    [handleError, onboardingClient]
  )

  const burnHNTForDataCredits = useCallback(
    async (dcAmount: number) => {
      if (!solana.provider || !solana.connection) {
        throw new Error('Missing Solana Provider or Connection')
      }
      const destinationWallet = solana.provider.wallet.publicKey

      const txn = await solana.dcProgram?.methods
        .mintDataCreditsV0({
          hntAmount: null,
          dcAmount: toBN(dcAmount, 0),
        })
        .preInstructions([
          createAssociatedTokenAccountIdempotentInstruction(
            destinationWallet,
            getAssociatedTokenAddressSync(DC_MINT, destinationWallet, true),
            destinationWallet,
            DC_MINT
          ),
        ])
        .accounts({
          dcMint: DC_MINT,
          recipient: destinationWallet,
        })
        .transaction()

      if (!txn) return

      let blockhash = (await solana.connection.getLatestBlockhash('finalized'))
        .blockhash
      txn.recentBlockhash = blockhash
      txn.feePayer = destinationWallet

      return txn
    },
    [solana.connection, solana.dcProgram?.methods, solana.provider]
  )

  const getKeyToAsset = useCallback(
    async (hotspotAddress: string) => {
      const [dao] = daoKey(HNT_MINT)
      const [keyToAssetK] = keyToAssetKey(dao, hotspotAddress)
      const keyToAssetAcc =
        await solana.hemProgram?.account.keyToAssetV0.fetchNullable(keyToAssetK)

      return keyToAssetAcc?.asset
    },
    [solana.hemProgram?.account.keyToAssetV0]
  )

  const createHotspot = useCallback(
    async (signedTxn: string) => {
      const gatewayTxn = AddGatewayV1.fromString(signedTxn)

      const address = gatewayTxn.gateway?.b58
      if (!address) {
        throw Error('Invalid add gateway txn')
      }

      let hotspotPubKey: web3.PublicKey | undefined
      try {
        hotspotPubKey = await getKeyToAsset(address)
      } catch {}

      if (hotspotPubKey) {
        throw CreateHotspotExistsError
      }

      const createTxns = await onboardingClient.createHotspot({
        transaction: signedTxn.toString(),
      })

      const txns = createTxns.data?.solanaTransactions?.flatMap((t) => [
        Buffer.from(t),
      ])

      if (!txns?.length) {
        console.error(createTxns)
        throw new Error('Failed to generate createHotspot txn(s)')
      }

      return solana.submitAllSolana({
        txns,
      })
    },
    [getKeyToAsset, onboardingClient, solana]
  )

  const getOnboardTransactions = useCallback(
    async ({
      hotspotAddress,
      networkDetails,
    }: {
      hotspotAddress: string
      networkDetails: {
        hotspotType: HotspotType
        lat?: number
        lng?: number
        decimalGain?: number
        elevation?: number
      }[]
    }): Promise<{
      solanaTransactions?: string[]
    }> => {
      const onboardResponses = await Promise.all(
        networkDetails.map(
          async ({ hotspotType: type, lat, lng, decimalGain, elevation }) => {
            const gain = decimalGain
              ? Math.round(decimalGain * 10.0)
              : undefined

            let location: string | undefined
            if (lat && lng && lat !== 0 && lng !== 0) {
              location = new BN(getH3Location(lat, lng), 'hex').toString()
            }
            const details = await solana.getHotspotDetails({
              address: hotspotAddress,
              type,
            })
            if (details) return undefined

            const txn = await onboardingClient.onboard({
              hotspotAddress,
              type,
              gain,
              elevation,
              location,
            })
            return txn
          }
        )
      )

      const filtered = without(onboardResponses, undefined)

      if (filtered.length === 0) {
        throw AlreadyOnboardedError
      }

      const error = onboardResponses?.find((or) => or?.errorMessage)
      if (error) {
        throw new Error(error.errorMessage)
      }

      const onboardTxns = onboardResponses
        .flatMap((r) => r?.data?.solanaTransactions || [])
        .map((tx) => Buffer.from(tx).toString('base64'))

      if (!onboardTxns?.length) {
        throw new Error('failed to create solana onboard txns')
      }

      return { solanaTransactions: onboardTxns }
    },
    [onboardingClient, solana]
  )

  const getBalances = useCallback(async () => {
    const solBalance = await solana.getSolBalance()

    // GET hnt Balance from solana
    const hntBalance = await solana.getHntBalance()
    const dcBalance = await solana.getDcBalance()

    return {
      hnt: Balance.fromIntAndTicker(Number(hntBalance), 'HNT'),
      dc: new Balance(Number(dcBalance || 0), CurrencyType.dataCredit),
      sol: new Balance(solBalance, CurrencyType.solTokens),
    }
  }, [solana])

  const getOraclePrice = useCallback(async (): Promise<Balance<USDollars>> => {
    const hntPrice = await solana.getOraclePriceFromSolana({
      tokenType: 'HNT',
    })

    if (!hntPrice?.aggregate.price) {
      throw new Error('Failed to fetch oracle price')
    }

    return Balance.fromFloat(hntPrice?.aggregate.price, CurrencyType.usd)
  }, [solana])

  const getAtaAccountCreationFee = useCallback(
    async (solanaAddress: string) => {
      if (!solana.connection) throw new Error('Connection is missing')

      const ataAddress = getAssociatedTokenAddressSync(
        DC_MINT,
        new web3.PublicKey(solanaAddress),
        true
      )

      try {
        await getAccount(solana.connection, ataAddress)
        return new Balance(0, CurrencyType.solTokens)
      } catch {
        return Balance.fromFloat(0.00203928, CurrencyType.solTokens)
      }
    },
    [solana.connection]
  )

  const getStakingFeeForType = useCallback(
    async (type: 'IOT' | 'MOBILE') => {
      const isIOT = type === 'IOT'
      const mint = isIOT ? IOT_MINT : MOBILE_MINT
      const subDao = subDaoKey(mint)[0]

      const configKey = rewardableEntityConfigKey(subDao, type)

      const entityConfig =
        await solana.hemProgram?.account.rewardableEntityConfigV0.fetchNullable(
          configKey[0]
        )
      const config = isIOT
        ? entityConfig?.settings.iotConfig
        : entityConfig?.settings.mobileConfig

      // @ts-ignore
      const configFee = config?.fullLocationStakingFee as BN
      if (configFee) {
        return toBN(configFee, 0).toNumber()
      }
      return FULL_LOCATION_STAKING_FEE
    },
    [solana.hemProgram]
  )

  const getSolanaAssertData = useCallback(
    async ({
      gateway,
      balances,
      onboardingRecord,
      oraclePrice,
      owner,
      networkDetails,
    }: {
      gateway: string
      owner: string
      networkDetails: {
        hotspotType: HotspotType
        gain: number
        elevation: number
        nextLocation: string
      }[]
      onboardingRecord: OnboardingRecord
      oraclePrice: Balance<USDollars>
      balances: {
        hnt: Balance<NetworkTokens | TestNetworkTokens> | undefined
        sol: Balance<SolTokens>
        dc: Balance<DataCredits> | undefined
      }
    }): Promise<AssertData> => {
      let solanaTransactions: Buffer[] | undefined

      const maker = onboardingRecord.maker

      const solanaAddress = heliumAddressToSolAddress(owner)

      const solResponses = await Promise.all(
        networkDetails.map(({ elevation, gain, nextLocation, hotspotType }) => {
          const location = new BN(nextLocation, 'hex').toString()
          return onboardingClient.updateMetadata({
            type: hotspotType,
            solanaAddress,
            hotspotAddress: gateway,
            location,
            elevation,
            gain,
          })
        })
      )

      solanaTransactions = solResponses
        .flatMap((r) => r.data?.solanaTransactions || [])
        .map((txn) => Buffer.from(txn))

      const makerKey = heliumAddressToSolPublicKey(maker.address)

      let simulatedFees: (
        | {
            makerFees: {
              lamports: number
              dc: number
            }
            ownerFees: {
              lamports: number
              dc: number
            }
            isFree: boolean
          }
        | undefined
      )[]
      try {
        simulatedFees = await Promise.all(
          solanaTransactions.map((t) =>
            solana.estimateMetaTxnFees(t, { maker: makerKey })
          )
        )
      } catch (e: any) {
        if (!e.message.includes('Transaction would fail')) {
          throw e
        }
        simulatedFees = await Promise.all(
          networkDetails.map(async ({ hotspotType: type, nextLocation }) => {
            const mint = type === 'IOT' ? IOT_MINT : MOBILE_MINT
            const subDao = subDaoKey(mint)[0]

            const configKey = rewardableEntityConfigKey(
              subDao,
              type.toUpperCase()
            )

            let prevLocation: BN | null | undefined
            if (type === 'IOT') {
              const [info] = iotInfoKey(configKey[0], gateway)
              const iot =
                await solana.hemProgram?.account.iotHotspotInfoV0.fetch(info)
              prevLocation = iot?.location
            } else {
              const [info] = mobileInfoKey(configKey[0], gateway)
              const mobile =
                await solana.hemProgram?.account.mobileHotspotInfoV0.fetch(info)
              prevLocation = mobile?.location
            }

            let locationChanged = true

            if (nextLocation && prevLocation) {
              locationChanged = !prevLocation.eq(new BN(nextLocation, 'hex'))
            }

            let dcFee = 0
            if (locationChanged) {
              dcFee = await getStakingFeeForType(type)
            }

            return {
              makerFees: {
                lamports: 0,
                dc: 0,
              },
              ownerFees: {
                lamports: TXN_FEE_IN_LAMPORTS,
                dc: dcFee,
              },
              isFree: false,
            }
          })
        )
      }

      const fees = simulatedFees.reduce(
        (acc, current) => {
          if (!current) return acc

          const makerSolFee = Balance.fromIntAndTicker(
            current.makerFees.lamports,
            'SOL'
          )
          const ownerSolFee = Balance.fromIntAndTicker(
            current.ownerFees.lamports,
            'SOL'
          )

          const makerDcFee = new Balance(
            current.makerFees.dc,
            CurrencyType.dataCredit
          )
          const ownerDcFee = new Balance(
            current.ownerFees.dc,
            CurrencyType.dataCredit
          )

          return {
            makerFees: {
              sol: acc.makerFees.sol.plus(makerSolFee),
              dc: acc.makerFees.dc.plus(makerDcFee),
            },
            ownerFees: {
              sol: acc.ownerFees.sol.plus(ownerSolFee),
              dc: acc.ownerFees.dc.plus(ownerDcFee),
            },
          }
        },
        {
          makerFees: {
            sol: new Balance(0, CurrencyType.solTokens),
            dc: new Balance(0, CurrencyType.dataCredit),
          },
          ownerFees: {
            sol: new Balance(0, CurrencyType.solTokens),
            dc: new Balance(0, CurrencyType.dataCredit),
          },
        }
      )
      const isFree =
        fees.ownerFees.dc.integerBalance <= 0 &&
        fees.ownerFees.sol.integerBalance <= 0

      if (!isFree) {
        const ataFee = await getAtaAccountCreationFee(solanaAddress)
        fees.ownerFees.sol = fees.ownerFees.sol.plus(ataFee)
      }

      let hasSufficientSol =
        balances.sol.integerBalance >= fees.ownerFees.sol.integerBalance
      const hasSufficientDc =
        (balances.dc?.integerBalance || 0) >= fees.ownerFees.dc.integerBalance

      let dcNeeded: Balance<DataCredits> | undefined
      let hasSufficientHnt = true
      if (!hasSufficientDc) {
        const dcFee = fees.ownerFees.dc
        const dcBalance = balances.dc || new Balance(0, CurrencyType.dataCredit)
        dcNeeded = dcFee.minus(dcBalance)
        const hntNeeded = dcNeeded.toNetworkTokens(oraclePrice)
        hasSufficientHnt =
          (balances.hnt?.integerBalance || 0) >= hntNeeded.integerBalance

        if (hasSufficientHnt) {
          const txn = await burnHNTForDataCredits(dcNeeded.integerBalance)
          if (txn) {
            solanaTransactions = [
              txn.serialize({ verifySignatures: false }),
              ...solanaTransactions,
            ]
            fees.ownerFees.sol = fees.ownerFees.sol.plus(
              Balance.fromIntAndTicker(TXN_FEE_IN_LAMPORTS, 'SOL')
            )

            hasSufficientSol =
              balances.sol.integerBalance >= fees.ownerFees.sol.integerBalance
          }
        }
      }
      const hasSufficientBalance =
        (hasSufficientDc || hasSufficientHnt) && hasSufficientSol

      return {
        balances,
        hasSufficientBalance,
        hasSufficientSol,
        hasSufficientDc,
        hasSufficientHnt,
        dcNeeded,
        ...fees,
        isFree,
        maker,
        payer: isFree ? maker.address : owner,
        solanaTransactions: solanaTransactions.map((tx) =>
          tx.toString('base64')
        ),
        oraclePrice,
      } as AssertData
    },
    [
      burnHNTForDataCredits,
      getAtaAccountCreationFee,
      getStakingFeeForType,
      onboardingClient,
      solana,
    ]
  )

  const getAssertData = useCallback(
    async ({
      gateway,
      owner,
      networkDetails,
      onboardingRecord: paramsOnboardRecord,
    }: {
      gateway: string
      owner: string
      decimalGain?: number
      networkDetails: {
        hotspotType: HotspotType
        decimalGain?: number
        elevation?: number
        lat: number
        lng: number
      }[]
      onboardingRecord?: OnboardingRecord | null
    }): Promise<AssertData> => {
      let record = paramsOnboardRecord || (await getOnboardingRecord(gateway))

      if (!record) {
        throw new Error('Onboarding record not found')
      }

      const onboardingRecord = record

      const balances = await getBalances()
      const oraclePrice = await getOraclePrice()

      const details = networkDetails.map(
        ({ hotspotType, decimalGain, elevation, lat, lng }) => {
          const nextLocation = getH3Location(lat, lng)
          const gain = Math.round((decimalGain || 1.2) * 10.0)

          return { hotspotType, nextLocation, gain, elevation: elevation || 0 }
        }
      )

      return getSolanaAssertData({
        balances,
        gateway,
        onboardingRecord,
        oraclePrice,
        owner,
        networkDetails: details,
      })
    },
    [getOnboardingRecord, getBalances, getOraclePrice, getSolanaAssertData]
  )

  const createTransferTransaction = useCallback(
    async ({
      hotspotAddress,
      newOwnerAddress,
    }: {
      hotspotAddress: string
      newOwnerAddress: string
    }): Promise<{
      solanaTransactions?: string[] | undefined
    }> => {
      if (!solana.connection) {
        throw new Error('No solana connection')
      }

      let hotspotPubKey: web3.PublicKey | undefined
      try {
        hotspotPubKey = await getKeyToAsset(hotspotAddress)
      } catch (e) {
        throw Error('Hotspot asset not found - ' + String(e))
      }

      if (!hotspotPubKey) {
        throw new Error('Hotspot asset not found')
      }

      const hotspot = await getAsset(
        solana.connection.rpcEndpoint,
        hotspotPubKey
      )

      if (!hotspot) {
        throw new Error('Hotspot not found for user')
      }

      const txn = await solana.createTransferCompressedCollectableTxn({
        newOwnerSolanaOrHeliumAddresss: newOwnerAddress,
        collectable: hotspot,
      })
      if (!txn) {
        throw new Error('Failed to create transfer transaction')
      }
      return {
        solanaTransactions: [Buffer.from(txn.serialize()).toString('base64')],
      }
    },
    [getKeyToAsset, solana]
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
    }: {
      solanaTransactions?: string[]
    }): Promise<{
      solanaTxnIds?: string[]
    }> => {
      if (!solanaTransactions?.length) {
        throw new Error('No txns to submit')
      }

      const solanaTxnIds = await submitSolanaTransactions({
        solanaTransactions: solanaTransactions,
      })
      return { solanaTxnIds }
    },

    [submitSolanaTransactions]
  )

  const getHotspots = useCallback(
    async ({
      heliumAddress,
      makerName,
    }: {
      heliumAddress: string
      makerName?: string
    }) => {
      const solHotspots = await solana.getHotspots({
        heliumAddress,
        makerName,
      })

      return solHotspots
    },
    [solana]
  )

  return {
    baseUrl,
    burnHNTForDataCredits,
    createHotspot,
    createTransferTransaction,
    getAssertData,
    getHotspots,
    getKeyToAsset,
    getMinFirmware,
    getOnboardingRecord,
    getOnboardTransactions,
    getOraclePrice,
    onboardingClient,
    submitTransactions,
  }
}

export type OnboardingManager = ReturnType<typeof useOnboardingHook>

const OnboardingContext = createContext<OnboardingManager | null>(null)
const { Provider } = OnboardingContext

const OnboardingProvider = ({
  children,
  baseUrl,
}: {
  children: ReactNode
  baseUrl: string
}) => {
  return <Provider value={useOnboardingHook({ baseUrl })}>{children}</Provider>
}

export const useOnboarding = (): OnboardingManager => {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboarding has to be used within <OnboardingProvider>')
  }
  return context
}

export default OnboardingProvider
