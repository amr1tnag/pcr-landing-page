import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { club, nav } from '../data/site.js'

function Mark({ className = '' }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 ${className}`} aria-label="PhotoCircle RAIT home">
      <span className="grid h-8 w-8 place-items-center border-2 border-flame">
        <span className="h-2.5 w-2.5 rounded-full bg-flame" />
      </span>
      <span className="font-display text-sm uppercase leading-none tracking-tight">
        Photo<span className="text-flame">Circle</span>
        <span className="mt-0.5 block font-cond text-[10px] font-medium tracking-[0.35em] text-ash">RAIT</span>
      </span>
    </Link>
  )
}

export default function Layout() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { pathname, hash } = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setOpen(false)
    if (!hash) window.scrollTo({ top: 0 })
  }, [pathname, hash])

  const linkClass = ({ isActive }) =>
    `font-cond text-sm uppercase tracking-[0.2em] transition-colors ${
      isActive ? 'text-flame' : 'text-white/70 hover:text-white'
    }`

  return (
    <div className="min-h-screen bg-ink">
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled || open ? 'border-b border-white/10 bg-ink/85 backdrop-blur-xl' : 'bg-transparent'
        }`}
      >
        <div className="shell flex h-16 items-center justify-between sm:h-20">
          <Mark />

          <nav className="hidden items-center gap-8 md:flex">
            {nav.map((item) =>
              item.href.startsWith('/#') ? (
                <a key={item.label} href={item.href} className="font-cond text-sm uppercase tracking-[0.2em] text-white/70 transition-colors hover:text-white">
                  {item.label}
                </a>
              ) : (
                <NavLink key={item.label} to={item.href} className={linkClass}>
                  {item.label}
                </NavLink>
              )
            )}
            <Link
              to="/gallery"
              className="border border-flame px-4 py-2 font-cond text-sm uppercase tracking-[0.2em] text-flame transition-colors hover:bg-flame hover:text-black"
            >
              Find your photos
            </Link>
          </nav>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle navigation"
            className="grid h-10 w-10 place-items-center md:hidden"
          >
            <span className="relative block h-4 w-6">
              <span className={`absolute left-0 h-0.5 w-6 bg-white transition-all ${open ? 'top-2 rotate-45' : 'top-0'}`} />
              <span className={`absolute left-0 top-2 h-0.5 w-6 bg-white transition-opacity ${open ? 'opacity-0' : 'opacity-100'}`} />
              <span className={`absolute left-0 h-0.5 w-6 bg-white transition-all ${open ? 'top-2 -rotate-45' : 'top-4'}`} />
            </span>
          </button>
        </div>

        {open && (
          <nav className="shell flex flex-col gap-1 pb-6 md:hidden">
            {nav.map((item) =>
              item.href.startsWith('/#') ? (
                <a key={item.label} href={item.href} className="border-b border-white/5 py-3 font-display text-2xl uppercase">
                  {item.label}
                </a>
              ) : (
                <Link key={item.label} to={item.href} className="border-b border-white/5 py-3 font-display text-2xl uppercase text-flame">
                  {item.label}
                </Link>
              )
            )}
          </nav>
        )}
      </header>

      <main>
        <Outlet />
      </main>

      <footer id="contact" className="rule bg-coal">
        <div className="shell grid gap-12 py-16 sm:py-20 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <Mark />
            <p className="mt-5 max-w-sm font-sans text-sm leading-relaxed text-ash">{club.blurb}</p>
            <p className="mt-6 font-display text-3xl uppercase text-flame sm:text-4xl">{club.hashtag}</p>
          </div>

          <div>
            <h3 className="eyebrow">Explore</h3>
            <ul className="mt-5 space-y-2.5">
              {nav.map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="font-cond text-lg uppercase tracking-wide text-white/70 transition-colors hover:text-flame">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="eyebrow">Find us</h3>
            <ul className="mt-5 space-y-3 font-sans text-sm text-ash">
              <li>
                <a href={club.instagram} target="_blank" rel="noreferrer" className="text-white transition-colors hover:text-flame">
                  Instagram · {club.handle}
                </a>
              </li>
              <li>
                <a href={`mailto:${club.email}`} className="transition-colors hover:text-flame">
                  {club.email}
                </a>
              </li>
              <li>{club.location}</li>
            </ul>
          </div>
        </div>

        <div className="rule">
          <div className="shell flex flex-col gap-2 py-6 font-cond text-xs uppercase tracking-[0.25em] text-ash sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} PhotoCircle RAIT</span>
            <span>Shot today. Posted today.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
