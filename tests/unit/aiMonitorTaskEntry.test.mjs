import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(
  new URL('../../src/views/ai-analysis/components/CopilotWorkbench.vue', import.meta.url),
  'utf8'
)

test('scheduled analysis panel exposes a manual create action', () => {
  assert.match(
    source,
    /class="panel-head-actions"[\s\S]*?@click="openTaskModal\(\)"[\s\S]*?text\.newTask/
  )
  assert.match(source, /newTask: t\('newTask', this\.isZh \? '新建任务'/)
})

test('manual task modal collects and persists focus conditions', () => {
  assert.match(source, /v-model="taskForm\.focus_conditions"/)
  assert.match(source, /focusConditionsPlaceholder/)
  assert.match(
    source,
    /const focusConditions = String\(this\.taskForm\.focus_conditions \|\| ''\)\.trim\(\)[\s\S]*?focus_conditions: focusConditions,[\s\S]*?prompt: focusConditions/
  )
})

test('streamed monitor actions are preserved and deduplicated alongside usage', () => {
  assert.match(
    source,
    /const incoming = \(Array\.isArray\(actions\) \? actions : \[\]\)\.filter\(action => action && action\.type !== 'agent_usage'\)/
  )
  assert.match(
    source,
    /const merged = \[\.\.\.current, \.\.\.incoming\]\.reduce/
  )
  assert.match(
    source,
    /action\.type === 'create_monitor_task'[\s\S]*?this\.openTaskModal\([\s\S]*?action\.payload \|\| \{\}\)/
  )
})

test('monitor action opens a prefilled confirmation modal before writing', () => {
  assert.match(
    source,
    /openTaskModal \(item, payload = \{\}\) \{[\s\S]*?interval_min: Number\(payload\.interval_min \|\| payload\.interval \|\| 240\)[\s\S]*?notify_channels: this\.normalizeMonitorChannels\(payload\.notify_channels \|\| payload\.channels \|\| \[\]\)[\s\S]*?taskModalVisible = true/
  )
  assert.match(
    source,
    /const focusConditions = String\(payload\.focus_conditions \|\| payload\.prompt \|\| ''\)\.trim\(\)/
  )
  assert.match(
    source,
    /config: \{[\s\S]*?focus_conditions: focusConditions,[\s\S]*?prompt: focusConditions/
  )
})
