import axios, { AxiosInstance, AxiosResponse, Method } from 'axios'
import axiosRetry from 'axios-retry'

export const DEWI_V3_ONBOARDING_API_BASE_URL =
  'https://onboarding.dewi.org/api/v3'

type Response = { data: { solanaTransactions: number[][] } }
type Metadata = {
  location: string
  elevation: number
  gain: number
}
export type HotspotType = 'iot' | 'mobile'

export default class OnboardingClientV3 {
  private axios!: AxiosInstance

  constructor(baseURL: string = DEWI_V3_ONBOARDING_API_BASE_URL) {
    this.axios = axios.create({
      baseURL,
    })

    axiosRetry(this.axios, {
      retries: 10,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => error.response?.status === 404,
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

  async onboard(
    opts: {
      hotspotAddress: string
      type: HotspotType
    } & Partial<Metadata>
  ) {
    return this.post(`transactions/${opts.type}/onboard`, {
      entityKey: opts.hotspotAddress,
      location: opts.location,
      elevation: opts.elevation,
      gain: opts.gain,
    })
  }

  async onboardIot(opts: { hotspotAddress: string } & Partial<Metadata>) {
    return this.onboard({ ...opts, type: 'iot' })
  }

  async onboardMobile(opts: { hotspotAddress: string } & Partial<Metadata>) {
    return this.onboard({ ...opts, type: 'mobile' })
  }

  async updateMetadata({
    solanaAddress,
    location,
    elevation,
    gain,
    hotspotAddress,
    type,
  }: Metadata & {
    type: HotspotType
    hotspotAddress: string
    solanaAddress: string
  }) {
    const body = {
      entityKey: hotspotAddress,
      location,
      elevation,
      gain,
      wallet: solanaAddress,
    }
    return this.post(`transactions/${type}/update-metadata`, body)
  }

  async updateIotMetadata(
    opts: Metadata & {
      hotspotAddress: string
      solanaAddress: string
    }
  ) {
    return this.updateMetadata({ ...opts, type: 'iot' })
  }

  async updateMobileMetadata(
    opts: Metadata & {
      hotspotAddress: string
      solanaAddress: string
    }
  ) {
    return this.updateMetadata({ ...opts, type: 'mobile' })
  }
}
