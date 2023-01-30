import { Asset } from '@helium/spl-utils'

export const isSolHotspot = (hotspot: any): hotspot is Asset =>
  Object.keys(hotspot).includes('creators')
