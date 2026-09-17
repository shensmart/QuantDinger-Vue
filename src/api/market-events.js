/**
 * A-share market event boards (limit pools, ladder, dragon-tiger, hot list).
 */
import request from '@/utils/request'

const BASE_URL = '/api/market-events'

export function getMarketEvents (params = {}) {
  return request({
    url: BASE_URL,
    method: 'get',
    params
  })
}

export function getLimitUpPool (params = {}) {
  return request({
    url: `${BASE_URL}/limit-up`,
    method: 'get',
    params
  })
}

export function getLimitUpLadder (params = {}) {
  return request({
    url: `${BASE_URL}/ladder`,
    method: 'get',
    params
  })
}

export function getDragonTiger (params = {}) {
  return request({
    url: `${BASE_URL}/dragon-tiger`,
    method: 'get',
    params
  })
}

export function getHotList (params = {}) {
  return request({
    url: `${BASE_URL}/hot-list`,
    method: 'get',
    params
  })
}

export function getAnomalyList (params = {}) {
  return request({
    url: `${BASE_URL}/anomaly`,
    method: 'get',
    params
  })
}

export function getMarketEventsCoverage () {
  return request({
    url: `${BASE_URL}/coverage`,
    method: 'get'
  })
}
