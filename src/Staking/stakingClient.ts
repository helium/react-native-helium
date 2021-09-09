export interface OnboardingRecord {
  id: number
  onboardingKey: string
  macWlan0: string
  rpiSerial: string
  batch: string
  publicAddress: string
  heliumSerial: string
  macEth0: string
  createdAt: string
  updatedAt: string
  makerId: number
  maker: {
    id: number
    name: string
    address: string
    locationNonceLimit: number
    createdAt: string
    updatedAt: string
  }
  code: number
  errorMessage: string
}

export interface Maker {
  id: number
  name: string
  address: string
  locationNonceLimit: number
  createdAt: string
  updatedAt: string
}

const STAKING_API_BASE_URL = 'https://onboarding.dewi.org/api/v2'

const makeRequest = async (url: string, opts: RequestInit = {}) => {
  const route = [STAKING_API_BASE_URL, url].join('/')

  const response = await fetch(route, {
    ...opts,
    headers: {
      ...opts.headers,
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json',
    },
  })
  const text = await response.text()
  try {
    const json = JSON.parse(text)
    return json.data || json
  } catch (err) {
    throw new Error(text)
  }
}

/**
 * Make a GET request to the Onboarding Server.
 * @param url
 */
export const getStaking = async (url: string) => makeRequest(url)

/**
 * Make a POST request to the Onboarding Server.
 * @param url
 * @param data
 */
export const postStaking = async (url: string, data: unknown) =>
  makeRequest(url, { method: 'POST', body: data ? JSON.stringify(data) : null })

/**
 * Get the onboarding record of a hotspot. If the hotspot is not asserted this requires the onboarding address.
 * After it is asserted it can be looked up by hotspot address.
 * @param address
 */
export const getOnboardingRecord = async (
  address: string
): Promise<OnboardingRecord> => {
  const onboardingRecord = await getStaking(`hotspots/${address}`)
  return onboardingRecord as OnboardingRecord
}

/**
 * Make a POST request to the Onboarding Server to sign a gateway transaction.
 * @param gateway
 * @param txn
 */
export const getStakingSignedTransaction = async (
  gateway: string,
  txn: string
) => {
  const { transaction } = await postStaking(`transactions/pay/${gateway}`, {
    transaction: txn,
  })
  return transaction as string
}

/**
 * Get the list of approved Hotspot makers from the Onboarding Server.
 */
export const getMakers = async (): Promise<Maker[]> => {
  return makeRequest('makers')
}

/**
 * Get the string name for an approved Maker from their b58 account address
 * @param accountAddress the b58 string address of the {@link Maker}
 * @param makers list of Makers from {@link getMakers}
 */
export const getMakerName = (accountAddress: string, makers?: Maker[]) => {
  if (!makers) return ''
  const makerMatchIndex = makers.findIndex(
    (m: { address: string }) => m.address === accountAddress
  )
  return makerMatchIndex !== -1 ? makers[makerMatchIndex].name : ''
}
