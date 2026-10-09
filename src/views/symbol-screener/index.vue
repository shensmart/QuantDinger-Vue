<template>
  <div class="screener-page" :class="{ 'theme-dark': isDarkTheme }">
    <header class="page-header">
      <div>
        <span class="kicker">{{ t('symbolScreener.kicker') }}</span>
        <h1>{{ t('symbolScreener.title') }}</h1>
        <p>{{ t('symbolScreener.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <a-input-search
          v-model="keyword"
          class="tag-search"
          allowClear
          :placeholder="t('symbolScreener.searchTags')" />
        <a-button icon="reload" :loading="loading" @click="runScreen">{{ t('symbolScreener.refresh') }}</a-button>
      </div>
    </header>

    <a-alert
      v-if="errorMessage"
      class="degrade-alert"
      type="warning"
      showIcon
      :message="errorMessage" />

    <section class="condition-pool" :aria-label="t('symbolScreener.selected')">
      <div class="condition-heading">
        <strong>{{ t('symbolScreener.selected') }} · {{ selected.length }}/32</strong>
        <a-button size="small" :disabled="!selected.length" @click="clearSelection">{{ t('symbolScreener.clearAll') }}</a-button>
      </div>
      <p class="filter-hint">{{ t('symbolScreener.logicHint') }}</p>
      <div class="condition-groups">
        <template v-for="(group, index) in selectedGroups">
          <span v-if="index" :key="`and-${group.category}`" class="logic-label">{{ t('symbolScreener.and') }}</span>
          <div :key="group.category" class="condition-group">
            <span class="dimension-label">{{ t(`symbolScreener.category.${group.category}`) }}</span>
            <template v-for="(tag, tagIndex) in group.tags">
              <span v-if="tagIndex" :key="`or-${tag.code}`" class="logic-label">{{ t(group.category === 'quote' ? 'symbolScreener.and' : 'symbolScreener.or') }}</span>
              <a-tag :key="tag.code" closable color="green" @close="toggleTag(tag)">{{ displayName(tag) }}</a-tag>
            </template>
          </div>
        </template>
        <span v-if="!selected.length" class="result-toolbar__hint">{{ t('symbolScreener.selectHint') }}</span>
      </div>
    </section>

    <div class="screener-layout">
      <aside class="tag-panel">
        <a-tabs :active-key="activeCategory" size="small" @change="switchCategory">
          <a-tab-pane v-for="category in categoryOrder" :key="category">
            <span slot="tab">{{ t(`symbolScreener.category.${category}`) }}<sup v-if="selectedCount(category)">{{ selectedCount(category) }}</sup></span>
          </a-tab-pane>
        </a-tabs>
        <p class="filter-hint">{{ t(keyword.trim() ? 'symbolScreener.searchHint' : activeCategory === 'industry' ? 'symbolScreener.industryHint' : 'symbolScreener.catalogueHint') }}</p>
        <a-spin :spinning="catalogueLoading">
          <div class="tag-browser">
            <a-tree
              v-if="!keyword.trim() && activeCategory === 'industry'"
              checkable
              check-strictly
              :tree-data="industryTree"
              :checked-keys="industryCheckedKeys"
              :expanded-keys="expandedIndustryKeys"
              @expand="expandedIndustryKeys = $event"
              @check="onIndustryCheck" />
            <section v-for="group in browserGroups" :key="group.category" class="tag-group">
              <h3 v-if="keyword.trim()">{{ t(`symbolScreener.category.${group.category}`) }} · {{ group.tags.length }}</h3>
              <button
                v-for="tag in group.tags"
                :key="tag.code"
                type="button"
                class="tag-option"
                :class="{ 'tag-option--active': isSelected(tag.code) }"
                :aria-pressed="isSelected(tag.code)"
                :disabled="tag.status === 'data_required'"
                :title="tag.status === 'data_required' ? t('symbolScreener.dataRequired') : tag.code"
                @click="selectSearchTag(tag)">
                <a-icon :type="isSelected(tag.code) ? 'check-square' : 'border'" />
                <span class="tag-option__name">{{ displayName(tag) }}<small v-if="tag.parent_code">{{ displayName(tagMap[tag.parent_code]) }} / {{ t('symbolScreener.level2') }}</small></span>
                <span class="tag-option__count">{{ Number(tag.member_count || 0).toLocaleString() }}</span>
              </button>
            </section>
            <a-empty v-if="!catalogueLoading && (keyword.trim() ? !visibleTags.length : !activeTags.length)" :description="t('symbolScreener.noTags')" />
          </div>
        </a-spin>
      </aside>

      <main class="result-panel">
        <div class="result-toolbar">
          <strong>{{ t('symbolScreener.matched') }}</strong>
          <div class="result-toolbar__actions">
            <a-input-number
              v-if="hasQuoteCondition"
              v-model="quoteThreshold"
              :min="-100"
              :step="0.1"
              :placeholder="t('symbolScreener.threshold')"
              @change="resetResults" />
            <a-button type="primary" :loading="loading" :disabled="!selectedConditions.length" @click="runScreen">
              {{ t('symbolScreener.run') }}
            </a-button>
            <a-dropdown :disabled="!result.items.length">
              <a-button icon="save">{{ t('symbolScreener.save') }} <a-icon type="down" /></a-button>
              <a-menu slot="overlay" @click="onSave">
                <a-menu-item key="smart">{{ t('symbolScreener.saveSmart') }}</a-menu-item>
                <a-menu-item key="manual">{{ t('symbolScreener.saveManual') }}</a-menu-item>
              </a-menu>
            </a-dropdown>
            <a-button icon="export" :disabled="!result.items.length" @click="exportCsv">{{ t('symbolScreener.export') }}</a-button>
          </div>
        </div>

        <div class="result-summary">
          <div><span>{{ t('symbolScreener.matched') }}</span><strong>{{ Number(result.total || 0).toLocaleString() }}</strong></div>
          <div><span>{{ t('symbolScreener.asOf') }}</span><strong>{{ result.as_of || '-' }}</strong></div>
          <div><span>{{ t('symbolScreener.categories') }}</span><strong>{{ selectedCategories.map(category => t(`symbolScreener.category.${category}`)).join(' + ') || '-' }}</strong></div>
        </div>

        <a-spin :spinning="loading">
          <div class="result-table-wrap">
            <table class="result-table">
              <thead>
                <tr>
                  <th>{{ t('symbolScreener.symbol') }}</th>
                  <th>{{ t('symbolScreener.name') }}</th>
                  <th class="numeric">{{ t('symbolScreener.price') }}</th>
                  <th class="numeric">{{ t('symbolScreener.changePct') }}</th>
                  <th class="numeric">{{ t('symbolScreener.amount') }}</th>
                  <th>{{ t('symbolScreener.hitTags') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in result.items" :key="`${item.market}-${item.symbol}`">
                  <td><strong>{{ item.symbol }}</strong></td>
                  <td>{{ item.name || '-' }}</td>
                  <td class="numeric">{{ formatNumber(item.price) }}</td>
                  <td class="numeric" :class="changeClass(item.change_pct)">{{ formatPercent(item.change_pct) }}</td>
                  <td class="numeric">{{ formatAmount(item.amount) }}</td>
                  <td>
                    <a-tag v-for="code in item.tags" :key="code" class="hit-tag">{{ tagLabel(code) }}</a-tag>
                  </td>
                </tr>
              </tbody>
            </table>
            <a-empty v-if="!loading && !result.items.length" :description="t('symbolScreener.empty')" />
          </div>
          <a-pagination
            v-if="result.total > pageSize"
            v-model="page"
            class="result-pagination"
            :page-size="pageSize"
            :total="result.total"
            show-less-items
            @change="runScreen" />
        </a-spin>
      </main>
    </div>

    <a-modal
      v-model="saveVisible"
      :title="saveMode === 'smart' ? t('symbolScreener.saveSmart') : t('symbolScreener.saveManual')"
      :confirm-loading="saving"
      :ok-text="t('symbolScreener.confirmSave')"
      :cancel-text="t('universeManager.cancel')"
      @ok="confirmSave">
      <a-input v-model="saveName" :placeholder="t('symbolScreener.poolName')" />
      <small class="save-hint">
        {{ saveMode === 'smart' ? t('symbolScreener.smartHint') : t('symbolScreener.manualHint') }}
      </small>
    </a-modal>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { Tree } from 'ant-design-vue'
import { getTags, saveScreen, screenTags } from '@/api/tags'

const CATEGORY_ORDER = ['industry', 'concept', 'region', 'feature', 'event', 'quote']
const PAGE_SIZE = 50

export default {
  name: 'SymbolScreener',
  components: { ATree: Tree },
  data () {
    return {
      loading: false,
      catalogueLoading: false,
      saving: false,
      tags: [],
      keyword: '',
      activeCategory: 'industry',
      categoryOrder: CATEGORY_ORDER,
      expandedIndustryKeys: [],
      requestId: 0,
      selected: [],
      quoteThreshold: null,
      result: { items: [], total: 0, as_of: '', truncated: false },
      page: 1,
      pageSize: PAGE_SIZE,
      errorMessage: '',
      saveVisible: false,
      saveMode: 'smart',
      saveName: ''
    }
  },
  computed: {
    ...mapState({ navTheme: state => state.app.theme }),
    isDarkTheme () { return ['dark', 'realdark'].includes(this.navTheme) },
    visibleTags () {
      const text = this.keyword.trim().toLowerCase()
      if (!text) return this.tags
      return this.tags.filter(tag => `${tag.name} ${tag.code}`.toLowerCase().includes(text))
    },
    activeTags () { return this.tags.filter(tag => tag.category === this.activeCategory) },
    browserGroups () {
      if (!this.keyword.trim()) return this.activeCategory === 'industry' ? [] : [{ category: this.activeCategory, tags: this.activeTags }]
      return CATEGORY_ORDER.map(category => ({ category, tags: this.visibleTags.filter(tag => tag.category === category) })).filter(group => group.tags.length)
    },
    selectedGroups () {
      return CATEGORY_ORDER.map(category => ({ category, tags: this.selectedTags.filter(tag => tag.category === category) })).filter(group => group.tags.length)
    },
    industryTree () {
      const industries = this.tags.filter(tag => tag.category === 'industry')
      const nodes = {}
      industries.forEach(tag => {
        nodes[tag.code] = {
          key: tag.code,
          title: `${this.displayName(tag)} · ${Number(tag.member_count || 0).toLocaleString()} · ${this.t(tag.parent_code ? 'symbolScreener.level2' : 'symbolScreener.level1')}`,
          disableCheckbox: tag.status === 'data_required' || Boolean(tag.parent_code && this.isSelected(tag.parent_code)),
          children: []
        }
      })
      const roots = []
      industries.forEach(tag => {
        const parent = tag.parent_code && nodes[tag.parent_code]
        if (parent && parent !== nodes[tag.code]) parent.children.push(nodes[tag.code])
        else roots.push(nodes[tag.code])
      })
      return roots
    },
    industryCheckedKeys () {
      return {
        checked: this.tags.filter(tag => tag.category === 'industry' && (this.isSelected(tag.code) || this.isSelected(tag.parent_code))).map(tag => tag.code),
        halfChecked: [...new Set(this.selectedTags.filter(tag => tag.parent_code && !this.isSelected(tag.parent_code)).map(tag => tag.parent_code))]
      }
    },
    tagMap () {
      return this.tags.reduce((acc, tag) => { acc[tag.code] = tag; return acc }, {})
    },
    selectedTags () {
      return this.selected.map(code => this.tagMap[code]).filter(Boolean)
    },
    selectedConditions () {
      return this.selectedTags.map(tag => ({
        tag_code: tag.code,
        ...(tag.category === 'quote' && this.quoteThreshold !== null && this.quoteThreshold !== undefined ? { value: this.quoteThreshold } : {})
      }))
    },
    selectedCategories () {
      return [...new Set(this.selectedTags.map(tag => tag.category))]
    },
    hasQuoteCondition () {
      return this.selectedTags.some(tag => tag.category === 'quote')
    }
  },
  mounted () {
    this.loadTags()
  },
  methods: {
    t (key) { return this.$t(key) },
    unwrap (res) { return res && Object.prototype.hasOwnProperty.call(res, 'data') ? res.data : res },
    displayName (tag) { return tag ? String(tag.name || tag.code).replace(/^(Industry|Concept|Region|Feature):\s*/, '') : '' },
    switchCategory (category) { this.activeCategory = category; this.keyword = '' },
    selectSearchTag (tag) {
      this.toggleTag(tag)
      if (this.keyword.trim()) {
        this.switchCategory(tag.category)
        if (tag.parent_code && !this.expandedIndustryKeys.includes(tag.parent_code)) this.expandedIndustryKeys.push(tag.parent_code)
      }
    },
    onIndustryCheck (keys, info) { this.toggleTag(this.tagMap[info.node.eventKey]) },
    resetResults () {
      this.requestId += 1
      this.loading = false
      this.page = 1
      this.result = { items: [], total: 0, as_of: '', truncated: false }
    },
    clearSelection () { this.selected = []; this.quoteThreshold = null; this.resetResults() },
    isSelected (code) { return this.selected.includes(code) },
    selectedCount (category) {
      return this.selectedTags.filter(tag => tag.category === category).length
    },
    toggleTag (tag) {
      if (!tag || tag.status === 'data_required') return
      const index = this.selected.indexOf(tag.code)
      if (index >= 0) this.selected.splice(index, 1)
      else {
        // A selected parent already covers its children; keep only the parent.
        if (tag.parent_code && this.isSelected(tag.parent_code)) return
        const next = this.selected.filter(code => {
          const existing = this.tagMap[code]
          return existing && existing.parent_code !== tag.code && !(tag.category === 'quote' && existing.category === 'quote')
        })
        if (next.length >= 32) return this.$message.warning(this.t('symbolTag.tooManyConditions'))
        this.selected = [...next, tag.code]
        if (tag.category === 'quote') this.quoteThreshold = null
      }
      this.resetResults()
    },
    tagLabel (code) {
      const tag = this.tagMap[code]
      return tag ? this.displayName(tag) : code
    },
    formatNumber (value) {
      if (value === null || value === undefined) return '-'
      return Number(value).toFixed(2)
    },
    formatPercent (value) {
      if (value === null || value === undefined) return '-'
      const number = Number(value)
      return `${number > 0 ? '+' : ''}${number.toFixed(2)}%`
    },
    formatAmount (value) {
      if (value === null || value === undefined) return '-'
      const number = Number(value)
      if (Math.abs(number) >= 1e8) return `${(number / 1e8).toFixed(2)}${this.t('symbolScreener.yi')}`
      if (Math.abs(number) >= 1e4) return `${(number / 1e4).toFixed(2)}${this.t('symbolScreener.wan')}`
      return number.toFixed(0)
    },
    changeClass (value) {
      if (value === null || value === undefined) return ''
      return Number(value) > 0 ? 'change-up' : Number(value) < 0 ? 'change-down' : ''
    },
    async loadTags () {
      this.catalogueLoading = true
      this.errorMessage = ''
      try {
        const payload = this.unwrap(await getTags()) || {}
        this.tags = payload.items || []
      } catch (error) {
        this.errorMessage = error.backendMessage || error.message || this.t('symbolScreener.loadTagsFailed')
      } finally {
        this.catalogueLoading = false
      }
    },
    async runScreen () {
      if (!this.selectedConditions.length) return
      const requestId = ++this.requestId
      this.loading = true
      this.errorMessage = ''
      try {
        const payload = this.unwrap(await screenTags({
          conditions: this.selectedConditions,
          limit: this.pageSize,
          offset: (this.page - 1) * this.pageSize
        })) || {}
        if (requestId !== this.requestId) return
        this.result = {
          items: payload.items || [],
          total: payload.total || 0,
          as_of: payload.as_of || '',
          truncated: Boolean(payload.truncated)
        }
      } catch (error) {
        if (requestId !== this.requestId) return
        this.errorMessage = error.backendMessage || error.message || this.t('symbolScreener.screenFailed')
        this.result = { items: [], total: 0, as_of: '', truncated: false }
      } finally {
        if (requestId === this.requestId) this.loading = false
      }
    },
    onSave ({ key }) {
      this.saveMode = key
      this.saveName = this.selectedTags.map(tag => this.displayName(tag)).join(' + ')
      this.saveVisible = true
    },
    async confirmSave () {
      const name = this.saveName.trim()
      if (!name) return
      this.saving = true
      try {
        await saveScreen({
          name,
          mode: this.saveMode,
          market: 'CNStock',
          conditions: this.selectedConditions
        })
        this.saveVisible = false
        this.$message.success(this.t('symbolScreener.saved'))
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.t('symbolScreener.saveFailed'))
      } finally {
        this.saving = false
      }
    },
    exportCsv () {
      const header = [
        this.t('symbolScreener.symbol'),
        this.t('symbolScreener.name'),
        this.t('symbolScreener.price'),
        this.t('symbolScreener.changePct'),
        this.t('symbolScreener.amount'),
        this.t('symbolScreener.hitTags')
      ]
      const rows = this.result.items.map(item => [
        item.symbol,
        item.name || '',
        item.price ?? '',
        item.change_pct ?? '',
        item.amount ?? '',
        (item.tags || []).join('|')
      ])
      const csv = [header, ...rows]
        .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
        .join('\n')
      // A BOM keeps Excel from mangling the Chinese column headers.
      const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `symbol-screener-${this.result.as_of || 'today'}.csv`
      link.click()
      URL.revokeObjectURL(link.href)
    }
  }
}
</script>

<style lang="less" scoped>
.screener-page{min-height:calc(100vh - 64px);padding:20px;background:#f4f6f8;color:#1f2933}
.page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:16px}
.kicker{color:#52c41a;font-size:12px;font-weight:800;text-transform:uppercase}
.page-header h1{margin:3px 0 4px;font-size:28px}
.page-header p{margin:0;color:#667085}
.header-actions{display:flex;align-items:center;gap:8px}
.tag-search{width:260px}
.degrade-alert{margin-bottom:12px}
.condition-pool{margin-bottom:14px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:10px;background:#fff}
.condition-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}
.filter-hint{margin:8px 0 12px;color:#667085;font-size:12px;line-height:1.6}
.condition-groups,.condition-group{display:flex;align-items:center;flex-wrap:wrap;gap:6px}
.condition-group{padding:6px 10px;border-radius:8px;background:#f7f8fa}
.condition-group .ant-tag{margin:0}
.dimension-label{font-size:12px;font-weight:600;margin-right:4px}
.logic-label{color:#98a2b3;font-size:11px}
.screener-layout{display:grid;grid-template-columns:420px minmax(0,1fr);gap:14px;align-items:start}
.tag-panel{min-width:0;padding:0 14px 14px;border:1px solid #e5e7eb;border-radius:10px;background:#fff}
.tag-panel sup{margin-left:3px;color:#52c41a}
.tag-browser{max-height:560px;min-height:320px;overflow:auto}
.tag-group{margin-bottom:18px}
.tag-group h3{margin:0 0 8px;font-size:13px}
.tag-option{display:flex;align-items:center;gap:8px;width:100%;padding:9px 10px;border:0;border-bottom:1px solid #edf0f3;text-align:left;color:inherit;font-size:13px;background:transparent;cursor:pointer}
.tag-option:hover,.tag-option:focus-visible{background:#f7f8fa;outline:2px solid #52c41a;outline-offset:-2px}
.tag-option--active{color:#1f6b0d;background:#edf7e8}
.tag-option:disabled{cursor:not-allowed;opacity:.45}
.tag-option__name{flex:1}
.tag-option__name small{display:block;color:#98a2b3;font-size:11px}
.tag-option__count{color:#98a2b3;font-size:11px}
.tag-browser ::v-deep .ant-tree-title{white-space:normal}
.tag-browser ::v-deep .ant-tree-node-content-wrapper{height:auto;min-height:24px}
.result-panel{padding:16px;border:1px solid #e5e7eb;border-radius:10px;background:#fff}
.result-toolbar{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.result-toolbar__hint{color:#98a2b3;font-size:13px}
.result-toolbar__actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.result-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px}
.result-summary>div{display:flex;flex-direction:column;gap:3px;padding:10px 12px;border-radius:8px;background:#f7f8fa}
.result-summary span{color:#667085;font-size:11px}
.result-summary strong{font-size:16px}
.result-table-wrap{min-height:320px;overflow:auto;border:1px solid #e5e7eb;border-radius:8px}
.result-table{width:100%;border-collapse:collapse}
.result-table th,.result-table td{padding:9px 12px;border-bottom:1px solid #edf0f3;text-align:left;font-size:13px}
.result-table th{position:sticky;top:0;color:#667085;background:#f7f8fa;font-size:12px}
.result-table .numeric{text-align:right;font-variant-numeric:tabular-nums}
.change-up{color:#c0392b}
.change-down{color:#1e8e3e}
.hit-tag{margin:0 4px 2px 0}
.result-pagination{margin-top:14px;text-align:right}
.save-hint{display:block;margin-top:8px;color:#98a2b3}
.theme-dark{background:#0b0b0b;color:#f5f5f5}
.theme-dark h1{color:#f5f5f5}
.theme-dark .page-header p,.theme-dark .result-summary span{color:#a7a7a7}
.theme-dark .tag-panel,.theme-dark .result-panel,.theme-dark .condition-pool{border-color:#2b2b2b;background:#151515}
.theme-dark .filter-hint{color:#a7a7a7}
.theme-dark .condition-group{background:#1d1d1d}
.theme-dark .tag-option{border-color:#303030}
.theme-dark .tag-option:hover,.theme-dark .tag-option:focus-visible{background:#1d1d1d}
.theme-dark .tag-option--active{color:#b7eb8f;background:#1d2e17}
.theme-dark .tag-browser ::v-deep .ant-tree{color:#e8e8e8}
.theme-dark .tag-browser ::v-deep .ant-tree-node-content-wrapper{color:#e8e8e8}
.theme-dark .tag-browser ::v-deep .ant-tree-node-content-wrapper:hover,.theme-dark .tag-browser ::v-deep .ant-tree-node-selected{background:#1d2e17}
.theme-dark .tag-panel ::v-deep .ant-tabs-tab{color:#bfbfbf}
.theme-dark .tag-panel ::v-deep .ant-tabs-tab-active{color:#52c41a}
.theme-dark .tag-panel ::v-deep .ant-tabs-tab-prev,.theme-dark .tag-panel ::v-deep .ant-tabs-tab-next{color:#bfbfbf}
.theme-dark .result-table-wrap{border-color:#303030}
.theme-dark .result-table th{color:#a7a7a7;background:#1d1d1d}
.theme-dark .result-table th,.theme-dark .result-table td{border-color:#303030}
.theme-dark .result-summary>div{background:#1d1d1d}
@media(max-width:1200px){.screener-layout{grid-template-columns:1fr}.tag-browser{max-height:360px}.result-toolbar{flex-wrap:wrap}}
@media(max-width:760px){.screener-page{padding:14px}.page-header{flex-direction:column}.header-actions{width:100%;flex-wrap:wrap}.tag-search{width:100%}.result-toolbar{flex-direction:column}.result-summary{grid-template-columns:1fr}}
</style>
