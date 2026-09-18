/**
 * Symbol tag APIs: catalogue, membership, screening, and smart-pool saving.
 */
import request from '@/utils/request'

const BASE_URL = '/api/tags'

export function getTags (params = {}) {
  return request({ url: BASE_URL, method: 'get', params })
}

export function getTagMembers (code, params = {}) {
  return request({ url: `${BASE_URL}/${encodeURIComponent(code)}/members`, method: 'get', params })
}

export function screenTags (data = {}) {
  return request({ url: `${BASE_URL}/screen`, method: 'post', data })
}

export function saveScreen (data = {}) {
  return request({ url: `${BASE_URL}/screen/save`, method: 'post', data })
}

export function getSymbolTags (symbol, params = {}) {
  return request({ url: `${BASE_URL}/symbols/${encodeURIComponent(symbol)}`, method: 'get', params })
}

export function getTagOverview () {
  return request({ url: `${BASE_URL}/admin/overview`, method: 'get' })
}

export function syncTags (data = {}) {
  return request({ url: `${BASE_URL}/admin/sync`, method: 'post', data })
}

export function getTagConditionFloor (code) {
  return request({ url: `${BASE_URL}/${encodeURIComponent(code)}/conditions/floor`, method: 'get' })
}

export function getSymbolsTags (symbols, params = {}) {
  return request({
    url: `${BASE_URL}/symbols`,
    method: 'get',
    params: { symbols: (symbols || []).join(','), ...params }
  })
}
