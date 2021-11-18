import { Buffer } from 'buffer'
import queryString from 'query-string'

export type LinkWalletRequest = {
  requestAppId: string
  callbackUrl: string
  appName: string
}

export type LinkWalletResponse = {
  status: 'success' | 'user_cancelled'
  token?: string
}

export type SignHotspotRequest = {
  universalLink: string
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
  callbackUrl,
  appName,
}: LinkWalletRequest & {
  time: number
  address: string
  signingAppId: string
}) => {
  const token = `${address},${time},${requestAppId},${signingAppId},${callbackUrl},${appName}`
  const buff = Buffer.from(token, 'utf8')
  return buff.toString('base64')
}

const parseWalletLinkToken = (base64Token: string) => {
  const buff = Buffer.from(base64Token, 'base64')
  const token = buff.toString('utf-8')
  const pieces = token.split(',')
  if (pieces.length !== 6) return

  const [address, time, requestAppId, signingAppId, callbackUrl, appName] =
    pieces
  return { address, time, requestAppId, signingAppId, callbackUrl, appName }
}

const createWalletLinkUrl = (
  opts: LinkWalletRequest & {
    universalLink: string
  }
) => {
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
  createWalletLinkToken,
  parseWalletLinkToken,
  createWalletLinkUrl,
  createUpdateHotspotUrl,
  createSignHotspotCallbackUrl,
  createLinkWalletCallbackUrl,
}
