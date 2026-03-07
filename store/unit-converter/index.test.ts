import { describe, expect, it } from 'bun:test'
import unitConverterPlugin from './index'

const plugin = unitConverterPlugin()
const convert = plugin.tools.convert_units.execute
const listUnits = plugin.tools.list_units.execute

describe('unit-converter', () => {
  describe('convert_units', () => {
    it('converts km to miles', async () => {
      const res = await convert({ value: 10, from: 'km', to: 'miles' }, { toolCallId: '', messages: [] } as any)
      expect(res).toHaveProperty('summary')
      expect((res as any).output.value).toBeCloseTo(6.21371, 3)
    })

    it('converts pounds to kg', async () => {
      const res = await convert({ value: 100, from: 'lbs', to: 'kg' }, { toolCallId: '', messages: [] } as any)
      expect((res as any).output.value).toBeCloseTo(45.3592, 2)
    })

    it('converts Fahrenheit to Celsius', async () => {
      const res = await convert({ value: 212, from: '°F', to: '°C' }, { toolCallId: '', messages: [] } as any)
      expect((res as any).output.value).toBeCloseTo(100, 1)
    })

    it('converts Celsius to Kelvin', async () => {
      const res = await convert({ value: 0, from: 'C', to: 'K' }, { toolCallId: '', messages: [] } as any)
      expect((res as any).output.value).toBeCloseTo(273.15, 2)
    })

    it('converts GB to MB', async () => {
      const res = await convert({ value: 1, from: 'GB', to: 'MB' }, { toolCallId: '', messages: [] } as any)
      expect((res as any).output.value).toBe(1000)
    })

    it('converts GiB to MiB (binary)', async () => {
      const res = await convert({ value: 1, from: 'GiB', to: 'MiB' }, { toolCallId: '', messages: [] } as any)
      expect((res as any).output.value).toBe(1024)
    })

    it('converts hours to seconds', async () => {
      const res = await convert({ value: 2, from: 'hours', to: 'seconds' }, { toolCallId: '', messages: [] } as any)
      expect((res as any).output.value).toBe(7200)
    })

    it('converts atm to psi', async () => {
      const res = await convert({ value: 1, from: 'atm', to: 'psi' }, { toolCallId: '', messages: [] } as any)
      expect((res as any).output.value).toBeCloseTo(14.696, 2)
    })

    it('converts kcal to joules', async () => {
      const res = await convert({ value: 1, from: 'kcal', to: 'J' }, { toolCallId: '', messages: [] } as any)
      expect((res as any).output.value).toBe(4184)
    })

    it('converts hectares to acres', async () => {
      const res = await convert({ value: 1, from: 'ha', to: 'acres' }, { toolCallId: '', messages: [] } as any)
      expect((res as any).output.value).toBeCloseTo(2.47105, 3)
    })

    it('converts liters to cups', async () => {
      const res = await convert({ value: 1, from: 'L', to: 'cups' }, { toolCallId: '', messages: [] } as any)
      expect((res as any).output.value).toBeCloseTo(4.22675, 3)
    })

    it('errors on incompatible categories', async () => {
      const res = await convert({ value: 1, from: 'km', to: 'kg' }, { toolCallId: '', messages: [] } as any)
      expect(res).toHaveProperty('error')
      expect((res as any).error).toContain('Cannot convert')
    })

    it('errors on unknown unit', async () => {
      const res = await convert({ value: 1, from: 'foobar', to: 'km' }, { toolCallId: '', messages: [] } as any)
      expect(res).toHaveProperty('error')
      expect((res as any).error).toContain('Unknown unit')
    })

    it('converts same unit to itself', async () => {
      const res = await convert({ value: 42, from: 'meter', to: 'meters' }, { toolCallId: '', messages: [] } as any)
      expect((res as any).output.value).toBe(42)
    })

    it('converts mph to km/h', async () => {
      const res = await convert({ value: 60, from: 'mph', to: 'km/h' }, { toolCallId: '', messages: [] } as any)
      expect((res as any).output.value).toBeCloseTo(96.5606, 2)
    })
  })

  describe('list_units', () => {
    it('lists all categories', async () => {
      const res = await listUnits({}, { toolCallId: '', messages: [] } as any)
      expect((res as any).categories.length).toBeGreaterThanOrEqual(10)
    })

    it('lists units for a specific category', async () => {
      const res = await listUnits({ category: 'length' }, { toolCallId: '', messages: [] } as any)
      expect((res as any).category).toBe('length')
      expect((res as any).units.length).toBeGreaterThan(5)
    })

    it('lists temperature units', async () => {
      const res = await listUnits({ category: 'temperature' }, { toolCallId: '', messages: [] } as any)
      expect((res as any).units).toHaveLength(3)
    })

    it('errors on unknown category', async () => {
      const res = await listUnits({ category: 'magic' }, { toolCallId: '', messages: [] } as any)
      expect(res).toHaveProperty('error')
    })
  })
})
