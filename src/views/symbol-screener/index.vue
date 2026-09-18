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

    <div class="screener-layout">
      <aside class="tag-panel">
        <a-spin :spinning="catalogueLoading">
          <section v-for="group in groupedTags" :key="group.category" class="tag-group">
            <h3>
              <a-icon :type="categoryIcon(group.category)" />
              {{ t(`symbolScreener.category.${group.category}`) }}
              <a-tag>{{ selectedCount(group.category) }}/{{ group.tags.length }}</a-tag>
            </h3>
            <div class="tag-list">
              <button
                v-for="tag in group.tags"
                :key="tag.code"
                type="button"
                class="tag-chip"
                :class="{
                  'tag-chip--active': isSelected(tag.code),
                  'tag-chip--disabled': tag.status === 'data_required'
                }"
                :disabled="tag.status === 'data_required'"
                :title="tag.status === 'data_required'
                  ? t('symbolScreener.dataRequired')
                  : `${tag.code}${tag.point_in_time ? ' · ' + t('symbolScreener.pointInTime') : ''}`"
                @click="toggleTag(tag)"
              >
                <span class="tag-chip__name">{{ tag.name || tag.code }}</span>
                <span v-if="tag.member_count" class="tag-chip__count">{{ Number(tag.member_count).toLocaleString() }}</span>
              </button>
            </div>
          </section>
          <a-empty v-if="!catalogueLoading && !tags.length" :description="t('symbolScreener.noTags')" />
        </a-spin>
      </aside>

      <main class="result-panel">
        <div class="result-toolbar">
          <div class="result-toolbar__query">
            <a-tag
              v-for="tag in selectedTags"
              :key="tag.code"
              :closable="true"
              color="green"
              @close="toggleTag(tag)">
              {{ tag.name || tag.code }}
            </a-tag>
            <span v-if="!selectedTags.length" class="result-toolbar__hint">{{ t('symbolScreener.selectHint') }}</span>
          </div>
          <div class="result-toolbar__actions">
            <a-input-number
              v-if="hasQuoteCondition"
              v-model="quoteThreshold"
              :min="-100"
              :step="0.1"
              :placeholder="t('symbolScreener.threshold')"
              @change="runScreen" />
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
          <div><span>{{ t('symbolScreener.categories') }}</span><strong>{{ selectedCategories.join(' + ') || '-' }}</strong></div>
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
import { getTags, saveScreen, screenTags } from '@/api/tags'

const CATEGORY_ORDER = ['industry', 'concept', 'event', 'quote']
const PAGE_SIZE = 50

export default {
  name: 'SymbolScreener',
  data () {
    return {
      loading: false,
      catalogueLoading: false,
      saving: false,
      tags: [],
      keyword: '',
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
    groupedTags () {
      const groups = CATEGORY_ORDER.map(category => ({
        category,
        tags: this.visibleTags.filter(tag => tag.category === category)
      }))
      return groups.filter(group => group.tags.length)
    },
    tagMap () {
      return this.tags.reduce((acc, tag) => { acc[tag.code] = tag; return acc }, {})
    },
    selectedTags () {
      return this.selected.map(code => this.tagMap[code]).filter(Boolean)
    },
    selectedConditions () {
      const conditions = this.selected.map(code => ({ tag_code: code }))
      if (this.hasQuoteCondition && this.quoteThreshold !== null && this.quoteThreshold !== undefined) {
        const quoteTag = this.selectedTags.find(tag => tag.category === 'quote')
        if (quoteTag) conditions.push({ tag_code: quoteTag.code, value: this.quoteThreshold })
      }
      return conditions
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
    categoryIcon (category) {
      return { industry: 'apartment', concept: 'bulb', event: 'thunderbolt', quote: 'dashboard' }[category] || 'tag'
    },
    isSelected (code) { return this.selected.includes(code) },
    selectedCount (category) {
      return this.selectedTags.filter(tag => tag.category === category).length
    },
    toggleTag (tag) {
      if (tag.status === 'data_required') return
      const index = this.selected.indexOf(tag.code)
      if (index >= 0) this.selected.splice(index, 1)
      else {
        // Only one quote threshold can drive the numeric override at a time.
        if (tag.category === 'quote') {
          const existing = this.selectedTags.find(item => item.category === 'quote')
          if (existing) this.selected.splice(this.selected.indexOf(existing.code), 1)
        }
        this.selected.push(tag.code)
      }
      this.page = 1
      if (this.selected.length) this.runScreen()
      else this.result = { items: [], total: 0, as_of: '', truncated: false }
    },
    tagLabel (code) {
      const tag = this.tagMap[code]
      return tag ? (tag.name || tag.code) : code
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
      this.loading = true
      this.errorMessage = ''
      try {
        const payload = this.unwrap(await screenTags({
          conditions: this.selectedConditions,
          limit: this.pageSize,
          offset: (this.page - 1) * this.pageSize
        })) || {}
        this.result = {
          items: payload.items || [],
          total: payload.total || 0,
          as_of: payload.as_of || '',
          truncated: Boolean(payload.truncated)
        }
      } catch (error) {
        this.errorMessage = error.backendMessage || error.message || this.t('symbolScreener.screenFailed')
        this.result = { items: [], total: 0, as_of: '', truncated: false }
      } finally {
        this.loading = false
      }
    },
    onSave ({ key }) {
      this.saveMode = key
      this.saveName = this.selectedTags.map(tag => tag.name || tag.code).join(' + ')
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
.screener-layout{display:grid;grid-template-columns:340px minmax(0,1fr);gap:14px;align-items:start}
.tag-panel{max-height:calc(100vh - 220px);padding:14px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:10px;background:#fff}
.tag-group{margin-bottom:18px}
.tag-group h3{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.04em}
.tag-list{display:flex;flex-wrap:wrap;gap:6px}
.tag-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid #e2e6ec;border-radius:14px;color:#273044;font-size:12px;background:#fff;cursor:pointer}
.tag-chip:hover{border-color:#52c41a}
.tag-chip--active{border-color:#52c41a;color:#1f6b0d;background:#edf7e8}
.tag-chip--disabled{cursor:not-allowed;opacity:.45}
.tag-chip__count{color:#98a2b3;font-size:11px}
.result-panel{padding:16px;border:1px solid #e5e7eb;border-radius:10px;background:#fff}
.result-toolbar{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.result-toolbar__query{display:flex;flex-wrap:wrap;gap:6px;min-height:32px}
.result-toolbar__hint{color:#98a2b3;font-size:13px}
.result-toolbar__actions{display:flex;align-items:center;gap:8px;white-space:nowrap}
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
.theme-dark .tag-panel,.theme-dark .result-panel{border-color:#2b2b2b;background:#151515}
.theme-dark .tag-chip{border-color:#303030;color:#e8e8e8;background:#1d1d1d}
.theme-dark .tag-chip--active{border-color:#52c41a;color:#b7eb8f;background:#1d2e17}
.theme-dark .result-table-wrap{border-color:#303030}
.theme-dark .result-table th{color:#a7a7a7;background:#1d1d1d}
.theme-dark .result-table th,.theme-dark .result-table td{border-color:#303030}
.theme-dark .result-summary>div{background:#1d1d1d}
@media(max-width:1100px){.screener-layout{grid-template-columns:1fr}.tag-panel{max-height:none}}
@media(max-width:760px){.screener-page{padding:14px}.page-header{flex-direction:column}.header-actions{width:100%;flex-wrap:wrap}.tag-search{width:100%}.result-toolbar{flex-direction:column}.result-summary{grid-template-columns:1fr}}
</style>
