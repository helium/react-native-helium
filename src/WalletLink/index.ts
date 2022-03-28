/** [[include:WalletLink.md]]
 * @packageDocumentation
 * @module WalletLink
 */

import { Buffer } from 'buffer'
import queryString from 'query-string'
import { Platform } from 'react-native'

export type LinkWalletRequest = {
  requestAppId: string
  callbackUrl: string
  appName: string
}

export type Token = {
  requestAppId: string
  callbackUrl: string
  appName: string
  signingAppId: string
  time: number
  address: string
  signature: string
}

export type LinkWalletResponse = {
  status: 'success' | 'user_cancelled'
  token?: string
}

export type SignHotspotRequest = {
  token: string
  addGatewayTxn?: string
  assertLocationTxn?: string
  transferHotspotTxn?: string
}

export type SignHotspotResponse = {
  status:
    | 'success'
    | 'token_not_found'
    | 'user_cancelled'
    | 'gateway_not_found'
    | 'invalid_link'
  assertTxn?: string
  gatewayTxn?: string
  transferTxn?: string
  gatewayAddress?: string
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

/**
 * A list of known apps that support signing transactions
 */
export const delegateApps = [heliumHotspotApp]

/**
 * Parse a wallet link token
 */
export const parseWalletLinkToken = (base64Token: string) => {
  const buff = Buffer.from(base64Token, 'base64')
  const container = buff.toString('utf-8')
  return JSON.parse(container) as Token
}

/**
 * Request a token from your app to an app capable of signing a transaction (e.g. Helium Hotspot).
 * This token will be required to sign future transactions.
 * @param opts
 * @param opts.requestAppId the bundleId of the app requesting a token. Use `import { getBundleId } from 'react-native-device-info'`
 * @param opts.callbackUrl the url used to deeplink back to the requesting app
 * @param opts.appName the name of the app requesting a link
 * @param opts.universalLink the deeplink url of the app that will be creating the link (e.g. https://helium.com/)
 */
export const createWalletLinkUrl = (opts: {
  requestAppId: string
  callbackUrl: string
  appName: string
  universalLink: string
}) => {
  const { universalLink, ...params } = opts
  const query = queryString.stringify(params)

  return `${universalLink}link_wallet?${query}`
}

/**
 * Creates the url needed to add, assert location, or transfer a gateway.
 * The signing app will callback with the signed Transactions
 */
export const createUpdateHotspotUrl = (opts: SignHotspotRequest) => {
  const { signingAppId } = parseWalletLinkToken(opts.token) || {
    signingAppId: '',
  }
  const requestApp = delegateApps.find(({ androidPackage, iosBundleId }) => {
    const id = Platform.OS === 'android' ? androidPackage : iosBundleId
    return id === signingAppId
  })
  const universalLink = requestApp?.universalLink
  if (!universalLink) return
  const query = queryString.stringify(opts)
  return `${universalLink}sign_hotspot?${query}`
}

/**
 * Creates the url a signing app will use to callback to request app.
 * The url will contain the token needed to sign future transactions
 */
export const createLinkWalletCallbackUrl = (
  makerAppLink: string,
  address: string,
  responseParams: LinkWalletResponse
) =>
  `${makerAppLink}link_wallet/${address}?${queryString.stringify(
    responseParams
  )}`

/**
 * Creates the url a signing app will use to callback to request app.
 * The url will contain the signed gateway transactions
 */
export const createSignHotspotCallbackUrl = (
  makerAppLink: string,
  responseParams: SignHotspotResponse
) => `${makerAppLink}sign_hotspot?${queryString.stringify(responseParams)}`
