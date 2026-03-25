import { describe, it, expect } from 'bun:test'
import { createSequentialLock, wrapToolsSequential } from '@/server/services/sequential-tools'

describe('createSequentialLock', () => {
  it('runs tasks sequentially', async () => {
    const lock = createSequentialLock()
    const order: number[] = []

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

    // Launch 3 tasks concurrently — they should still execute in order
    const p1 = lock.run(async () => {
      await delay(30)
      order.push(1)
      return 'a'
    })
    const p2 = lock.run(async () => {
      await delay(10)
      order.push(2)
      return 'b'
    })
    const p3 = lock.run(async () => {
      order.push(3)
      return 'c'
    })

    const results = await Promise.all([p1, p2, p3])
    expect(results).toEqual(['a', 'b', 'c'])
    expect(order).toEqual([1, 2, 3])
  })

  it('continues running after a rejection', async () => {
    const lock = createSequentialLock()
    const order: number[] = []

    const p1 = lock.run(async () => {
      order.push(1)
      throw new Error('fail')
    })
    const p2 = lock.run(async () => {
      order.push(2)
      return 'ok'
    })

    await expect(p1).rejects.toThrow('fail')
    expect(await p2).toBe('ok')
    expect(order).toEqual([1, 2])
  })
})

describe('wrapToolsSequential', () => {
  it('wraps tool execute functions to run sequentially', async () => {
    const order: string[] = []
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

    const tools: Record<string, any> = {
      tool_a: {
        description: 'Tool A',
        parameters: {},
        execute: async () => {
          await delay(30)
          order.push('a')
          return 'result_a'
        },
      },
      tool_b: {
        description: 'Tool B',
        parameters: {},
        execute: async () => {
          await delay(10)
          order.push('b')
          return 'result_b'
        },
      },
    }

    const wrapped = wrapToolsSequential(tools)

    // Simulate parallel execution (as the AI SDK does)
    const [ra, rb] = await Promise.all([
      wrapped.tool_a!.execute!({}, {} as any),
      wrapped.tool_b!.execute!({}, {} as any),
    ])

    expect(ra).toBe('result_a')
    expect(rb).toBe('result_b')
    // tool_a started first, so it should finish first despite taking longer
    expect(order).toEqual(['a', 'b'])
  })

  it('passes through tools without execute', () => {
    const noExecTool = { description: 'no exec', parameters: {} as any } as any
    const wrapped = wrapToolsSequential({ no_exec: noExecTool })
    expect(wrapped.no_exec).toBe(noExecTool)
  })

  it('preserves tool properties', () => {
    const tool: any = {
      description: 'test',
      parameters: { type: 'object' },
      execute: async () => 'hello',
    }
    const wrapped = wrapToolsSequential({ test: tool })
    expect(wrapped.test!.description).toBe('test')
    // execute should be a different function (wrapped)
    expect(wrapped.test!.execute).not.toBe(tool.execute)
  })
})
