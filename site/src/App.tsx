import { useState, useEffect } from 'react'
import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { Features } from './components/Features'
import { Providers } from './components/Providers'
import { Architecture } from './components/Architecture'
import { Install } from './components/Install'
import { FAQ } from './components/FAQ'
import { Footer } from './components/Footer'

export default function App() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('kinbot-site-theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('kinbot-site-theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <div className="surface-base min-h-screen">
      <Navbar dark={dark} onToggleDark={() => setDark(d => !d)} />
      <main>
        <Hero />
        <Features />
        <Providers />
        <Architecture />
        <Install />
        <FAQ />
      </main>
      <Footer />
    </div>
  )
}
