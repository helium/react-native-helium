import axios, { AxiosInstance, AxiosResponse, Method } from 'axios'
export const DEWI_V3_ONBOARDING_API_BASE_URL =
  'https://onboarding.dewi.org/api/v3'

type Response = { data: { solanaTransactions: string[] } }

export default class OnboardingClientV3 {
  private axios!: AxiosInstance

  constructor(baseURL: string = DEWI_V3_ONBOARDING_API_BASE_URL) {
    this.axios = axios.create({
      baseURL,
    })
  }

  private async execute(method: Method, path: string, params?: Object) {
    try {
      const response: AxiosResponse<Response> = await this.axios({
        method,
        url: path,
        data: params,
      })
      return response.data
    } catch (err) {
      if (axios.isAxiosError(err)) {
        return err.response?.data as Response
      }
      throw err
    }
  }

  private async post(path: string, params: Object = {}) {
    return this.execute('POST', path, params)
  }

  async createHotspot(opts: { transaction: string }) {
    return this.post('transactions/create-hotspot', opts)
  }

  async onboardIot({ hotspotAddress }: { hotspotAddress: string }) {
    return this.post('transactions/iot/onboard', { entityKey: hotspotAddress })
  }

  async updateIotMetadata({
    walletAddress,
    location,
    elevation,
    gain,
    hotspotAddress,
  }: {
    hotspotAddress: string
    walletAddress: string
    location: string
    elevation: number
    gain: number
  }) {
    const body = {
      entityKey: hotspotAddress,
      location,
      elevation,
      gain,
      wallet: walletAddress,
    }
    return this.post('transactions/iot/update-metadata', body)
  }
}
