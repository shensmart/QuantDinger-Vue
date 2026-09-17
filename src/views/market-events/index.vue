<template>
  <div class="events-page" :class="{ 'theme-dark': isDarkTheme }">
    <header class="page-header">
      <div>
        <span class="kicker">{{ t('marketEvents.kicker') }}</span>
        <h1>{{ t('marketEvents.title') }}</h1>
        <p>{{ t('marketEvents.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <a-date-picker v-model="tradeDate" :allowClear="false" @change="reload" />
        <a-button icon="reload" :loading="loading" @click="reload">{{ t('marketEvents.reload') }}</a-button>
      </div>
    </header>

    <a-alert
      v-if="errorMessage"
      class="degrade-alert"
      type="warning"
      showIcon
      :message="errorMessage" />

    <section class="workspace-card">
      <a-tabs v-model="activeTab" @change="loadActiveTab">
        <a-tab-pane key="limitUp">
          <span slot="tab"><a-icon type="rise" />{{ t('marketEvents.tabs.limitUp') }}</span>
        </a-tab-pane>
        <a-tab-pane key="ladder">
          <span slot="tab"><a-icon type="bar-chart" />{{ t('marketEvents.tabs.ladder') }}</span>
        </a-tab-pane>
        <a-tab-pane key="dragonTiger">
          <span slot="tab"><a-icon type="crown" />{{ t('marketEvents.tabs.dragonTiger') }}</span>
        </a-tab-pane>
        <a-tab-pane key="hotList">
          <span slot="tab"><a-icon type="fire" />{{ t('marketEvents.tabs.hotList') }}</span>
        </a-tab-pane>
        <a-tab-pane key="anomaly">
          <span slot="tab"><a-icon type="alert" />{{ t('marketEvents.tabs.anomaly') }}</span>
        </a-tab-pane>
      </a-tabs>

      <div class="toolbar">
        <a-input-search v-model="keyword" allowClear :placeholder="t('marketEvents.search')" />
        <a-select v-if="activeTab === 'dragonTiger'" v-model="boardType" @change="loadActiveTab">
          <a-select-option value="all">{{ t('marketEvents.board.all') }}</a-select-option>
          <a-select-option value="org">{{ t('marketEvents.board.org') }}</a-select-option>
          <a-select-option value="hot_money">{{ t('marketEvents.board.hotMoney') }}</a-select-option>
        </a-select>
        <a-select v-model="sortField" @change="applySort">
          <a-select-option v-for="option in sortOptions" :key="option.value" :value="option.value">{{ option.label }}</a-select-option>
        </a-select>
      </div>

      <a-spin :spinning="loading">
        <a-empty v-if="!visibleRows.length" :description="t('marketEvents.empty')" />
        <div v-else class="table-wrap">
          <table class="event-table">
            <thead>
              <tr>
                <th>{{ t('marketEvents.columns.rank') }}</th>
                <th>{{ t('marketEvents.columns.symbol') }}</th>
                <th>{{ t('marketEvents.columns.name') }}</th>
                <th v-for="column in extraColumns" :key="column.key">{{ column.title }}</th>
                <th>{{ t('marketEvents.columns.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in pagedRows" :key="row.symbol + row.event_type + index">
                <td>{{ row.rank === null || row.rank === undefined ? '-' : row.rank }}</td>
                <td class="mono">{{ row.symbol }}</td>
                <td>{{ row.name || '-' }}</td>
                <td v-for="column in extraColumns" :key="column.key">
                  {{ formatCell(row, column) }}
                </td>
                <td class="row-actions">
                  <a-button size="small" @click="addToWatchlist(row)">{{ t('marketEvents.watch') }}</a-button>
                  <a-button size="small" type="link" @click="createUniverse(row)">{{ t('marketEvents.createUniverse') }}</a-button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <a-pagination
          v-if="filteredRows.length > pageSize"
          class="pagination"
          :current="page"
          :pageSize="pageSize"
          :total="filteredRows.length"
          showSizeChanger
          @change="onPageChange" />
      </a-spin>
    </section>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import {
  getAnomalyList,
  getDragonTiger,
  getHotList,
  getLimitUpLadder,
  getLimitUpPool
} from '@/api/market-events'
import { addWatchlist } from '@/api/market'

const COLUMNS = {
  limitUp: [
    { key: 'last_price', title: 'marketEvents.columns.price' },
    { key: 'price_change_ratio_pct', title: 'marketEvents.columns.change' },
    { key: 'limit_up_time', title: 'marketEvents.columns.limitUpTime' },
    { key: 'continue_day_text', title: 'marketEvents.columns.boards' },
    { key: 'seal_money', title: 'marketEvents.columns.sealMoney', money: true },
    { key: 'limit_up_reason', title: 'marketEvents.columns.reason' }
  ],
  ladder: [
    { key: 'board', title: 'marketEvents.columns.board' },
    { key: 'board_num', title: 'marketEvents.columns.boards' }
  ],
  dragonTiger: [
    { key: 'net_value', title: 'marketEvents.columns.netBuy', money: true },
    { key: 'net_rate', title: 'marketEvents.columns.netRate', percent: true },
    { key: 'buy_value', title: 'marketEvents.columns.buyValue', money: true },
    { key: 'limit_reason', title: 'marketEvents.columns.reason' }
  ],
  hotList: [
    { key: 'rank', title: 'marketEvents.columns.hotRank' },
    { key: 'heat', title: 'marketEvents.columns.heat' },
    { key: 'rank_change', title: 'marketEvents.columns.rankChange' }
  ],
  anomaly: [
    { key: 'tag_name', title: 'marketEvents.columns.tag' },
    { key: 'analysis_content', title: 'marketEvents.columns.analysis' }
  ]
}

export default {
  name: 'MarketEvents',
  data () {
    return {
      activeTab: 'limitUp',
      loading: false,
      errorMessage: '',
      keyword: '',
      boardType: 'all',
      sortField: 'rank',
      tradeDate: null,
      rows: [],
      page: 1,
      pageSize: 50
    }
  },
  computed: {
    ...mapState({ navTheme: state => state.app.theme }),
    isDarkTheme () { return ['dark', 'realdark'].includes(this.navTheme) },
    extraColumns () {
      const columns = COLUMNS[this.activeTab] || []
      return columns.map(column => ({ ...column, title: this.t(column.title) }))
    },
    sortOptions () {
      if (this.activeTab === 'hotList') {
        return [
          { value: 'rank', label: this.t('marketEvents.columns.hotRank') },
          { value: 'name', label: this.t('marketEvents.columns.name') }
        ]
      }
      if (this.activeTab === 'limitUp') {
        return [
          { value: 'rank', label: this.t('marketEvents.columns.boards') },
          { value: 'score', label: this.t('marketEvents.columns.sealMoney') },
          { value: 'time', label: this.t('marketEvents.columns.limitUpTime') }
        ]
      }
      return [
        { value: 'rank', label: this.t('marketEvents.columns.rank') },
        { value: 'score', label: this.t('marketEvents.columns.amount') }
      ]
    },
    filteredRows () {
      const keyword = this.keyword.trim().toLowerCase()
      const rows = this.rows.slice()
      if (keyword) {
        return rows.filter(row => `${row.symbol} ${row.name || ''}`.toLowerCase().includes(keyword))
      }
      return rows
    },
    sortedRows () {
      const rows = this.filteredRows.slice()
      const field = this.sortField
      rows.sort((left, right) => {
        if (field === 'name') return String(left.name || '').localeCompare(String(right.name || ''))
        if (field === 'time') {
          return String(this.payloadValue(left, 'limit_up_time') || '').localeCompare(String(this.payloadValue(right, 'limit_up_time') || ''))
        }
        const leftValue = field === 'score' ? Number(left.score) : Number(left.rank)
        const rightValue = field === 'score' ? Number(right.score) : Number(right.rank)
        if (Number.isNaN(leftValue) && Number.isNaN(rightValue)) return 0
        if (Number.isNaN(leftValue)) return 1
        if (Number.isNaN(rightValue)) return -1
        return field === 'score' ? rightValue - leftValue : leftValue - rightValue
      })
      return rows
    },
    pagedRows () {
      const start = (this.page - 1) * this.pageSize
      return this.sortedRows.slice(start, start + this.pageSize)
    },
    visibleRows () { return this.sortedRows }
  },
  watch: {
    keyword () { this.page = 1 }
  },
  mounted () { this.loadActiveTab() },
  methods: {
    t (key) { return this.$t(key) },
    unwrap (res) { return res && Object.prototype.hasOwnProperty.call(res, 'data') ? res.data : res },
    payloadValue (row, key) {
      const payload = row.payload_json && typeof row.payload_json === 'object' ? row.payload_json : {}
      if (payload[key] !== undefined && payload[key] !== null) return payload[key]
      if (row[key] !== undefined && row[key] !== null) return row[key]
      return '-'
    },
    formatCell (row, column) {
      const value = this.payloadValue(row, column.key)
      if (value === '-' || value === null || value === undefined) return '-'
      if (column.money) return this.formatMoney(value)
      if (column.percent) return `${(Number(value) * 100).toFixed(2)}%`
      return value
    },
    formatMoney (value) {
      const amount = Number(value)
      if (Number.isNaN(amount)) return '-'
      if (Math.abs(amount) >= 1e8) return `${(amount / 1e8).toFixed(2)}${this.t('marketEvents.units.yi')}`
      if (Math.abs(amount) >= 1e4) return `${(amount / 1e4).toFixed(2)}${this.t('marketEvents.units.wan')}`
      return amount.toFixed(2)
    },
    onPageChange (page, pageSize) { this.page = page; this.pageSize = pageSize },
    applySort () { this.page = 1 },
    async loadActiveTab () {
      this.loading = true
      this.errorMessage = ''
      this.page = 1
      const params = { limit: 500 }
      if (this.tradeDate && this.tradeDate.format) {
        params.trade_date = this.tradeDate.format('YYYY-MM-DD')
      }
      try {
        let response
        if (this.activeTab === 'limitUp') response = await getLimitUpPool(params)
        else if (this.activeTab === 'ladder') response = await getLimitUpLadder(params)
        else if (this.activeTab === 'dragonTiger') response = await getDragonTiger({ ...params, board_type: this.boardType })
        else if (this.activeTab === 'hotList') response = await getHotList({ ...params, limit: 30 })
        else response = await getAnomalyList(params)
        const payload = this.unwrap(response) || {}
        this.rows = payload.items || []
        if (!this.rows.length) {
          this.errorMessage = this.t('marketEvents.emptyHint')
        }
      } catch (error) {
        this.rows = []
        this.errorMessage = error.backendMessage || error.message || this.t('marketEvents.loadFailed')
      } finally {
        this.loading = false
      }
    },
    reload () { this.loadActiveTab() },
    async addToWatchlist (row) {
      try {
        await addWatchlist({ market: 'CNStock', symbol: row.symbol })
        this.$message.success(this.t('marketEvents.watchAdded'))
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.t('marketEvents.watchFailed'))
      }
    },
    createUniverse (row) {
      this.$router.push({
        path: '/universe-manager',
        query: { seedSymbol: row.symbol, seedMarket: 'CNStock' }
      })
    }
  }
}
</script>

<style lang="less" scoped>
.events-page{min-height:calc(100vh - 64px);padding:20px;background:#f4f6f8;color:#1f2933}
.page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:16px}
.kicker{color:#52c41a;font-size:12px;font-weight:800;text-transform:uppercase}
.page-header h1{margin:3px 0 4px;font-size:28px}
.page-header p{margin:0;color:#667085}
.header-actions{display:flex;gap:8px}
.degrade-alert{margin-bottom:12px}
.workspace-card{min-height:480px;padding:0 18px 18px;border:1px solid #e5e7eb;border-radius:10px;background:#fff}
.toolbar{display:flex;gap:10px;margin:14px 0}
.toolbar .ant-input-search{max-width:360px}
.toolbar .ant-select{width:180px}
.table-wrap{overflow:auto;border:1px solid #e5e7eb;border-radius:8px}
.event-table{width:100%;border-collapse:collapse}
.event-table th,.event-table td{padding:10px 12px;border-bottom:1px solid #edf0f3;text-align:left}
.event-table th{background:#f7f8fa;color:#667085;font-size:12px}
.mono{font-family:Menlo,Consolas,monospace}
.row-actions{white-space:nowrap}
.pagination{margin-top:14px;text-align:right}
.theme-dark{background:#0b0b0b;color:#f5f5f5}
.theme-dark h1{color:#f5f5f5}
.theme-dark .workspace-card{border-color:#2b2b2b;background:#151515}
.theme-dark .page-header p{color:#a7a7a7}
.theme-dark .table-wrap{border-color:#303030}
.theme-dark .event-table th{background:#1d1d1d}
.theme-dark .event-table th,.theme-dark .event-table td{border-color:#303030}
@media(max-width:760px){.events-page{padding:14px}.page-header{flex-direction:column}.toolbar{flex-direction:column}.toolbar .ant-input-search,.toolbar .ant-select{width:100%;max-width:none}}
</style>
