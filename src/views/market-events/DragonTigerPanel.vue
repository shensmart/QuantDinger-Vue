<template>
  <div class="lhb">
    <a-tabs v-model="activeSection" size="small" @change="loadActive">
      <a-tab-pane key="daily">
        <span slot="tab">{{ t('dragonTiger.sections.daily') }}</span>
      </a-tab-pane>
      <a-tab-pane key="institutions">
        <span slot="tab">{{ t('dragonTiger.sections.institutions') }}</span>
      </a-tab-pane>
      <a-tab-pane key="branches">
        <span slot="tab">{{ t('dragonTiger.sections.branches') }}</span>
      </a-tab-pane>
      <a-tab-pane key="statistics">
        <span slot="tab">{{ t('dragonTiger.sections.statistics') }}</span>
      </a-tab-pane>
      <a-tab-pane key="seatTracking">
        <span slot="tab">{{ t('dragonTiger.sections.seatTracking') }}</span>
      </a-tab-pane>
      <a-tab-pane key="branchRanking">
        <span slot="tab">{{ t('dragonTiger.sections.branchRanking') }}</span>
      </a-tab-pane>
    </a-tabs>

    <div class="sub-toolbar">
      <a-radio-group v-if="needsWindow" v-model="window" size="small" button-style="solid" @change="loadActive">
        <a-radio-button v-for="item in windows" :key="item" :value="item">{{ item }}</a-radio-button>
      </a-radio-group>
      <span v-else class="hint">{{ t('dragonTiger.clickRowHint') }}</span>
      <a-input-search
        v-model="keyword"
        allowClear
        size="small"
        :placeholder="t('dragonTiger.search')" />
      <a-select v-if="sorts.length" v-model="sortKey" size="small" @change="page = 1">
        <a-select-option v-for="item in sorts" :key="item.key" :value="item.key">{{ item.label }}</a-select-option>
      </a-select>
    </div>

    <a-spin :spinning="loading">
      <a-empty v-if="!rows.length" :description="t('dragonTiger.empty')" />
      <div v-else class="table-wrap">
        <table class="lhb-table">
          <thead>
            <tr>
              <th v-for="column in columns" :key="column.key" :class="column.align">{{ column.title }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in pagedRows" :key="rowKey(row, index)">
              <td v-for="column in columns" :key="column.key" :class="column.align">
                <a v-if="column.link" class="link" @click="openDetail(row)">{{ cell(row, column) }}</a>
                <span v-else :class="{ num: column.numeric, up: column.signed && num(row[column.key]) > 0, down: column.signed && num(row[column.key]) < 0 }">
                  {{ cell(row, column) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <a-pagination
        v-if="filteredRows.length > pageSize"
        class="lhb-pagination"
        :current="page"
        :pageSize="pageSize"
        :total="filteredRows.length"
        showSizeChanger
        :pageSizeOptions="['25', '50', '100']"
        @change="onPageChange" />
    </a-spin>

    <a-modal v-model="detailVisible" :title="detailTitle" :footer="null" width="720px">
      <div v-if="detailPending" class="detail-loading"><a-spin /></div>
      <table v-else class="lhb-table detail-table">
        <thead>
          <tr><th>{{ t('dragonTiger.detail.reason') }}</th><th class="align-right">{{ t('dragonTiger.columns.netBuy') }}</th><th class="align-right">{{ t('dragonTiger.columns.buy') }}</th><th class="align-right">{{ t('dragonTiger.columns.sell') }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in detailRows" :key="index">
            <td>{{ item.reason || '-' }}</td>
            <td class="align-right num" :class="{ up: num(item.net_buy) > 0, down: num(item.net_buy) < 0 }">{{ money(item.net_buy) }}</td>
            <td class="align-right num">{{ money(item.buy_amount) }}</td>
            <td class="align-right num">{{ money(item.sell_amount) }}</td>
          </tr>
        </tbody>
      </table>
    </a-modal>
  </div>
</template>

<script>
import {
  getDragonTigerBranches,
  getDragonTigerBranchRanking,
  getDragonTigerDaily,
  getDragonTigerInstitutions,
  getDragonTigerSeatTracking,
  getDragonTigerStatistics
} from '@/api/dragon-tiger'

const MONEY = 'money'
const PCT = 'pct'
const NUM = 'num'

export default {
  name: 'DragonTigerBoard',
  data () {
    return {
      activeSection: 'daily',
      window: '近一月',
      windows: ['近一月', '近三月', '近六月', '近一年'],
      loading: false,
      keyword: '',
      sortKey: '',
      rows: [],
      page: 1,
      pageSize: 50,
      detailVisible: false,
      detailPending: false,
      detailRows: [],
      detailTitle: ''
    }
  },
  computed: {
    needsWindow () { return ['statistics', 'seatTracking', 'branchRanking'].includes(this.activeSection) },
    columns () {
      const t = this.t
      const money = value => this.money(value)
      const pct = value => this.pct(value)
      if (this.activeSection === 'daily') {
        return [
          { key: 'code', title: t('dragonTiger.columns.code'), link: true },
          { key: 'name', title: t('dragonTiger.columns.name') },
          { key: 'change_pct', title: t('dragonTiger.columns.change'), align: 'align-right', numeric: true, signed: true, format: pct },
          { key: 'net_buy', title: t('dragonTiger.columns.netBuy'), align: 'align-right', numeric: true, signed: true, format: money },
          { key: 'buy_amount', title: t('dragonTiger.columns.buy'), align: 'align-right', numeric: true, format: money },
          { key: 'sell_amount', title: t('dragonTiger.columns.sell'), align: 'align-right', numeric: true, format: money },
          { key: 'total_amount', title: t('dragonTiger.columns.boardAmount'), align: 'align-right', numeric: true, format: money },
          { key: 'net_ratio', title: t('dragonTiger.columns.netRatio'), align: 'align-right', numeric: true, signed: true, format: pct },
          { key: 'turnover_ratio', title: t('dragonTiger.columns.turnover'), align: 'align-right', numeric: true, format: pct },
          { key: 'explanation', title: t('dragonTiger.columns.explanation') },
          { key: 'reason', title: t('dragonTiger.columns.reason') }
        ]
      }
      if (this.activeSection === 'institutions') {
        return [
          { key: 'code', title: t('dragonTiger.columns.code') },
          { key: 'name', title: t('dragonTiger.columns.name') },
          { key: 'change_pct', title: t('dragonTiger.columns.change'), align: 'align-right', numeric: true, signed: true, format: pct },
          { key: 'buy_seats', title: t('dragonTiger.columns.buySeats'), align: 'align-right', numeric: true, format: NUM },
          { key: 'sell_seats', title: t('dragonTiger.columns.sellSeats'), align: 'align-right', numeric: true, format: NUM },
          { key: 'org_buy', title: t('dragonTiger.columns.orgBuy'), align: 'align-right', numeric: true, format: money },
          { key: 'org_sell', title: t('dragonTiger.columns.orgSell'), align: 'align-right', numeric: true, format: money },
          { key: 'org_net', title: t('dragonTiger.columns.orgNet'), align: 'align-right', numeric: true, signed: true, format: money },
          { key: 'org_net_ratio', title: t('dragonTiger.columns.orgNetRatio'), align: 'align-right', numeric: true, signed: true, format: pct },
          { key: 'reason', title: t('dragonTiger.columns.reason') }
        ]
      }
      if (this.activeSection === 'branches') {
        return [
          { key: 'branch', title: t('dragonTiger.columns.branch') },
          { key: 'buy_stocks', title: t('dragonTiger.columns.buyStocks'), align: 'align-right', numeric: true, format: NUM },
          { key: 'sell_stocks', title: t('dragonTiger.columns.sellStocks'), align: 'align-right', numeric: true, format: NUM },
          { key: 'buy_amount', title: t('dragonTiger.columns.buy'), align: 'align-right', numeric: true, format: money },
          { key: 'sell_amount', title: t('dragonTiger.columns.sell'), align: 'align-right', numeric: true, format: money },
          { key: 'net_amount', title: t('dragonTiger.columns.netAmount'), align: 'align-right', numeric: true, signed: true, format: money },
          { key: 'stocks', title: t('dragonTiger.columns.investedStocks'), format: value => (Array.isArray(value) ? value.join(' ') : value) }
        ]
      }
      if (this.activeSection === 'statistics') {
        return [
          { key: 'code', title: t('dragonTiger.columns.code') },
          { key: 'name', title: t('dragonTiger.columns.name') },
          { key: 'last_listed', title: t('dragonTiger.columns.lastListed') },
          { key: 'list_count', title: t('dragonTiger.columns.listCount'), align: 'align-right', numeric: true, format: NUM },
          { key: 'net_buy', title: t('dragonTiger.columns.netBuy'), align: 'align-right', numeric: true, signed: true, format: money },
          { key: 'buy_amount', title: t('dragonTiger.columns.buy'), align: 'align-right', numeric: true, format: money },
          { key: 'total_amount', title: t('dragonTiger.columns.boardAmount'), align: 'align-right', numeric: true, format: money },
          { key: 'org_net', title: t('dragonTiger.columns.orgNet'), align: 'align-right', numeric: true, signed: true, format: money },
          { key: 'return_1m', title: t('dragonTiger.columns.return1m'), align: 'align-right', numeric: true, signed: true, format: pct }
        ]
      }
      if (this.activeSection === 'seatTracking') {
        return [
          { key: 'code', title: t('dragonTiger.columns.code') },
          { key: 'name', title: t('dragonTiger.columns.name') },
          { key: 'total_amount', title: t('dragonTiger.columns.boardAmount'), align: 'align-right', numeric: true, format: money },
          { key: 'list_count', title: t('dragonTiger.columns.listCount'), align: 'align-right', numeric: true, format: NUM },
          { key: 'org_buy', title: t('dragonTiger.columns.orgBuy'), align: 'align-right', numeric: true, format: money },
          { key: 'org_buy_count', title: t('dragonTiger.columns.buyTimes'), align: 'align-right', numeric: true, format: NUM },
          { key: 'org_sell', title: t('dragonTiger.columns.orgSell'), align: 'align-right', numeric: true, format: money },
          { key: 'org_sell_count', title: t('dragonTiger.columns.sellTimes'), align: 'align-right', numeric: true, format: NUM },
          { key: 'org_net', title: t('dragonTiger.columns.orgNet'), align: 'align-right', numeric: true, signed: true, format: money }
        ]
      }
      return [
        { key: 'branch', title: t('dragonTiger.columns.branch') },
        { key: 'total_amount', title: t('dragonTiger.columns.boardAmount'), align: 'align-right', numeric: true, format: money },
        { key: 'list_count', title: t('dragonTiger.columns.listCount'), align: 'align-right', numeric: true, format: NUM },
        { key: 'buy_amount', title: t('dragonTiger.columns.buy'), align: 'align-right', numeric: true, format: money },
        { key: 'buy_count', title: t('dragonTiger.columns.buyTimes'), align: 'align-right', numeric: true, format: NUM },
        { key: 'sell_amount', title: t('dragonTiger.columns.sell'), align: 'align-right', numeric: true, format: money },
        { key: 'sell_count', title: t('dragonTiger.columns.sellTimes'), align: 'align-right', numeric: true, format: NUM }
      ]
    },
    sorts () {
      const t = this.t
      if (this.activeSection === 'daily') {
        return [
          { key: '', label: t('dragonTiger.sort.default') },
          { key: 'net_buy', label: t('dragonTiger.columns.netBuy') },
          { key: 'change_pct', label: t('dragonTiger.columns.change') }
        ]
      }
      if (this.activeSection === 'institutions') {
        return [
          { key: '', label: t('dragonTiger.sort.default') },
          { key: 'org_net', label: t('dragonTiger.columns.orgNet') }
        ]
      }
      if (this.activeSection === 'branches' || this.activeSection === 'branchRanking') {
        return [
          { key: '', label: t('dragonTiger.sort.default') },
          { key: 'net_amount', label: t('dragonTiger.columns.netAmount') }
        ]
      }
      return [
        { key: '', label: t('dragonTiger.sort.default') },
        { key: 'net_buy', label: t('dragonTiger.columns.netBuy') },
        { key: 'org_net', label: t('dragonTiger.columns.orgNet') }
      ]
    },
    filteredRows () {
      const keyword = this.keyword.trim().toLowerCase()
      let rows = this.rows
      if (keyword) {
        rows = rows.filter(row => `${row.code || ''} ${row.name || ''} ${row.branch || ''} ${row.reason || ''}`.toLowerCase().includes(keyword))
      }
      if (this.sortKey) {
        const key = this.sortKey
        rows = rows.slice().sort((a, b) => this.num(b[key]) - this.num(a[key]))
      }
      return rows
    },
    pagedRows () {
      const start = (this.page - 1) * this.pageSize
      return this.filteredRows.slice(start, start + this.pageSize)
    }
  },
  watch: {
    keyword () { this.page = 1 }
  },
  mounted () { this.loadActive() },
  methods: {
    t (key) { return this.$t(key) },
    unwrap (res) { return res && Object.prototype.hasOwnProperty.call(res, 'data') ? res.data : res },
    num (value) { const n = Number(value); return Number.isFinite(n) ? n : 0 },
    money (value) {
      const n = Number(value)
      if (!Number.isFinite(n)) return '-'
      const sign = n < 0 ? '-' : ''
      const abs = Math.abs(n)
      if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}${this.t('dragonTiger.units.yi')}`
      if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(2)}${this.t('dragonTiger.units.wan')}`
      return `${sign}${abs.toFixed(2)}`
    },
    pct (value) {
      const n = Number(value)
      return Number.isFinite(n) ? `${n.toFixed(2)}%` : '-'
    },
    cell (row, column) {
      const value = row[column.key]
      if (column.format && column.format !== MONEY && column.format !== PCT && column.format !== NUM) {
        return column.format(value)
      }
      if (value === null || value === undefined || value === '') return '-'
      return value
    },
    rowKey (row, index) { return `${row.code || row.branch || index}-${index}` },
    onPageChange (page, pageSize) { this.page = page; this.pageSize = pageSize },
    async loadActive () {
      this.loading = true
      this.page = 1
      const tradeDate = this.$parent && this.$parent.tradeDateString ? this.$parent.tradeDateString() : undefined
      try {
        let response
        if (this.activeSection === 'daily') response = await getDragonTigerDaily({ trade_date: tradeDate, limit: 1000 })
        else if (this.activeSection === 'institutions') response = await getDragonTigerInstitutions({ trade_date: tradeDate, limit: 1000 })
        else if (this.activeSection === 'branches') response = await getDragonTigerBranches({ trade_date: tradeDate, limit: 1000 })
        else if (this.activeSection === 'statistics') response = await getDragonTigerStatistics({ window: this.window, limit: 2000 })
        else if (this.activeSection === 'seatTracking') response = await getDragonTigerSeatTracking({ window: this.window, limit: 2000 })
        else response = await getDragonTigerBranchRanking({ window: this.window, limit: 2000 })
        this.rows = (this.unwrap(response) || {}).items || []
      } catch (error) {
        this.rows = []
        this.$emit('degrade', this.t('dragonTiger.loadFailed'))
      } finally {
        this.loading = false
      }
    },
    async openDetail (row) {
      this.detailTitle = `${row.code || ''} ${row.name || ''}`.trim()
      this.detailRows = []
      this.detailVisible = true
      this.detailPending = true
      try {
        const response = await getDragonTigerDaily({ trade_date: row.trade_date, limit: 1000 })
        const items = (this.unwrap(response) || {}).items || []
        this.detailRows = items.filter(item => item.code === row.code)
      } catch (error) {
        this.detailRows = []
      } finally {
        this.detailPending = false
      }
    }
  }
}
</script>

<style lang="less" scoped>
.sub-toolbar{display:flex;align-items:center;gap:10px;margin:12px 0}
.sub-toolbar .ant-input-search{max-width:280px;margin-left:auto}
.sub-toolbar .ant-select{width:150px}
.hint{color:#98a2b3;font-size:12px}
.table-wrap{overflow:auto;border:1px solid #e5e7eb;border-radius:8px}
.lhb-table{width:100%;border-collapse:collapse;font-size:13px}
.lhb-table th,.lhb-table td{padding:8px 10px;border-bottom:1px solid #edf0f3;text-align:left;white-space:nowrap}
.lhb-table th{background:#f7f8fa;color:#667085;font-size:12px;font-weight:600}
.lhb-table tbody tr:hover{background:#fafbfc}
.align-right{text-align:right}
.num{font-variant-numeric:tabular-nums}
.up{color:#e5484d}
.down{color:#30a46c}
.link{color:#1677ff;cursor:pointer}
.lhb-pagination{margin-top:12px;text-align:right}
.detail-table td{white-space:normal}
.detail-loading{padding:40px;text-align:center}
</style>
