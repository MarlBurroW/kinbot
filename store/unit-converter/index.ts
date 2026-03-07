import { tool } from 'ai'
import { z } from 'zod'

/**
 * Unit Converter plugin for KinBot.
 * Converts between common units of measurement. Pure logic, no API calls.
 */

// ─── Unit definitions ───────────────────────────────────────────────────────
// Each category maps unit names to their factor relative to a base unit.
// Temperature is handled separately (non-linear conversions).

interface UnitDef {
  factor: number
  aliases: string[]
}

type UnitCategory = Record<string, UnitDef>

const LENGTH: UnitCategory = {
  meter:      { factor: 1,        aliases: ['m', 'meters', 'metre', 'metres'] },
  kilometer:  { factor: 1000,     aliases: ['km', 'kilometers', 'kilometres'] },
  centimeter: { factor: 0.01,     aliases: ['cm', 'centimeters', 'centimetres'] },
  millimeter: { factor: 0.001,    aliases: ['mm', 'millimeters', 'millimetres'] },
  micrometer: { factor: 1e-6,     aliases: ['um', 'μm', 'microns', 'micrometers'] },
  nanometer:  { factor: 1e-9,     aliases: ['nm', 'nanometers'] },
  mile:       { factor: 1609.344, aliases: ['mi', 'miles'] },
  yard:       { factor: 0.9144,   aliases: ['yd', 'yards'] },
  foot:       { factor: 0.3048,   aliases: ['ft', 'feet'] },
  inch:       { factor: 0.0254,   aliases: ['in', 'inches'] },
  nautical_mile: { factor: 1852,  aliases: ['nmi', 'nautical miles', 'nautical_miles'] },
  light_year: { factor: 9.461e15, aliases: ['ly', 'light years', 'light_years'] },
}

const WEIGHT: UnitCategory = {
  kilogram:  { factor: 1,         aliases: ['kg', 'kilograms', 'kilo', 'kilos'] },
  gram:      { factor: 0.001,     aliases: ['g', 'grams'] },
  milligram: { factor: 1e-6,      aliases: ['mg', 'milligrams'] },
  microgram: { factor: 1e-9,      aliases: ['ug', 'μg', 'micrograms'] },
  tonne:     { factor: 1000,      aliases: ['t', 'tonnes', 'metric ton', 'metric_ton'] },
  pound:     { factor: 0.453592,  aliases: ['lb', 'lbs', 'pounds'] },
  ounce:     { factor: 0.0283495, aliases: ['oz', 'ounces'] },
  stone:     { factor: 6.35029,   aliases: ['st', 'stones'] },
}

const VOLUME: UnitCategory = {
  liter:      { factor: 1,        aliases: ['l', 'L', 'liters', 'litres', 'litre'] },
  milliliter: { factor: 0.001,    aliases: ['ml', 'mL', 'milliliters', 'millilitres'] },
  cubic_meter:     { factor: 1000, aliases: ['m3', 'm³', 'cubic meters', 'cubic_meters'] },
  cubic_centimeter: { factor: 0.001, aliases: ['cm3', 'cm³', 'cc', 'cubic centimeters', 'cubic_centimeters'] },
  gallon_us:  { factor: 3.78541,  aliases: ['gal', 'gallon', 'gallons', 'us gallon', 'us_gallon'] },
  gallon_uk:  { factor: 4.54609,  aliases: ['uk gallon', 'uk_gallon', 'imperial gallon', 'imperial_gallon'] },
  quart:      { factor: 0.946353, aliases: ['qt', 'quarts'] },
  pint_us:    { factor: 0.473176, aliases: ['pt', 'pint', 'pints', 'us pint', 'us_pint'] },
  cup:        { factor: 0.236588, aliases: ['cups'] },
  fluid_ounce: { factor: 0.0295735, aliases: ['fl oz', 'fl_oz', 'fluid ounces', 'fluid_ounces'] },
  tablespoon: { factor: 0.0147868, aliases: ['tbsp', 'tablespoons'] },
  teaspoon:   { factor: 0.00492892, aliases: ['tsp', 'teaspoons'] },
}

const SPEED: UnitCategory = {
  meters_per_second:    { factor: 1,       aliases: ['m/s', 'mps'] },
  kilometers_per_hour:  { factor: 0.277778, aliases: ['km/h', 'kph', 'kmh'] },
  miles_per_hour:       { factor: 0.44704,  aliases: ['mph', 'mi/h'] },
  knot:                 { factor: 0.514444, aliases: ['kn', 'knots', 'kt'] },
  feet_per_second:      { factor: 0.3048,   aliases: ['ft/s', 'fps'] },
  mach:                 { factor: 343,      aliases: ['ma'] },
}

const TIME: UnitCategory = {
  second:      { factor: 1,           aliases: ['s', 'sec', 'seconds', 'secs'] },
  millisecond: { factor: 0.001,       aliases: ['ms', 'milliseconds'] },
  microsecond: { factor: 1e-6,        aliases: ['us', 'μs', 'microseconds'] },
  nanosecond:  { factor: 1e-9,        aliases: ['ns', 'nanoseconds'] },
  minute:      { factor: 60,          aliases: ['min', 'minutes', 'mins'] },
  hour:        { factor: 3600,        aliases: ['h', 'hr', 'hours', 'hrs'] },
  day:         { factor: 86400,       aliases: ['d', 'days'] },
  week:        { factor: 604800,      aliases: ['wk', 'weeks'] },
  month:       { factor: 2629746,     aliases: ['mo', 'months'] },
  year:        { factor: 31556952,    aliases: ['yr', 'years', 'yrs'] },
}

const DATA: UnitCategory = {
  byte:     { factor: 1,             aliases: ['B', 'bytes'] },
  kilobyte: { factor: 1000,          aliases: ['KB', 'kb', 'kilobytes'] },
  megabyte: { factor: 1e6,           aliases: ['MB', 'mb', 'megabytes'] },
  gigabyte: { factor: 1e9,           aliases: ['GB', 'gb', 'gigabytes'] },
  terabyte: { factor: 1e12,          aliases: ['TB', 'tb', 'terabytes'] },
  petabyte: { factor: 1e15,          aliases: ['PB', 'pb', 'petabytes'] },
  kibibyte: { factor: 1024,          aliases: ['KiB', 'kibibytes'] },
  mebibyte: { factor: 1048576,       aliases: ['MiB', 'mebibytes'] },
  gibibyte: { factor: 1073741824,    aliases: ['GiB', 'gibibytes'] },
  tebibyte: { factor: 1099511627776, aliases: ['TiB', 'tebibytes'] },
  bit:      { factor: 0.125,         aliases: ['b', 'bits'] },
  kilobit:  { factor: 125,           aliases: ['Kb', 'kbit', 'kilobits'] },
  megabit:  { factor: 125000,        aliases: ['Mb', 'mbit', 'megabits'] },
  gigabit:  { factor: 125000000,     aliases: ['Gb', 'gbit', 'gigabits'] },
}

const AREA: UnitCategory = {
  square_meter:     { factor: 1,          aliases: ['m2', 'm²', 'sq m', 'square meters', 'square_meters'] },
  square_kilometer: { factor: 1e6,        aliases: ['km2', 'km²', 'sq km', 'square kilometers', 'square_kilometers'] },
  square_centimeter: { factor: 1e-4,      aliases: ['cm2', 'cm²', 'sq cm', 'square centimeters', 'square_centimeters'] },
  hectare:          { factor: 10000,      aliases: ['ha', 'hectares'] },
  acre:             { factor: 4046.86,    aliases: ['acres'] },
  square_mile:      { factor: 2.59e6,     aliases: ['mi2', 'mi²', 'sq mi', 'square miles', 'square_miles'] },
  square_foot:      { factor: 0.092903,   aliases: ['ft2', 'ft²', 'sq ft', 'square feet', 'square_feet'] },
  square_yard:      { factor: 0.836127,   aliases: ['yd2', 'yd²', 'sq yd', 'square yards', 'square_yards'] },
  square_inch:      { factor: 0.00064516, aliases: ['in2', 'in²', 'sq in', 'square inches', 'square_inches'] },
}

const PRESSURE: UnitCategory = {
  pascal:     { factor: 1,         aliases: ['Pa', 'pascals'] },
  kilopascal: { factor: 1000,      aliases: ['kPa', 'kilopascals'] },
  bar:        { factor: 100000,    aliases: ['bars'] },
  millibar:   { factor: 100,       aliases: ['mbar', 'millibars', 'hPa', 'hectopascal'] },
  atmosphere: { factor: 101325,    aliases: ['atm', 'atmospheres'] },
  psi:        { factor: 6894.76,   aliases: ['pounds per square inch'] },
  mmhg:       { factor: 133.322,   aliases: ['mmHg', 'torr', 'Torr'] },
}

const ENERGY: UnitCategory = {
  joule:        { factor: 1,          aliases: ['J', 'joules'] },
  kilojoule:    { factor: 1000,       aliases: ['kJ', 'kilojoules'] },
  calorie:      { factor: 4.184,      aliases: ['cal', 'calories'] },
  kilocalorie:  { factor: 4184,       aliases: ['kcal', 'kilocalories', 'Cal', 'food calorie'] },
  watt_hour:    { factor: 3600,       aliases: ['Wh', 'watt hours', 'watt_hours'] },
  kilowatt_hour: { factor: 3.6e6,    aliases: ['kWh', 'kilowatt hours', 'kilowatt_hours'] },
  electronvolt: { factor: 1.602e-19,  aliases: ['eV', 'electronvolts'] },
  btu:          { factor: 1055.06,    aliases: ['BTU', 'btus', 'British thermal unit'] },
}

const CATEGORIES: Record<string, UnitCategory> = {
  length: LENGTH,
  weight: WEIGHT,
  volume: VOLUME,
  speed: SPEED,
  time: TIME,
  data: DATA,
  area: AREA,
  pressure: PRESSURE,
  energy: ENERGY,
}

// ─── Lookup helpers ─────────────────────────────────────────────────────────

function normalizeUnit(input: string): string {
  return input.trim().toLowerCase().replace(/[_\s]+/g, '_')
}

function findUnit(input: string): { category: string; unit: string } | null {
  const normalized = normalizeUnit(input)
  for (const [catName, cat] of Object.entries(CATEGORIES)) {
    for (const [unitName, def] of Object.entries(cat)) {
      if (normalizeUnit(unitName) === normalized) {
        return { category: catName, unit: unitName }
      }
      for (const alias of def.aliases) {
        if (normalizeUnit(alias) === normalized) {
          return { category: catName, unit: unitName }
        }
      }
    }
  }
  return null
}

function listUnitsForCategory(catName: string): string[] {
  const cat = CATEGORIES[catName]
  if (!cat) return []
  return Object.keys(cat)
}

// ─── Temperature (special case) ─────────────────────────────────────────────

type TempUnit = 'celsius' | 'fahrenheit' | 'kelvin'

const TEMP_ALIASES: Record<string, TempUnit> = {
  celsius: 'celsius', c: 'celsius', '°c': 'celsius', centigrade: 'celsius',
  fahrenheit: 'fahrenheit', f: 'fahrenheit', '°f': 'fahrenheit',
  kelvin: 'kelvin', k: 'kelvin',
}

function parseTempUnit(input: string): TempUnit | null {
  return TEMP_ALIASES[normalizeUnit(input)] ?? null
}

function convertTemperature(value: number, from: TempUnit, to: TempUnit): number {
  if (from === to) return value
  // Convert to Celsius first
  let celsius: number
  switch (from) {
    case 'celsius': celsius = value; break
    case 'fahrenheit': celsius = (value - 32) * 5 / 9; break
    case 'kelvin': celsius = value - 273.15; break
  }
  // Convert from Celsius to target
  switch (to) {
    case 'celsius': return celsius
    case 'fahrenheit': return celsius * 9 / 5 + 32
    case 'kelvin': return celsius + 273.15
  }
}

// ─── Conversion logic ───────────────────────────────────────────────────────

function convert(value: number, fromStr: string, toStr: string): { result: number; from: string; to: string; category: string } | { error: string } {
  // Check temperature first
  const fromTemp = parseTempUnit(fromStr)
  const toTemp = parseTempUnit(toStr)
  if (fromTemp && toTemp) {
    return {
      result: convertTemperature(value, fromTemp, toTemp),
      from: fromTemp,
      to: toTemp,
      category: 'temperature',
    }
  }
  if (fromTemp || toTemp) {
    return { error: `Cannot mix temperature with non-temperature units.` }
  }

  const fromInfo = findUnit(fromStr)
  const toInfo = findUnit(toStr)

  if (!fromInfo) return { error: `Unknown unit: "${fromStr}". Use list_units to see available units.` }
  if (!toInfo) return { error: `Unknown unit: "${toStr}". Use list_units to see available units.` }
  if (fromInfo.category !== toInfo.category) {
    return { error: `Cannot convert between ${fromInfo.category} (${fromStr}) and ${toInfo.category} (${toStr}). Units must be in the same category.` }
  }

  const cat = CATEGORIES[fromInfo.category]
  const baseValue = value * cat[fromInfo.unit].factor
  const result = baseValue / cat[toInfo.unit].factor

  return {
    result,
    from: fromInfo.unit,
    to: toInfo.unit,
    category: fromInfo.category,
  }
}

// ─── Format helpers ─────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString()
  // Use enough precision but trim trailing zeros
  const s = n.toPrecision(10)
  return parseFloat(s).toString()
}

// ─── Plugin export ──────────────────────────────────────────────────────────

export default function unitConverterPlugin() {
  return {
    tools: {
      convert_units: tool({
        description: 'Convert a value from one unit of measurement to another. Supports length, weight, volume, temperature, speed, time, data size, area, pressure, and energy.',
        parameters: z.object({
          value: z.number().describe('The numeric value to convert'),
          from: z.string().describe('Source unit (e.g. "km", "pounds", "°F", "GB", "psi")'),
          to: z.string().describe('Target unit (e.g. "miles", "kg", "°C", "MB", "atm")'),
        }),
        execute: async ({ value, from, to }) => {
          const res = convert(value, from, to)
          if ('error' in res) return { error: res.error }
          return {
            input: { value, unit: res.from },
            output: { value: parseFloat(formatNumber(res.result)), unit: res.to },
            category: res.category,
            summary: `${formatNumber(value)} ${res.from} = ${formatNumber(res.result)} ${res.to}`,
          }
        },
      }),

      list_units: tool({
        description: 'List all available unit categories and their units, or list units for a specific category.',
        parameters: z.object({
          category: z.string().optional().describe('Category to list units for (e.g. "length", "weight", "temperature"). Omit to see all categories.'),
        }),
        execute: async ({ category }) => {
          if (category) {
            const catNorm = normalizeUnit(category)
            if (catNorm === 'temperature') {
              return {
                category: 'temperature',
                units: ['celsius (°C, C)', 'fahrenheit (°F, F)', 'kelvin (K)'],
              }
            }
            const cat = CATEGORIES[catNorm]
            if (!cat) {
              return { error: `Unknown category: "${category}". Available: ${[...Object.keys(CATEGORIES), 'temperature'].join(', ')}` }
            }
            return {
              category: catNorm,
              units: Object.entries(cat).map(([name, def]) => `${name} (${def.aliases.slice(0, 3).join(', ')})`),
            }
          }
          return {
            categories: [...Object.keys(CATEGORIES), 'temperature'].map(cat => ({
              name: cat,
              unitCount: cat === 'temperature' ? 3 : Object.keys(CATEGORIES[cat]).length,
            })),
          }
        },
      }),
    },
  }
}
