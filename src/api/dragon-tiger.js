/**
 * Eastmoney-style dragon-tiger (龙虎榜) views.
 */
import request from '@/utils/request'

const BASE_URL = '/api/market-events/dragon-tiger'

export function getDragonTigerDaily (params = {}) {
  return request({ url: `${BASE_URL}/daily`, method: 'get', params, timeout: 60000 })
}

export function getDragonTigerInstitutions (params = {}) {
  return request({ url: `${BASE_URL}/institutions`, method: 'get', params, timeout: 60000 })
}

export function getDragonTigerBranches (params = {}) {
  return request({ url: `${BASE_URL}/branches`, method: 'get', params, timeout: 60000 })
}

export function getDragonTigerStatistics (params = {}) {
  return request({ url: `${BASE_URL}/statistics`, method: 'get', params, timeout: 60000 })
}

export function getDragonTigerSeatTracking (params = {}) {
  return request({ url: `${BASE_URL}/seat-tracking`, method: 'get', params, timeout: 60000 })
}

export function getDragonTigerBranchRanking (params = {}) {
  return request({ url: `${BASE_URL}/branch-ranking`, method: 'get', params, timeout: 60000 })
}
