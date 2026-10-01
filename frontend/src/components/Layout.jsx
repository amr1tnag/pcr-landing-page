import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ArrowUpRight, EnvelopeSimple, InstagramLogo, List, X } from '@phosphor-icons/react'
import Logo from './Logo.jsx'
import { club, nav, primaryCta } from '../data/site.js'

function NavItem({ item, className, onClick }) {
  if (item.href.startsWith('/#')) {
    return (
      <a href={item.href} className={className} onClick={onClick}>
        {item.label}
      </a>
    )
  }
  return (
    <NavLink to={item.href} onClick={onClick} className={({ isActive }) => `${className} ${isActive ? '!text-accent' : ''}`}>
      {item.label}
    </NavLink>
  )
}

export default function Layout() {
  const sentinel = useRef(null)
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { pathname, hash } = useLocation()

  // The nav turns solid once a 1px sentinel at the top of the page leaves view.
  useEffect(() => {
    const el = sentinel.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    setOpen(false)
    if (!hash) window.scrollTo({ top: 0 })
  }, [pathname, hash])

  const solid = scrolled || open

  return (
    <div className="min-h-[100dvh] bg-ink">
      <div ref={sentinel} aria-hidden className="absolute left-0 top-0 h-px w-px" />
      <div aria-hidden className="film-grain pointer-events-none fixed inset-0 z-grain" />

      <header
        className={`fixed inset-x-0 top-0 z-nav transition-colors duration-300 ${
          solid ? 'border-b border-bone/10 bg-ink/90 backdrop-blur-md' : 'border-b border-transparent'
        }`}
      >
        <div className="shell flex h-16 items-center justify-between lg:h-[72px]">
          <Logo />

          <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
            {nav.map((item) => (
              <NavItem
                key={item.label}
                item={item}
                className="text-sm font-medium text-bone/75 transition-colors hover:text-bone"
              />
            ))}
            <Link to={primaryCta.href} className="btn-primary !px-5 !py-2.5 !text-xs">
              {primaryCta.label}
            </Link>
          </nav>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="grid h-11 w-11 place-items-center text-bone lg:hidden"
          >
            {open ? <X size={26} weight="bold" /> : <List size={26} weight="bold" />}
          </button>
        </div>

        {open && (
          <nav id="mobile-nav" aria-label="Main" className="shell flex flex-col pb-8 pt-2 lg:hidden">
            {nav.map((item) => (
              <NavItem
                key={item.label}
                item={item}
                onClick={() => setOpen(false)}
                className="py-3 font-display text-3xl uppercase text-bone"
              />
            ))}
            <Link to={primaryCta.href} className="btn-primary mt-5">
              {primaryCta.label}
            </Link>
          </nav>
        )}
      </header>

      <main>
        <Outlet />
      </main>

      <footer id="contact" className="scroll-mt-20 bg-coal">
        <div className="shell grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr] md:py-20">
          <div>
            <Logo />
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-ash">{club.blurb}</p>
            <p className="mt-8 font-display text-4xl uppercase text-accent">{club.hashtag}</p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-bone">Explore</h2>
            <ul className="mt-4 space-y-2.5">
              {nav.map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-sm text-ash transition-colors hover:text-bone">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-bone">Contact</h2>
            <ul className="mt-4 space-y-3 text-sm text-ash">
              <li>
                <a href={club.instagram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-bone transition-colors hover:text-accent">
                  <InstagramLogo size={18} />
                  {club.handle}
                  <ArrowUpRight size={14} />
                </a>
              </li>
              <li>
                <a href={`mailto:${club.email}`} className="inline-flex items-center gap-2 transition-colors hover:text-bone">
                  <EnvelopeSimple size={18} />
                  {club.email}
                </a>
              </li>
              <li className="max-w-[16rem] leading-relaxed">{club.location}</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-bone/10">
          <div className="shell flex flex-col gap-2 py-6 text-xs text-ash sm:flex-row sm:justify-between">
            <span>© {new Date().getFullYear()} PhotoCircle RAIT</span>
            <span>Shot today. Posted today.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
