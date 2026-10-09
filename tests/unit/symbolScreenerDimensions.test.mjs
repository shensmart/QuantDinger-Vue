import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../../src/views/symbol-screener/index.vue', import.meta.url), 'utf8')
const script = page.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '').replace('export default', 'return')
const makeComponent = (screenTags = async () => ({ data: { items: [], total: 0 } })) => new Function('mapState', 'screenTags', 'Tree', script)(() => ({}), screenTags, { name: 'ATree' })
const fixtures = [
  { code: 'parent', name: 'Industry: 半导体', category: 'industry', level: 1, member_count: 10 },
  { code: 'child', name: 'Industry: 数字芯片', category: 'industry', parent_code: 'parent', level: 2, member_count: 4 },
  { code: 'child2', name: 'Industry: 模拟芯片', category: 'industry', parent_code: 'parent', level: 2 },
  { code: 'concept885', name: 'Concept: 半导体概念', category: 'concept' },
  { code: 'concept886', name: 'Concept: 存储芯片', category: 'concept' },
  { code: 'region', name: 'Region: 北京', category: 'region' },
  { code: 'feature', name: 'Feature: 昨日涨停', category: 'feature' },
  { code: 'quote', name: 'Quote', category: 'quote' },
  { code: 'quote2', name: 'Quote 2', category: 'quote' }
]
function instance (screenTags) {
  const component = makeComponent(screenTags)
  const vm = { ...component.data(), tags: fixtures, $message: { warning: () => {} } }
  for (const [key, method] of Object.entries(component.methods)) vm[key] = method.bind(vm)
  vm.t = key => key
  for (const [key, computed] of Object.entries(component.computed)) Object.defineProperty(vm, key, { get: () => computed.call(vm) })
  return vm
}

test('industry tree uses explicit parents; concept ranges stay in one flat dimension', () => {
  assert.equal(makeComponent().components.ATree.name, 'ATree')
  assert.match(page, /import \{ Tree \} from 'ant-design-vue'/)
  const vm = instance()
  assert.equal(vm.industryTree.length, 1)
  assert.deepEqual(vm.industryTree[0].children.map(node => node.key), ['child', 'child2'])
  assert.equal(vm.industryTree[0].children[0].disableCheckbox, false)
  vm.switchCategory('concept')
  assert.deepEqual(vm.browserGroups[0].tags.map(tag => tag.code), ['concept885', 'concept886'])
})

test('parent selection covers children without expanding request conditions', () => {
  const vm = instance()
  vm.toggleTag(fixtures[1])
  assert.deepEqual(vm.industryCheckedKeys.halfChecked, ['parent'])
  vm.toggleTag(fixtures[0])
  assert.deepEqual(vm.selected, ['parent'])
  assert.deepEqual(vm.industryCheckedKeys.checked, ['parent', 'child', 'child2'])
  assert.equal(vm.industryTree[0].children[0].disableCheckbox, true)
  vm.toggleTag(fixtures[1])
  assert.deepEqual(vm.selected, ['parent'])
  assert.deepEqual(vm.selectedConditions, [{ tag_code: 'parent' }])
  vm.onIndustryCheck({}, { node: { eventKey: 'parent' } })
  assert.deepEqual(vm.selected, [])
})

test('global search finds cross-dimension hits and opens the selected industry parent', () => {
  const vm = instance()
  vm.keyword = '半导体'
  assert.deepEqual(vm.browserGroups.map(group => group.category), ['industry', 'concept'])
  vm.keyword = '数字'
  vm.selectSearchTag(fixtures[1])
  assert.equal(vm.activeCategory, 'industry')
  assert.equal(vm.keyword, '')
  assert.deepEqual(vm.expandedIndustryKeys, ['parent'])
  vm.keyword = '北京'
  vm.selectSearchTag(fixtures[5])
  assert.equal(vm.activeCategory, 'region')
  assert.deepEqual(vm.selected, ['child', 'region'])
})

test('threshold override is not sent twice; switching quote resets its value', () => {
  const vm = instance()
  vm.toggleTag(fixtures[7])
  vm.quoteThreshold = 5
  assert.deepEqual(vm.selectedConditions, [{ tag_code: 'quote', value: 5 }])
  vm.toggleTag(fixtures[8])
  assert.equal(vm.quoteThreshold, null)
  assert.deepEqual(vm.selectedConditions, [{ tag_code: 'quote2' }])
})

test('selection invalidates results and late requests cannot restore stale results', async () => {
  let resolve
  const vm = instance(() => new Promise(done => { resolve = done }))
  vm.toggleTag(fixtures[0])
  const request = vm.runScreen()
  vm.toggleTag(fixtures[5])
  resolve({ data: { items: [{ symbol: 'stale' }], total: 1 } })
  await request
  assert.equal(vm.result.total, 0)
  assert.deepEqual(vm.result.items, [])
  vm.clearSelection()
  assert.deepEqual(vm.selected, [])
})

test('condition limit and new translations remain wired', () => {
  const vm = instance()
  vm.tags = Array.from({ length: 33 }, (_, n) => ({ code: `tag${n}`, category: 'concept' }))
  vm.tags.forEach(vm.toggleTag)
  assert.equal(vm.selected.length, 32)
  assert.match(page, /check-strictly/)
  assert.match(page, /symbolScreener\.logicHint/)
  for (const locale of ['zh-CN', 'zh-TW', 'en-US']) {
    const dict = readFileSync(new URL(`../../src/locales/lang/${locale}.js`, import.meta.url), 'utf8')
    for (const key of ['category.region', 'category.feature', 'selected', 'clearAll', 'level1', 'level2', 'industryHint', 'searchHint']) {
      assert.ok(dict.includes(`"symbolScreener.${key}"`), `${locale}: ${key}`)
    }
  }
})
