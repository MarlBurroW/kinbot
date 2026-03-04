import { tool } from 'ai'
import { z } from 'zod'

/**
 * Example weather plugin for KinBot.
 * Demonstrates how to create a plugin with tools, config, and HTTP permissions.
 */
export default function(ctx: any) {
  const { apiKey, units = 'metric' } = ctx.config

  return {
    tools: {
      get_weather: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description: 'Get current weather for a location',
            parameters: z.object({
              location: z.string().describe('City name (e.g. "Paris" or "London,UK")'),
            }),
            execute: async ({ location }: { location: string }) => {
              if (!apiKey) {
                return { error: 'OpenWeatherMap API key not configured. Go to Settings > Plugins to configure it.' }
              }

              const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=${units}&appid=${apiKey}`

              try {
                const res = await ctx.http.fetch(url)
                const data = await res.json() as any

                if (data.cod !== 200) {
                  return { error: data.message || 'Failed to fetch weather' }
                }

                return {
                  location: data.name,
                  country: data.sys?.country,
                  temperature: data.main.temp,
                  feels_like: data.main.feels_like,
                  humidity: data.main.humidity,
                  description: data.weather[0].description,
                  wind_speed: data.wind.speed,
                  units: units === 'metric' ? '°C' : '°F',
                }
              } catch (err: any) {
                ctx.log.error({ err }, 'Weather API request failed')
                return { error: err.message || 'Weather API request failed' }
              }
            },
          }),
      },
    },

    async activate() {
      ctx.log.info('Example weather plugin activated')
    },

    async deactivate() {
      ctx.log.info('Example weather plugin deactivated')
    },
  }
}
