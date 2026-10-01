import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, InstagramLogo } from '@phosphor-icons/react'
import Frame from '../components/Frame.jsx'
import Reveal from '../components/Reveal.jsx'
import { club, coverage, featured, pastEvents, pillars, primaryCta, roles, team, upcoming } from '../data/site.js'

const rise = (ms) => ({ animationDelay: `${ms}ms` })

/* 1. Hero: full-bleed stage photo, title set like the deck's cover. */
function Hero() {
  return (
    <section id="top" className="relative flex min-h-[100dvh] items-end overflow-hidden">
      <img
        src="/img/hero.jpg"
        alt=""
        fetchpriority="high"
        className="absolute inset-0 h-full w-full object-cover object-[62%_35%]"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-ink/20" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-ink/80 via-ink/25 to-transparent" />

      <div className="shell relative pb-14 pt-24 md:pb-20">
        <p className="eyebrow motion-safe:animate-rise" style={rise(0)}>
          Official media team of RAIT
        </p>
        <h1 className="display mt-5 text-[clamp(4.25rem,14vw,10rem)] motion-safe:animate-rise" style={rise(80)}>
          PhotoCircle
          <span className="block text-flame">RAIT</span>
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-bone/85 motion-safe:animate-rise" style={rise(160)}>
          {club.tagline} Every frame here was shot, edited and posted by students.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row motion-safe:animate-rise" style={rise(240)}>
          <Link to={primaryCta.href} className="btn-primary group">
            {primaryCta.label}
            <ArrowRight size={18} weight="bold" className="motion-safe:transition-transform group-hover:translate-x-1" />
          </Link>
          <a href="#about" className="btn-ghost">
            Who we are
          </a>
        </div>
      </div>
    </section>
  )
}

/* 2. Marquee: the breadth of what gets covered. The only marquee on the page. */
function Coverage() {
  const row = (hidden) => (
    <ul
      aria-hidden={hidden || undefined}
      className={`flex shrink-0 items-center ${hidden ? 'motion-reduce:hidden' : 'motion-reduce:flex-wrap'}`}
    >
      {coverage.map((item) => (
        <li key={item} className="flex items-center">
          <span className="px-5 font-display text-4xl uppercase text-bone sm:px-7 sm:text-6xl">{item}</span>
          <span aria-hidden className="font-display text-4xl text-flame sm:text-6xl">
            /
          </span>
        </li>
      ))}
    </ul>
  )

  return (
    <section aria-label="What we cover" className="overflow-hidden border-y border-bone/10 bg-coal py-6 sm:py-8">
      <div className="flex w-max motion-safe:animate-marquee motion-reduce:w-full hover:[animation-play-state:paused]">
        {row(false)}
        {row(true)}
      </div>
    </section>
  )
}

/* 3. About: statement and pillars beside an offset two-photo collage. */
function About() {
  return (
    <section id="about" className="shell scroll-mt-20 py-24 md:py-32">
      <div className="grid gap-14 md:grid-cols-12 md:gap-10">
        <Reveal className="md:col-span-6 md:pt-6">
          <h2 className="display text-5xl sm:text-6xl lg:text-7xl">
            Every photo here was shot by <span className="whitespace-nowrap text-flame">a student</span>
          </h2>
          <p className="mt-7 max-w-[52ch] text-lg leading-relaxed text-bone/80">{club.blurb}</p>

          <dl className="mt-10 space-y-6 border-t border-bone/10 pt-8">
            {pillars.map((p) => (
              <div key={p.title} className="grid grid-cols-[6.5rem_1fr] items-baseline gap-4">
                <dt className="font-display text-2xl uppercase text-flame">{p.title}</dt>
                <dd className="leading-relaxed text-ash">{p.body}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal delay={120} className="relative md:col-span-6">
          <Frame src="/img/about.jpg" alt="A singer on stage in a wash of green light at Horizon" className="aspect-[4/5] md:ml-12" />
          <Frame
            src="/img/crew.jpg"
            alt="A performer in a red jacket on stage, shot from the pit"
            className="-mt-24 ml-auto aspect-[2/3] w-1/2 border-4 border-ink md:absolute md:-bottom-12 md:-left-4 md:mt-0 md:w-2/5"
          />
        </Reveal>
      </div>
    </section>
  )
}

/* 4. The standard: one full-bleed statement, as in the deck. */
function Standard() {
  return (
    <section className="relative flex min-h-[80dvh] items-center overflow-hidden">
      <img src="/img/standard.jpg" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[55%_30%]" />
      <div aria-hidden className="absolute inset-0 bg-ink/70" />
      <Reveal className="shell relative py-24 text-center">
        <p className="eyebrow">The standard</p>
        <h2 className="display mt-5 text-6xl sm:text-8xl lg:text-9xl">
          Shot today.
          <br />
          Posted today.
        </h2>
        <p className="mx-auto mt-7 max-w-[46ch] text-lg leading-relaxed text-bone/85">
          Every event, the photos and the edit go out the same day. You learn to shoot fast, cut fast and hold a
          standard while doing it.
        </p>
      </Reveal>
    </section>
  )
}

/* 5. Gallery: an eight-cell bento for eight frames. Images speak for themselves. */
const bentoSpans = {
  f1: 'col-span-2 row-span-2 md:col-span-4',
  f2: 'md:col-span-2',
  f3: 'md:col-span-2',
  f4: 'md:col-span-2',
  f5: 'md:col-span-2',
  f6: 'md:col-span-2',
  f7: 'md:col-span-3',
  f8: 'col-span-2 md:col-span-3',
}

function Gallery() {
  return (
    <section id="gallery" className="scroll-mt-20 bg-coal py-24 md:py-32">
      <div className="shell">
        <Reveal>
          <h2 className="display text-5xl sm:text-7xl">
            We cover <span className="text-flame">everything</span>
          </h2>
          <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-ash">
            Cultural nights, sports, fests and felicitations. If it happens at RAIT, we are there with a camera.
          </p>
        </Reveal>

        <div className="mt-12 grid auto-rows-[160px] grid-cols-2 gap-3 sm:auto-rows-[220px] md:grid-cols-6 md:gap-4 lg:auto-rows-[250px]">
          {featured.map((f, i) => (
            <Reveal key={f.id} delay={(i % 4) * 70} className={bentoSpans[f.id]}>
              <Frame src={f.src} alt={f.alt} className="h-full" />
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-12 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <p className="text-lg text-bone">Were you there?</p>
          <Link to={primaryCta.href} className="btn-primary group">
            {primaryCta.label}
            <ArrowRight size={18} weight="bold" className="motion-safe:transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

/* 6. Events: what's next, then a swipeable rail of past coverage. */
function Events() {
  const rail = useRef(null)
  const scroll = (dir) => rail.current?.scrollBy({ left: dir * rail.current.clientWidth * 0.8, behavior: 'smooth' })

  return (
    <section id="events" className="scroll-mt-20 py-24 md:py-32">
      <div className="shell">
        <Reveal>
          <h2 className="display text-5xl sm:text-7xl">Events</h2>
        </Reveal>

        <Reveal delay={80} className="mt-10 border-l-4 border-flame bg-coal p-7 sm:p-10">
          <div>
            <p className="text-sm font-semibold text-flame">Next up, {upcoming.date}</p>
            <h3 className="display mt-3 text-5xl sm:text-6xl">{upcoming.name}</h3>
            <p className="mt-4 max-w-[52ch] leading-relaxed text-ash">{upcoming.blurb}</p>
          </div>
        </Reveal>

        <div className="mt-16 flex items-end justify-between gap-6">
          <h3 className="text-xl font-semibold text-bone">Recently covered</h3>
          <div className="hidden gap-2 md:flex">
            <button type="button" onClick={() => scroll(-1)} aria-label="Scroll back" className="grid h-11 w-11 place-items-center border border-bone/25 text-bone transition-colors hover:border-bone active:scale-[0.97]">
              <ArrowLeft size={18} />
            </button>
            <button type="button" onClick={() => scroll(1)} aria-label="Scroll forward" className="grid h-11 w-11 place-items-center border border-bone/25 text-bone transition-colors hover:border-bone active:scale-[0.97]">
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <ul
        ref={rail}
        tabIndex={0}
        aria-label="Past events"
        className="rail mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 scroll-px-4 sm:px-8 sm:scroll-px-8 xl:px-[calc((100vw_-_80rem)/2_+_2rem)] xl:scroll-px-[calc((100vw_-_80rem)/2_+_2rem)]"
      >
        {pastEvents.map((e) => (
          <li key={e.name} className="w-[78vw] max-w-[24rem] shrink-0 snap-start sm:w-[22rem]">
            <Frame src={e.src} alt={`${e.name} coverage`} className="aspect-[4/3]" />
            <p className="mt-4 text-sm text-ash">{e.date}</p>
            <h4 className="mt-1 font-display text-3xl uppercase">{e.name}</h4>
            <p className="mt-2 text-sm leading-relaxed text-ash">{e.blurb}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* 7. Crew: the team photo, then where a new member fits and who runs it. */
function Crew() {
  return (
    <section id="team" className="scroll-mt-20 bg-coal py-24 md:py-32">
      <div className="shell">
        <Reveal>
          <h2 className="display text-5xl sm:text-7xl">
            Shot by <span className="text-flame">students</span>
          </h2>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-bone/80">
            No professionals and no hired crew. Just members who learned on the job, and seniors who teach the next
            batch the same way.
          </p>
        </Reveal>

        <Reveal delay={80} className="mt-12">
          <Frame
            src="/img/team.jpg"
            alt="The PhotoCircle RAIT team, grinning on the steps outside the institute"
            className="aspect-[4/3] sm:aspect-[16/9]"
            imgClassName="object-[50%_40%]"
          />
        </Reveal>

        <div className="mt-14 grid gap-14 md:grid-cols-12 md:gap-10">
          <Reveal className="md:col-span-5">
            <h3 className="text-base font-semibold text-bone">Where you fit in</h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {roles.map((r) => (
                <li key={r} className="border border-bone/20 px-4 py-2 text-sm text-bone/85">
                  {r}
                </li>
              ))}
              <li className="bg-flame px-4 py-2 text-sm font-semibold text-ink">Anyone else: we train you</li>
            </ul>
          </Reveal>

          <Reveal delay={120} className="md:col-span-6 md:col-start-7">
            <h3 className="text-base font-semibold text-bone">Who runs it</h3>
            <div className="mt-4 space-y-8">
              {team.map((g) => (
                <div key={g.group} className="border-t border-bone/10 pt-5">
                  <p className="text-sm text-flame">{g.group}</p>
                  <ul className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                    {g.people.map((p) => (
                      <li key={p.role}>
                        {p.name ? (
                          <>
                            <span className="block text-lg font-medium text-bone">{p.name}</span>
                            <span className="text-sm text-ash">{p.role}</span>
                          </>
                        ) : (
                          <span className="block text-lg font-medium text-bone">{p.role}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* 8. Join: the deck's orange slide, used once, as the closing call. */
function Join() {
  return (
    <section className="relative overflow-hidden bg-flame py-24 text-ink md:py-32">
      <div className="shell grid gap-12 md:grid-cols-12 md:items-end">
        <Reveal className="md:col-span-7">
          <p className="eyebrow !text-ink">How to join</p>
          <h2 className="display mt-5 text-6xl sm:text-8xl">
            No fees.
            <br />
            No experience.
            <br />
            Just show up.
          </h2>
        </Reveal>
        <Reveal delay={120} className="md:col-span-5">
          <p className="max-w-[40ch] text-lg leading-relaxed text-ink/85">
            Every shoot, session and update goes out on Instagram first. Follow along and come to the next induction.
          </p>
          <a href={club.instagram} target="_blank" rel="noreferrer" className="btn mt-8 bg-ink text-bone hover:-translate-y-0.5">
            <InstagramLogo size={20} weight="bold" />
            Follow on Instagram
          </a>
        </Reveal>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <>
      <Hero />
      <Coverage />
      <About />
      <Standard />
      <Gallery />
      <Events />
      <Crew />
      <Join />
    </>
  )
}
