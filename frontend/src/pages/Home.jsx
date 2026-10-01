import { Link } from 'react-router-dom'
import Frame from '../components/Frame.jsx'
import Reveal from '../components/Reveal.jsx'
import { club, stats, pillars, roles, featured, events, team } from '../data/site.js'

function Hero() {
  return (
    <section id="top" className="grain relative flex min-h-[100svh] items-end overflow-hidden">
      {/* Hero imagery: drop a frame at public/img/hero.jpg to replace the gradient */}
      <div className="absolute inset-0">
        <img
          src="/img/hero.jpg"
          alt=""
          onError={(e) => (e.currentTarget.style.display = 'none')}
          className="h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_30%,#1d1d1d_0%,#0a0a0a_70%)] [z-index:-1]" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/30" />
      </div>

      <div className="shell relative w-full pb-16 pt-28 sm:pb-24">
        <p className="eyebrow animate-rise">The official media team of RAIT</p>

        <h1 className="display mt-5 animate-rise text-[17vw] leading-[0.82] sm:text-[12vw] lg:text-[9.5rem]">
          Photo<span className="block sm:inline">Circle</span>
          <span className="block text-flame">RAIT</span>
        </h1>

        <p className="mt-7 max-w-xl animate-rise font-cond text-xl uppercase tracking-wide text-white/80 sm:text-2xl">
          {club.tagline}
        </p>

        <div className="mt-10 flex animate-rise flex-col gap-3 sm:flex-row">
          <Link
            to="/gallery"
            className="group inline-flex items-center justify-center gap-3 bg-flame px-7 py-4 font-display text-sm uppercase tracking-wide text-black transition-transform hover:-translate-y-0.5"
          >
            Find your photos
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
          <a
            href="#about"
            className="inline-flex items-center justify-center border border-white/25 px-7 py-4 font-display text-sm uppercase tracking-wide text-white transition-colors hover:border-white hover:bg-white hover:text-black"
          >
            Who we are
          </a>
        </div>

        <p className="mt-14 font-display text-2xl uppercase text-white/15 sm:text-4xl">{club.hashtag}</p>
      </div>
    </section>
  )
}

function Stats() {
  return (
    <section className="rule bg-coal">
      <div className="shell grid grid-cols-2 divide-white/10 py-10 sm:py-14 lg:grid-cols-4 lg:divide-x">
        {stats.map((s) => (
          <Reveal key={s.label} className="px-2 py-5 text-center lg:px-6">
            <p className="font-display text-4xl text-flame sm:text-5xl">{s.value}</p>
            <p className="mt-2 font-cond text-xs uppercase tracking-[0.2em] text-ash sm:text-sm">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function About() {
  return (
    <section id="about" className="shell scroll-mt-24 py-20 sm:py-28">
      <Reveal className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <div>
          <p className="eyebrow">Who we are</p>
          <h2 className="display mt-5 text-5xl sm:text-6xl lg:text-7xl">
            Every photo
            <br />
            on this screen
            <br />
            was shot by
            <br />
            <span className="text-flame">a student</span>
          </h2>
        </div>

        <div className="flex flex-col justify-end gap-8">
          <Frame src="/img/about.jpg" event="Horizon" caption="Shot from the pit" ratio="aspect-[16/10]" />
          <p className="font-sans text-lg leading-relaxed text-white/75">{club.blurb}</p>
          <p className="font-sans text-base leading-relaxed text-ash">
            We run photography and editing workshops through the year, cover every cultural night, sports fixture,
            fest and felicitation on campus, and build the media that the college actually posts. Quality content,
            out the same day the event happens — that deadline is the whole discipline of this club.
          </p>

          <div className="grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3">
            {pillars.map((p) => (
              <div key={p.title} className="bg-ink p-6">
                <h3 className="font-display text-xl uppercase text-flame">{p.title}</h3>
                <p className="mt-3 font-sans text-sm leading-relaxed text-ash">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function GalleryPreview() {
  return (
    <section id="gallery" className="scroll-mt-24 bg-coal py-20 sm:py-28">
      <div className="shell">
        <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Recent frames</p>
            <h2 className="display mt-4 text-5xl sm:text-6xl">
              We cover <span className="text-flame">everything</span>
            </h2>
          </div>
          <Link
            to="/gallery"
            className="self-start font-cond text-sm uppercase tracking-[0.25em] text-flame underline-offset-8 hover:underline sm:self-auto"
          >
            Search by your face →
          </Link>
        </Reveal>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {featured.map((f, i) => (
            <Reveal key={f.id} delay={i * 60}>
              <Frame {...f} alt={`${f.event} — ${f.caption}`} />
            </Reveal>
          ))}
        </div>

        <p className="mt-10 font-cond text-lg uppercase tracking-wide text-white/60">
          Cultural nights, sports, fests, felicitations — if it happens at RAIT, we are there with a camera.
        </p>
      </div>
    </section>
  )
}

function Events() {
  return (
    <section id="events" className="shell scroll-mt-24 py-20 sm:py-28">
      <Reveal>
        <p className="eyebrow">Timeline</p>
        <h2 className="display mt-4 text-5xl sm:text-6xl">
          Events we <span className="text-flame">shot</span>
        </h2>
      </Reveal>

      <ol className="mt-14 border-l border-white/10">
        {events.map((e, i) => (
          <Reveal key={e.name} delay={i * 70}>
            <li className="relative grid gap-3 py-8 pl-8 sm:grid-cols-[150px_1fr] sm:gap-8 sm:pl-12">
              <span
                className={`absolute left-0 top-10 h-3 w-3 -translate-x-1/2 rounded-full ${
                  e.status === 'upcoming' ? 'bg-flame ring-4 ring-flame/20' : 'bg-white/25'
                }`}
              />
              <div>
                <p className="font-cond text-sm uppercase tracking-[0.25em] text-ash">{e.date}</p>
                {e.status === 'upcoming' && (
                  <span className="mt-2 inline-block bg-flame px-2 py-0.5 font-cond text-[11px] uppercase tracking-[0.2em] text-black">
                    Upcoming
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-display text-2xl uppercase sm:text-3xl">{e.name}</h3>
                <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-ash">{e.blurb}</p>
              </div>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  )
}

function Team() {
  return (
    <section id="team" className="scroll-mt-24 bg-coal py-20 sm:py-28">
      <div className="shell">
        <Reveal className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
          <div>
            <p className="eyebrow">The crew</p>
            <h2 className="display mt-4 text-5xl sm:text-6xl">
              Shot by
              <br />
              <span className="text-flame">students</span>
            </h2>
            <p className="mt-6 max-w-sm font-sans text-base leading-relaxed text-ash">
              No professionals. No hired crew. Just members who learned on the job — and the seniors who teach the
              next batch the same way.
            </p>

            <div className="mt-8">
              <p className="eyebrow">Where you fit in</p>
              <ul className="mt-4 grid grid-cols-2 gap-x-6">
                {roles.map((r) => (
                  <li key={r} className="border-b border-white/10 py-3 font-cond text-base uppercase tracking-wide text-white/80">
                    {r}
                  </li>
                ))}
              </ul>
              <p className="mt-4 font-display text-lg uppercase text-flame">And anyone else — we train you</p>
            </div>
          </div>

          <div className="grid gap-px self-start border border-white/10 bg-white/10 sm:grid-cols-2">
            {team.map((m) => (
              <div key={m.name} className="bg-coal p-6 transition-colors hover:bg-smoke">
                <p className="font-cond text-[11px] uppercase tracking-[0.3em] text-flame">{m.unit}</p>
                <h3 className="mt-2 font-display text-lg uppercase">{m.name}</h3>
                <p className="mt-1 font-sans text-sm text-ash">{m.role}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function JoinCta() {
  return (
    <section className="relative overflow-hidden bg-flame py-20 text-black sm:py-28">
      <img
        src="/img/join.jpg"
        alt=""
        onError={(e) => (e.currentTarget.style.display = 'none')}
        className="absolute inset-0 h-full w-full object-cover opacity-15 mix-blend-multiply grayscale"
      />
      <div className="shell relative grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <Reveal>
          <p className="font-cond text-sm uppercase tracking-[0.35em]">How to join</p>
          <h2 className="display mt-5 text-5xl sm:text-7xl">
            No fees.
            <br />
            No experience.
            <br />
            Just show up.
          </h2>
        </Reveal>
        <Reveal delay={120} className="space-y-6">
          <p className="font-sans text-lg leading-relaxed text-black/80">
            Every shoot, session and update goes out on our socials first. Follow along, or come find yourself in
            the gallery from the last event.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={club.instagram}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center bg-black px-7 py-4 font-display text-sm uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5"
            >
              {club.handle}
            </a>
            <Link
              to="/gallery"
              className="inline-flex items-center justify-center border-2 border-black px-7 py-4 font-display text-sm uppercase tracking-wide transition-colors hover:bg-black hover:text-white"
            >
              Face search →
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <>
      <Hero />
      <Stats />
      <About />
      <GalleryPreview />
      <Events />
      <Team />
      <JoinCta />
    </>
  )
}
