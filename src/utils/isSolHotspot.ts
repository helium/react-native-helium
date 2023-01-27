import { SolHotspot } from '@helium/hotspot-utils'

export const isSolHotspot = (hotspot: any): hotspot is SolHotspot =>
  Object.keys(hotspot).includes('numLocationAsserts')
