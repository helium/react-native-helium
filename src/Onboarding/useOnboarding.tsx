import { useCallback, useEffect, useRef, useState } from 'react'
import OnboardingClient, {
  OnboardingRecord,
  HotspotType,
} from '@helium/onboarding'
import * as web3 from '@solana/web3.js'
import { Client, Hotspot, PendingTransaction } from '@helium/http'
import { AssertData, CreateHotspotExistsError } from './onboardingTypes'
import { heliumHttpClient } from '../utils/httpClient'
import { heliumAddressToSolAddress, SodiumKeyPair } from '../Account/account'
import {
  createLocationTxn,
  getH3Location,
  getStakingFee,
} from '../utils/assertLocation'
import Balance, {
  CurrencyType,
  DataCredits,
  NetworkTokens,
  SolTokens,
  TestNetworkTokens,
  USDollars,
} from '@helium/currency'
import * as Transfer from '../utils/transferHotspot'
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
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { AddGatewayV1, AssertLocationV2 } from '@helium/transactions'
import { HotspotMeta } from '../Solana/useSolana'

export const TXN_FEE_IN_LAMPORTS = 5000
export const TXN_FEE_IN_SOL = TXN_FEE_IN_LAMPORTS / web3.LAMPORTS_PER_SOL
export const FULL_LOCATION_STAKING_FEE = 1000000

const useOnboarding = ({ baseUrl }: { baseUrl: string }) => {
  const solana = useSolanaContext()
  const url = useRef('')

  const [onboardingClient, setOnboardingClient] = useState(
    new OnboardingClient('')
  )

  const getSolanaStatus = useCallback(async () => {
    const status = await solana.getStatus()
    if (status?.inProgress) {
      throw new Error('Chain migration in progress')
    }
    return status
  }, [solana])

  useEffect(() => {
    getSolanaStatus().then((status) => {
      const nextUrl = `${baseUrl}${status?.isHelium ? '/v2' : '/v3'}`
      if (nextUrl === url.current) return

      url.current = nextUrl
      setOnboardingClient(new OnboardingClient(nextUrl))
    })
  }, [baseUrl, getSolanaStatus])

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
      } catch (e) {
        console.error(e)
      }
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

  const burnHNTForDataCredits = useCallback(
    async (dcAmount: number) => {
      const status = await getSolanaStatus()
      if (status?.isHelium || !solana.provider || !solana.connection) {
        throw new Error('Helium not supported for this action')
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
    [
      getSolanaStatus,
      solana.connection,
      solana.dcProgram?.methods,
      solana.provider,
    ]
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
      const status = await getSolanaStatus()
      if (!status?.isSolana) return

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

      return solana.submitAllSolana({
        txns: (createTxns.data?.solanaTransactions || []).map((t) =>
          Buffer.from(t)
        ),
      })
    },
    [getKeyToAsset, getSolanaStatus, onboardingClient, solana]
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
      httpClient,
    }: {
      txn: string
      hotspotAddress: string
      hotspotTypes: HotspotType[]
      lat?: number
      lng?: number
      decimalGain?: number
      elevation?: number
      httpClient?: Client
    }): Promise<{
      addGatewayTxn?: string
      assertLocationTxn?: string
      solanaTransactions?: string[]
    }> => {
      const status = await getSolanaStatus()

      const gain = decimalGain ? Math.round(decimalGain * 10.0) : undefined

      if (status?.isHelium) {
        const hotspot = await getHeliumHotspotInfo({
          hotspotAddress,
          httpClient,
        })
        let assertLocationTxn: string | undefined
        if (lat && lng) {
          const addGatewayTxn = AddGatewayV1.fromString(txn)

          let nextNonce = (hotspot?.speculativeNonce || 0) + 1

          const stakingFee = getStakingFee({
            dataOnly: false,
            updatingLocation: true,
          })

          const locTxn = new AssertLocationV2({
            owner: addGatewayTxn.owner,
            gateway: addGatewayTxn.gateway,
            payer: addGatewayTxn.payer,
            nonce: nextNonce,
            gain,
            elevation,
            location: getH3Location(lat, lng),
            stakingFee,
          })

          assertLocationTxn = locTxn.toString()
        }

        return { addGatewayTxn: txn, assertLocationTxn }
      }

      let location: string | undefined
      if (lat && lng && lat !== 0 && lng !== 0) {
        location = new BN(getH3Location(lat, lng), 'hex').toString()
      }

      const onboardResponses = await Promise.all(
        hotspotTypes.map(async (type) =>
          onboardingClient.onboard({
            hotspotAddress,
            type,
            gain,
            elevation,
            location,
          })
        )
      )
      const error = onboardResponses?.find((or) => or.errorMessage)
      if (error) {
        throw new Error(error.errorMessage)
      }

      const onboardTxns = onboardResponses
        .flatMap((r) => r.data?.solanaTransactions || [])
        .map((tx) => Buffer.from(tx).toString('base64'))

      if (!onboardTxns?.length) {
        throw new Error('failed to create solana onboard txns')
      }

      return { solanaTransactions: onboardTxns }
    },
    [getHeliumHotspotInfo, getSolanaStatus, onboardingClient]
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
      const status = await getSolanaStatus()

      const solBalance = await solana.getSolBalance()

      if (status?.isSolana) {
        // GET hnt Balance from solana
        const hntBalance = await solana.getHntBalance()
        const dcBalance = await solana.getDcBalance()

        return {
          hnt: Balance.fromIntAndTicker(Number(hntBalance), 'HNT'),
          dc: new Balance(Number(dcBalance || 0), CurrencyType.dataCredit),
          sol: new Balance(solBalance, CurrencyType.solTokens),
        }
      } else {
        // GET hnt balance from helium
        const client = httpClient || heliumHttpClient
        const heliumBalances = await client.accounts.get(heliumAddress)
        return {
          dc: heliumBalances.dcBalance,
          hnt: heliumBalances.balance,
          sol: new Balance(solBalance, CurrencyType.solTokens),
        }
      }
    },
    [getSolanaStatus, solana]
  )

  const getOraclePrice = useCallback(
    async (httpClient?: Client): Promise<Balance<USDollars>> => {
      const status = await getSolanaStatus()

      const client = httpClient || heliumHttpClient
      if (status?.isHelium) {
        const oraclePrice = await client.oracle.getCurrentPrice()
        if (!oraclePrice.price) {
          throw new Error('Failed to fetch oracle price from helium blockchain')
        }
        return oraclePrice.price
      }

      const hntPrice = await solana.getOraclePriceFromSolana({
        tokenType: 'HNT',
      })

      if (!hntPrice?.aggregate.price) {
        throw new Error('Failed to fetch oracle price')
      }

      return Balance.fromFloat(hntPrice?.aggregate.price, CurrencyType.usd)
    },
    [getSolanaStatus, solana]
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
        dc: Balance<DataCredits> | undefined
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

      const fees = {
        dc: totalStakingAmountDC,
      }

      return {
        balances,
        hasSufficientBalance,
        hasSufficientHnt: hasSufficientBalance,
        isFree,
        makerFees: isFree ? fees : undefined,
        ownerFees: isFree ? undefined : fees,
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
        dc: Balance<DataCredits> | undefined
      }
    }): Promise<AssertData> => {
      let solanaTransactions: Buffer[] | undefined

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
          hotspotTypes.map(async (type) => {
            const mint = type === 'IOT' ? IOT_MINT : MOBILE_MINT
            const subDao = subDaoKey(mint)[0]

            const configKey = rewardableEntityConfigKey(
              subDao,
              type.toUpperCase()
            )

            const entityConfig =
              await solana.hemProgram?.account.rewardableEntityConfigV0.fetchNullable(
                configKey[0]
              )
            const config =
              type === 'IOT'
                ? entityConfig?.settings.iotConfig
                : entityConfig?.settings.mobileConfig

            let prevLocation: BN | null | undefined
            if (type === 'IOT') {
              const [info] = iotInfoKey(configKey[0], gateway)
              const iot =
                await solana.hemProgram?.account.iotHotspotInfoV0.fetch(info)
              prevLocation = iot?.location
            } else {
              const [info] = await mobileInfoKey(configKey[0], gateway)
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
              dcFee = toBN(
                config?.full_location_staking_fee || FULL_LOCATION_STAKING_FEE,
                0
              ).toNumber()
            }

            return {
              makerFees: {
                lamports: 0,
                dc: 0,
              },
              ownerFees: {
                lamports: 5000,
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
    [burnHNTForDataCredits, onboardingClient, solana]
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
      const status = await getSolanaStatus()

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

      if (status?.isHelium) {
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
      getSolanaStatus,
      getOnboardingRecord,
      getBalances,
      getOraclePrice,
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
      getSolanaStatus()

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
      getSolanaStatus,
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
      solanaTransactions?: string[] | undefined
    }> => {
      const status = await getSolanaStatus()

      const client = httpClient || heliumHttpClient

      if (status?.isHelium) {
        const txn = await Transfer.createTransferTransaction({
          hotspotAddress,
          userAddress,
          newOwnerAddress,
          client,
          ownerKeypairRaw,
        })
        return { transferHotspotTxn: txn.toString() }
      }

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
    [getSolanaStatus, getKeyToAsset, solana]
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
      const status = await getSolanaStatus()
      if (solanaTransactions?.length) {
        if (!status?.isSolana) {
          throw new Error('Solana transactions not yet supported')
        }
        const solanaTxnIds = await submitSolanaTransactions({
          solanaTransactions: solanaTransactions,
        })
        return { solanaTxnIds }
      }

      if (!status?.isHelium) {
        throw new Error('Helium transactions no longer supported')
      }

      const response = {} as {
        pendingTransferTxn?: PendingTransaction
        pendingAssertTxn?: PendingTransaction
        pendingGatewayTxn?: PendingTransaction
      }

      if (addGatewayTxn) {
        response.pendingGatewayTxn = await submitAddGateway({
          hotspotAddress,
          addGatewayTxn,
          httpClient,
        })
      }

      if (assertLocationTxn) {
        response.pendingAssertTxn = await submitAssertLocation({
          assertLocationTxn,
          httpClient,
          gateway: hotspotAddress,
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
      getSolanaStatus,
      submitAddGateway,
      submitAssertLocation,
      submitSolanaTransactions,
      submitTransferHotspot,
    ]
  )

  const getHotspots = useCallback(
    async ({
      httpClient,
      heliumAddress,
      makerName,
    }: {
      heliumAddress: string
      httpClient?: Client
      makerName?: string
    }) => {
      const status = await getSolanaStatus()

      const client = httpClient || heliumHttpClient

      if (status?.isHelium) {
        const newHotspotList = await client
          .account(heliumAddress)
          .hotspots.list()
        return newHotspotList.takeJSON(100000)
      }

      const solHotspots = await solana.getHotspots({
        heliumAddress,
        makerName,
      })

      return solHotspots
    },
    [getSolanaStatus, solana]
  )

  const getHotspotDetails = useCallback(
    async ({
      httpClient,
      address,
      type,
    }: {
      httpClient?: Client
      address: string
      type?: 'MOBILE' | 'IOT'
    }): Promise<HotspotMeta | undefined> => {
      const status = await getSolanaStatus()

      const client = httpClient || heliumHttpClient

      if (status?.isHelium) {
        const hotspot = await client.hotspots.get(address)
        return {
          ...hotspot,
          isFullHotspot: hotspot.mode === 'full',
          numLocationAsserts: hotspot.speculativeNonce || hotspot.nonce || 0,
        }
      }

      if (!type) {
        throw new Error('Network type must be specified (IOT | MOBILE)')
      }

      return solana.getHotspotDetails({ address, type })
    },
    [getSolanaStatus, solana]
  )

  return {
    baseUrl,
    burnHNTForDataCredits,
    createHotspot,
    createTransferTransaction,
    getAssertData,
    getHotspotDetails,
    getHotspots,
    getMinFirmware,
    getOnboardingRecord,
    getOnboardTransactions,
    getOraclePrice,
    onboardingClient,
    submitTransactions,
  }
}

export default useOnboarding
