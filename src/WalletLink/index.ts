import { Buffer } from 'buffer'
import queryString from 'query-string'

export type LinkWalletRequest = {
  requestAppId: string
}

export type LinkWalletResponse = {
  status: 'success' | 'user_cancelled'
  token?: string
}

export type SignHotspotRequest = {
  universalLink: string
  requestAppId: string
  token: string
  addGatewayTxn?: string
  assertLocationTxn?: string
}

export type SignHotspotResponse = {
  status: 'success' | 'token_not_found' | 'user_cancelled' | 'gateway_not_found'
  assertTxn?: string
  gatewayTxn?: string
}

export type MakerApp = {
  universalLink: string
  name: string
  androidPackage: string
  iosBundleId: string
}

const heliumStarter: MakerApp = {
  universalLink: 'makerappscheme://',
  name: 'Maker App',
  androidPackage: 'com.maker.makerapp',
  iosBundleId: 'com.maker.makerapp',
}

const makerApps = [heliumStarter]

const getMakerApp = (bundleId: string) =>
  makerApps.find(
    (a) => a.androidPackage === bundleId || a.iosBundleId === bundleId
  )

export type DelegateApp = {
  urlScheme: string
  universalLink: string
  name: string
  androidPackage: string
  iosBundleId: string
  appStoreId: number
}

const heliumHotspotApp: DelegateApp = {
  urlScheme: 'helium://',
  universalLink: 'https://helium.com/',
  name: 'helium-hotspot',
  androidPackage: 'com.helium.wallet',
  iosBundleId: 'com.helium.mobile.wallet',
  appStoreId: 1450463605,
}

const delegateApps = [heliumHotspotApp]

const createWalletLinkToken = ({
  time,
  address,
  requestAppId,
  signingAppId,
}: {
  time: number
  address: string
  requestAppId: string
  signingAppId: string
}) => {
  const token = `${address},${time},${requestAppId},${signingAppId}`
  const buff = Buffer.from(token, 'utf8')
  return buff.toString('base64')
}

const parseWalletLinkToken = (base64Token: string) => {
  const buff = Buffer.from(base64Token, 'base64')
  const token = buff.toString('utf-8')
  const pieces = token.split(',')
  if (pieces.length !== 4) return

  const [address, time, requestAppId, signingAppId] = pieces
  return { address, time, requestAppId, signingAppId }
}

const createWalletLinkUrl = (opts: {
  universalLink: string
  requestAppId: string
}) => {
  const { universalLink, ...params } = opts
  const query = queryString.stringify(params)

  return `${universalLink}link_wallet?${query}`
}
const createUpdateHotspotUrl = (opts: SignHotspotRequest) => {
  const { universalLink, ...params } = opts
  const query = queryString.stringify(params)
  return `${universalLink}sign_hotspot?${query}`
}

const createSignHotspotCallbackUrl = (
  makerAppLink: string,
  responseParams: SignHotspotResponse
) => `${makerAppLink}sign_hotspot?${queryString.stringify(responseParams)}`

const createLinkWalletCallbackUrl = (
  makerAppLink: string,
  address: string,
  responseParams: SignHotspotResponse
) =>
  `${makerAppLink}link_wallet/${address}?${queryString.stringify(
    responseParams
  )}`

export {
  delegateApps,
  makerApps,
  getMakerApp,
  createWalletLinkToken,
  parseWalletLinkToken,
  createWalletLinkUrl,
  createUpdateHotspotUrl,
  createSignHotspotCallbackUrl,
  createLinkWalletCallbackUrl,
}
