import { describe, it, expect } from 'bun:test'
import {
  TASK_STATUS_META,
  taskStatusMeta,
  isExecutingStatus,
  isSuspendedStatus,
  isQueuedStatus,
  isTerminalStatus,
  isActiveStatus,
  isLiveStatus,
} from '@/client/lib/task-status'
import type { TaskStatus } from '@/shared/types'

// The full TaskStatus union, restated locally so this test is fully
// self-contained — it imports only the pure SoT module (no React, no mockable
// dependencies), so cross-file mock.module pollution cannot affect it.
const ALL_STATUSES: TaskStatus[] = [
  'queued',
  'pending',
  'in_progress',
  'paused',
  'awaiting_human_input',
  'awaiting_kin_response',
  'awaiting_subtask',
  'completed',
  'failed',
  'cancelled',
]

describe('TASK_STATUS_META (single source of truth)', () => {
  it('has an entry for every TaskStatus', () => {
    for (const status of ALL_STATUSES) {
      expect(TASK_STATUS_META[status]).toBeDefined()
    }
    expect(Object.keys(TASK_STATUS_META).sort()).toEqual([...ALL_STATUSES].sort())
  })

  it('every label key is namespaced under sidebar.tasks.status', () => {
    for (const status of ALL_STATUSES) {
      expect(taskStatusMeta(status).labelKey).toBe(`sidebar.tasks.status.${status}`)
    }
  })

  it('encodes the validated semantic color map via tokens (no raw hues)', () => {
    const expected: Record<TaskStatus, string> = {
      in_progress: 'text-primary',
      pending: 'text-primary',
      queued: 'text-queued',
      paused: 'text-paused',
      awaiting_human_input: 'text-warning',
      awaiting_kin_response: 'text-info',
      awaiting_subtask: 'text-info',
      completed: 'text-success',
      failed: 'text-destructive',
      cancelled: 'text-muted-foreground',
    }
    for (const status of ALL_STATUSES) {
      expect(taskStatusMeta(status).textClass).toBe(expected[status])
    }
  })

  it('never uses raw orange/amber Tailwind hues anywhere in the meta', () => {
    const blob = JSON.stringify(
      ALL_STATUSES.map((s) => {
        const { icon, ...rest } = taskStatusMeta(s)
        return rest
      }),
    )
    expect(blob).not.toMatch(/orange-\d/)
    expect(blob).not.toMatch(/amber-\d/)
  })

  it('only in_progress + the awaiting_* statuses pulse', () => {
    const pulsing = ALL_STATUSES.filter((s) => taskStatusMeta(s).pulse)
    const expected: TaskStatus[] = [
      'awaiting_human_input',
      'awaiting_kin_response',
      'awaiting_subtask',
      'in_progress',
    ]
    expect(pulsing.sort()).toEqual(expected.sort())
  })
})

describe('lifecycle group predicates', () => {
  it('assigns each status to exactly one group', () => {
    for (const status of ALL_STATUSES) {
      const inGroups = [
        isExecutingStatus(status),
        isSuspendedStatus(status),
        isQueuedStatus(status),
        isTerminalStatus(status),
      ].filter(Boolean)
      expect(inGroups.length).toBe(1)
    }
  })

  it('executing = {pending, in_progress}', () => {
    const expected: TaskStatus[] = ['in_progress', 'pending']
    expect(ALL_STATUSES.filter(isExecutingStatus).sort()).toEqual(expected.sort())
  })

  it('suspended = {paused, awaiting_*}', () => {
    const expected: TaskStatus[] = [
      'awaiting_human_input',
      'awaiting_kin_response',
      'awaiting_subtask',
      'paused',
    ]
    expect(ALL_STATUSES.filter(isSuspendedStatus).sort()).toEqual(expected.sort())
  })

  it('queued = {queued}', () => {
    const expected: TaskStatus[] = ['queued']
    expect(ALL_STATUSES.filter(isQueuedStatus)).toEqual(expected)
  })

  it('terminal = {completed, failed, cancelled}', () => {
    const expected: TaskStatus[] = ['cancelled', 'completed', 'failed']
    expect(ALL_STATUSES.filter(isTerminalStatus).sort()).toEqual(expected.sort())
  })

  it('isActiveStatus = executing OR suspended (not queued, not terminal)', () => {
    for (const status of ALL_STATUSES) {
      expect(isActiveStatus(status)).toBe(isExecutingStatus(status) || isSuspendedStatus(status))
    }
    expect(isActiveStatus('queued')).toBe(false)
    expect(isActiveStatus('completed')).toBe(false)
  })

  it('isLiveStatus = anything not terminal', () => {
    for (const status of ALL_STATUSES) {
      expect(isLiveStatus(status)).toBe(!isTerminalStatus(status))
    }
  })
})
