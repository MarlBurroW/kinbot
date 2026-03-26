import { describe, expect, it } from 'bun:test'
import unitConverterPlugin from './index'

const plugin = unitConverterPlugin()
const convert = plugin.tools.convert_units.execute
const listUnits = plugin.tools.list_units.execute
const ctx = { toolCallId: '', messages: [] } as any

// ─── convert_units ──────────────────────────────────────────────────────────

describe('unit-converter', () => {
  describe('convert_units', () => {
    // ── Length ──────────────────────────────────────────────────────────

    it('converts km to miles', async () => {
      const res = await convert({ value: 10, from: 'km', to: 'miles' }, ctx)
      expect(res).toHaveProperty('summary')
      expect((res as any).output.value).toBeCloseTo(6.21371, 3)
    })

    it('converts inches to centimeters', async () => {
      const res = await convert({ value: 12, from: 'in', to: 'cm' }, ctx)
      expect((res as any).output.value).toBeCloseTo(30.48, 2)
    })

    it('converts nautical miles to km', async () => {
      const res = await convert({ value: 1, from: 'nmi', to: 'km' }, ctx)
      expect((res as any).output.value).toBeCloseTo(1.852, 3)
    })

    it('converts feet to meters', async () => {
      const res = await convert({ value: 100, from: 'ft', to: 'm' }, ctx)
      expect((res as any).output.value).toBeCloseTo(30.48, 2)
    })

    it('converts yards to feet', async () => {
      const res = await convert({ value: 1, from: 'yd', to: 'ft' }, ctx)
      expect((res as any).output.value).toBeCloseTo(3, 1)
    })

    it('converts light years to km', async () => {
      const res = await convert({ value: 1, from: 'ly', to: 'km' }, ctx)
      expect((res as any).output.value).toBeCloseTo(9.461e12, -8)
    })

    it('converts micrometers to nanometers', async () => {
      const res = await convert({ value: 1, from: 'um', to: 'nm' }, ctx)
      expect((res as any).output.value).toBeCloseTo(1000, 0)
    })

    // ── Weight ─────────────────────────────────────────────────────────

    it('converts pounds to kg', async () => {
      const res = await convert({ value: 100, from: 'lbs', to: 'kg' }, ctx)
      expect((res as any).output.value).toBeCloseTo(45.3592, 2)
    })

    it('converts stone to pounds', async () => {
      const res = await convert({ value: 1, from: 'st', to: 'lbs' }, ctx)
      expect((res as any).output.value).toBeCloseTo(14, 0)
    })

    it('converts ounces to grams', async () => {
      const res = await convert({ value: 1, from: 'oz', to: 'g' }, ctx)
      expect((res as any).output.value).toBeCloseTo(28.3495, 2)
    })

    it('converts tonnes to kg', async () => {
      const res = await convert({ value: 1, from: 't', to: 'kg' }, ctx)
      expect((res as any).output.value).toBe(1000)
    })

    it('converts milligrams to micrograms', async () => {
      const res = await convert({ value: 1, from: 'mg', to: 'ug' }, ctx)
      expect((res as any).output.value).toBeCloseTo(1000, 0)
    })

    // ── Temperature ────────────────────────────────────────────────────

    it('converts Fahrenheit to Celsius', async () => {
      const res = await convert({ value: 212, from: '°F', to: '°C' }, ctx)
      expect((res as any).output.value).toBeCloseTo(100, 1)
    })

    it('converts Celsius to Kelvin', async () => {
      const res = await convert({ value: 0, from: 'C', to: 'K' }, ctx)
      expect((res as any).output.value).toBeCloseTo(273.15, 2)
    })

    it('converts Kelvin to Fahrenheit', async () => {
      const res = await convert({ value: 373.15, from: 'K', to: 'F' }, ctx)
      expect((res as any).output.value).toBeCloseTo(212, 1)
    })

    it('converts Fahrenheit to Kelvin', async () => {
      const res = await convert({ value: 32, from: 'fahrenheit', to: 'kelvin' }, ctx)
      expect((res as any).output.value).toBeCloseTo(273.15, 2)
    })

    it('converts same temperature unit to itself', async () => {
      const res = await convert({ value: 42, from: 'C', to: 'celsius' }, ctx)
      expect((res as any).output.value).toBe(42)
    })

    it('handles negative temperatures correctly', async () => {
      const res = await convert({ value: -40, from: 'C', to: 'F' }, ctx)
      // -40°C = -40°F (the crossover point!)
      expect((res as any).output.value).toBeCloseTo(-40, 1)
    })

    it('handles absolute zero in Kelvin to Celsius', async () => {
      const res = await convert({ value: 0, from: 'K', to: 'C' }, ctx)
      expect((res as any).output.value).toBeCloseTo(-273.15, 2)
    })

    it('errors mixing temperature with non-temperature', async () => {
      const res = await convert({ value: 1, from: '°C', to: 'km' }, ctx)
      expect(res).toHaveProperty('error')
      expect((res as any).error).toContain('Cannot mix temperature')
    })

    it('errors mixing non-temperature with temperature', async () => {
      const res = await convert({ value: 1, from: 'kg', to: 'F' }, ctx)
      expect(res).toHaveProperty('error')
      expect((res as any).error).toContain('Cannot mix temperature')
    })

    // ── Data ───────────────────────────────────────────────────────────

    it('converts GB to MB', async () => {
      const res = await convert({ value: 1, from: 'GB', to: 'MB' }, ctx)
      expect((res as any).output.value).toBe(1000)
    })

    it('converts GiB to MiB (binary)', async () => {
      const res = await convert({ value: 1, from: 'GiB', to: 'MiB' }, ctx)
      expect((res as any).output.value).toBe(1024)
    })

    it('converts bytes to bits', async () => {
      // Note: 'B' and 'b' both normalize to 'b' (case-insensitive), which matches 'bit'
      // Use full names to avoid alias collision
      const res = await convert({ value: 1, from: 'byte', to: 'bits' }, ctx)
      expect((res as any).output.value).toBe(8)
    })

    it('converts TB to GB', async () => {
      const res = await convert({ value: 1, from: 'TB', to: 'GB' }, ctx)
      expect((res as any).output.value).toBe(1000)
    })

    it('converts TiB to GiB', async () => {
      const res = await convert({ value: 1, from: 'TiB', to: 'GiB' }, ctx)
      expect((res as any).output.value).toBe(1024)
    })

    it('converts megabits to kilobytes', async () => {
      // 'Mb' normalizes to 'mb' which matches megabyte alias, not megabit
      // Use unambiguous alias 'mbit' for megabit
      const res = await convert({ value: 8, from: 'mbit', to: 'KB' }, ctx)
      // 8 megabits = 8 * 125000 bytes = 1000000 bytes = 1000 KB
      expect((res as any).output.value).toBe(1000)
    })

    // ── Time ───────────────────────────────────────────────────────────

    it('converts hours to seconds', async () => {
      const res = await convert({ value: 2, from: 'hours', to: 'seconds' }, ctx)
      expect((res as any).output.value).toBe(7200)
    })

    it('converts days to hours', async () => {
      const res = await convert({ value: 7, from: 'd', to: 'hr' }, ctx)
      expect((res as any).output.value).toBe(168)
    })

    it('converts weeks to days', async () => {
      const res = await convert({ value: 1, from: 'wk', to: 'days' }, ctx)
      expect((res as any).output.value).toBe(7)
    })

    it('converts milliseconds to microseconds', async () => {
      const res = await convert({ value: 1, from: 'ms', to: 'us' }, ctx)
      expect((res as any).output.value).toBeCloseTo(1000, 0)
    })

    it('converts minutes to seconds', async () => {
      const res = await convert({ value: 5, from: 'min', to: 's' }, ctx)
      expect((res as any).output.value).toBe(300)
    })

    // ── Speed ──────────────────────────────────────────────────────────

    it('converts mph to km/h', async () => {
      const res = await convert({ value: 60, from: 'mph', to: 'km/h' }, ctx)
      expect((res as any).output.value).toBeCloseTo(96.5606, 2)
    })

    it('converts knots to m/s', async () => {
      const res = await convert({ value: 1, from: 'kn', to: 'm/s' }, ctx)
      expect((res as any).output.value).toBeCloseTo(0.514444, 4)
    })

    it('converts mach to km/h', async () => {
      const res = await convert({ value: 1, from: 'mach', to: 'kph' }, ctx)
      // 343 m/s / 0.277778 = ~1234.8 km/h
      expect((res as any).output.value).toBeCloseTo(1234.8, 0)
    })

    // ── Pressure ───────────────────────────────────────────────────────

    it('converts atm to psi', async () => {
      const res = await convert({ value: 1, from: 'atm', to: 'psi' }, ctx)
      expect((res as any).output.value).toBeCloseTo(14.696, 2)
    })

    it('converts bar to kPa', async () => {
      const res = await convert({ value: 1, from: 'bar', to: 'kPa' }, ctx)
      expect((res as any).output.value).toBe(100)
    })

    it('converts mmHg to atm', async () => {
      const res = await convert({ value: 760, from: 'mmHg', to: 'atm' }, ctx)
      expect((res as any).output.value).toBeCloseTo(1, 2)
    })

    // ── Energy ─────────────────────────────────────────────────────────

    it('converts kcal to joules', async () => {
      const res = await convert({ value: 1, from: 'kcal', to: 'J' }, ctx)
      expect((res as any).output.value).toBe(4184)
    })

    it('converts kWh to joules', async () => {
      const res = await convert({ value: 1, from: 'kWh', to: 'J' }, ctx)
      expect((res as any).output.value).toBe(3600000)
    })

    it('converts BTU to kJ', async () => {
      const res = await convert({ value: 1, from: 'BTU', to: 'kJ' }, ctx)
      expect((res as any).output.value).toBeCloseTo(1.05506, 3)
    })

    // ── Area ───────────────────────────────────────────────────────────

    it('converts hectares to acres', async () => {
      const res = await convert({ value: 1, from: 'ha', to: 'acres' }, ctx)
      expect((res as any).output.value).toBeCloseTo(2.47105, 3)
    })

    it('converts square feet to square meters', async () => {
      const res = await convert({ value: 100, from: 'ft2', to: 'm2' }, ctx)
      expect((res as any).output.value).toBeCloseTo(9.2903, 2)
    })

    it('converts square miles to square km', async () => {
      const res = await convert({ value: 1, from: 'mi2', to: 'km2' }, ctx)
      expect((res as any).output.value).toBeCloseTo(2.59, 1)
    })

    // ── Volume ─────────────────────────────────────────────────────────

    it('converts liters to cups', async () => {
      const res = await convert({ value: 1, from: 'L', to: 'cups' }, ctx)
      expect((res as any).output.value).toBeCloseTo(4.22675, 3)
    })

    it('converts US gallons to liters', async () => {
      const res = await convert({ value: 1, from: 'gal', to: 'L' }, ctx)
      expect((res as any).output.value).toBeCloseTo(3.78541, 3)
    })

    it('converts tablespoons to teaspoons', async () => {
      const res = await convert({ value: 1, from: 'tbsp', to: 'tsp' }, ctx)
      expect((res as any).output.value).toBeCloseTo(3, 0)
    })

    it('converts milliliters to fluid ounces', async () => {
      const res = await convert({ value: 100, from: 'ml', to: 'fl oz' }, ctx)
      expect((res as any).output.value).toBeCloseTo(3.3814, 2)
    })

    it('converts UK gallons to US gallons', async () => {
      const res = await convert({ value: 1, from: 'uk gallon', to: 'gal' }, ctx)
      expect((res as any).output.value).toBeCloseTo(1.20095, 3)
    })

    it('converts cubic meters to liters', async () => {
      const res = await convert({ value: 1, from: 'm3', to: 'L' }, ctx)
      expect((res as any).output.value).toBe(1000)
    })

    // ── Edge cases ─────────────────────────────────────────────────────

    it('converts same unit to itself', async () => {
      const res = await convert({ value: 42, from: 'meter', to: 'meters' }, ctx)
      expect((res as any).output.value).toBe(42)
    })

    it('handles zero value', async () => {
      const res = await convert({ value: 0, from: 'km', to: 'miles' }, ctx)
      expect((res as any).output.value).toBe(0)
    })

    it('handles negative values', async () => {
      const res = await convert({ value: -10, from: 'km', to: 'miles' }, ctx)
      expect((res as any).output.value).toBeCloseTo(-6.21371, 3)
    })

    it('handles very large values', async () => {
      const res = await convert({ value: 1e15, from: 'B', to: 'PB' }, ctx)
      expect((res as any).output.value).toBe(1)
    })

    it('handles very small values', async () => {
      const res = await convert({ value: 0.001, from: 'kg', to: 'mg' }, ctx)
      expect((res as any).output.value).toBeCloseTo(1000, 0)
    })

    it('errors on incompatible categories', async () => {
      const res = await convert({ value: 1, from: 'km', to: 'kg' }, ctx)
      expect(res).toHaveProperty('error')
      expect((res as any).error).toContain('Cannot convert')
      expect((res as any).error).toContain('length')
      expect((res as any).error).toContain('weight')
    })

    it('errors on unknown "from" unit', async () => {
      const res = await convert({ value: 1, from: 'foobar', to: 'km' }, ctx)
      expect(res).toHaveProperty('error')
      expect((res as any).error).toContain('Unknown unit')
      expect((res as any).error).toContain('foobar')
    })

    it('errors on unknown "to" unit', async () => {
      const res = await convert({ value: 1, from: 'km', to: 'bazqux' }, ctx)
      expect(res).toHaveProperty('error')
      expect((res as any).error).toContain('Unknown unit')
      expect((res as any).error).toContain('bazqux')
    })

    it('output includes category information', async () => {
      const res = await convert({ value: 1, from: 'km', to: 'miles' }, ctx)
      expect((res as any).category).toBe('length')
    })

    it('output includes summary string', async () => {
      const res = await convert({ value: 100, from: 'C', to: 'F' }, ctx)
      expect((res as any).summary).toContain('celsius')
      expect((res as any).summary).toContain('fahrenheit')
    })

    it('uses case-insensitive alias matching', async () => {
      const res = await convert({ value: 1, from: 'KM', to: 'MILES' }, ctx)
      expect((res as any).output.value).toBeCloseTo(0.621371, 3)
    })

    it('handles aliases with special characters', async () => {
      const res = await convert({ value: 1, from: 'm²', to: 'ft²' }, ctx)
      expect((res as any).output.value).toBeCloseTo(10.7639, 2)
    })

    it('handles multi-word aliases with spaces', async () => {
      const res = await convert({ value: 1, from: 'nautical miles', to: 'km' }, ctx)
      expect((res as any).output.value).toBeCloseTo(1.852, 3)
    })

    it('centigrade alias works for Celsius', async () => {
      const res = await convert({ value: 100, from: 'centigrade', to: 'F' }, ctx)
      expect((res as any).output.value).toBeCloseTo(212, 1)
    })
  })

  // ── list_units ──────────────────────────────────────────────────────────

  describe('list_units', () => {
    it('lists all categories when no argument given', async () => {
      const res = await listUnits({}, ctx)
      expect((res as any).categories.length).toBeGreaterThanOrEqual(10)
      const names = (res as any).categories.map((c: any) => c.name)
      expect(names).toContain('length')
      expect(names).toContain('weight')
      expect(names).toContain('temperature')
      expect(names).toContain('data')
      expect(names).toContain('speed')
      expect(names).toContain('time')
      expect(names).toContain('area')
      expect(names).toContain('pressure')
      expect(names).toContain('energy')
      expect(names).toContain('volume')
    })

    it('includes unit count per category', async () => {
      const res = await listUnits({}, ctx)
      for (const cat of (res as any).categories) {
        expect(cat.unitCount).toBeGreaterThan(0)
      }
    })

    it('temperature has 3 units', async () => {
      const res = await listUnits({}, ctx)
      const temp = (res as any).categories.find((c: any) => c.name === 'temperature')
      expect(temp.unitCount).toBe(3)
    })

    it('lists units for a specific category', async () => {
      const res = await listUnits({ category: 'length' }, ctx)
      expect((res as any).category).toBe('length')
      expect((res as any).units.length).toBeGreaterThan(5)
    })

    it('lists temperature units with aliases', async () => {
      const res = await listUnits({ category: 'temperature' }, ctx)
      expect((res as any).units).toHaveLength(3)
      const joined = (res as any).units.join(' ')
      expect(joined).toContain('celsius')
      expect(joined).toContain('fahrenheit')
      expect(joined).toContain('kelvin')
    })

    it('lists data units', async () => {
      const res = await listUnits({ category: 'data' }, ctx)
      expect((res as any).category).toBe('data')
      const joined = (res as any).units.join(' ')
      expect(joined).toContain('byte')
      expect(joined).toContain('gigabyte')
    })

    it('lists energy units', async () => {
      const res = await listUnits({ category: 'energy' }, ctx)
      expect((res as any).category).toBe('energy')
      const joined = (res as any).units.join(' ')
      expect(joined).toContain('joule')
      expect(joined).toContain('kilocalorie')
    })

    it('lists pressure units', async () => {
      const res = await listUnits({ category: 'pressure' }, ctx)
      expect((res as any).category).toBe('pressure')
    })

    it('errors on unknown category', async () => {
      const res = await listUnits({ category: 'magic' }, ctx)
      expect(res).toHaveProperty('error')
      expect((res as any).error).toContain('Unknown category')
      expect((res as any).error).toContain('Available')
    })

    it('is case-insensitive for category', async () => {
      const res = await listUnits({ category: 'LENGTH' }, ctx)
      expect((res as any).category).toBe('length')
    })

    it('unit listings include aliases', async () => {
      const res = await listUnits({ category: 'weight' }, ctx)
      // Each entry should have parenthesized aliases
      for (const unit of (res as any).units) {
        expect(unit).toContain('(')
        expect(unit).toContain(')')
      }
    })
  })
})
