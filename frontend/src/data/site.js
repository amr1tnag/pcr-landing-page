// Single source of truth for all landing-page copy.
// Swap image paths for real files dropped into frontend/public/img/.

export const club = {
  name: 'PhotoCircle',
  campus: 'RAIT',
  tagline: 'Capturing moments, building community',
  blurb:
    'The official media team of Ramrao Adik Institute of Technology. We shoot, we edit, we deliver — and most of us walked in knowing nothing about a camera.',
  hashtag: '#WeThePCR',
  instagram: 'https://instagram.com/photocircle_rait',
  handle: '@photocircle_rait',
  email: 'photocircle@rait.ac.in',
  location: 'Dr. D. Y. Patil Campus, Nerul, Navi Mumbai',
}

export const nav = [
  { label: 'Home', href: '/#top' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'About', href: '/#about' },
  { label: 'Events', href: '/#events' },
  { label: 'Contact', href: '/#contact' },
]

export const stats = [
  { value: '40+', label: 'Events covered a year' },
  { value: '24h', label: 'Shot today, posted today' },
  { value: '60+', label: 'Active members' },
  { value: '0', label: 'Fees to join' },
]

export const pillars = [
  {
    title: 'Learn',
    body: 'Photography and editing taught by seniors, on real shoots — not slide decks.',
  },
  {
    title: 'Build',
    body: 'A portfolio of real events by the end of your first year, with your name on it.',
  },
  {
    title: 'Belong',
    body: 'A crew that is backstage at every event on campus, pass around their neck.',
  },
]

export const roles = [
  'Photographers',
  'Videographers',
  'Photo editors',
  'Video editors',
  'Design & graphics',
  'Social media',
]

// Gallery preview — eight frames from recent coverage.
export const featured = [
  { id: 'f1', event: 'Horizon', caption: 'Main stage, closing night', src: '/img/horizon-01.jpg', tone: 'from-purple-900/60' },
  { id: 'f2', event: 'DYT20', caption: 'The winning run', src: '/img/dyt20-01.jpg', tone: 'from-blue-900/60' },
  { id: 'f3', event: 'Ganpati', caption: 'Bappa, up close', src: '/img/ganpati-01.jpg', tone: 'from-amber-800/60' },
  { id: 'f4', event: 'Marathon', caption: 'Kilometre nine', src: '/img/marathon-01.jpg', tone: 'from-emerald-900/60' },
  { id: 'f5', event: 'Horizon', caption: 'In the pit', src: '/img/horizon-02.jpg', tone: 'from-rose-900/60' },
  { id: 'f6', event: 'Fest', caption: 'Lights down, hands up', src: '/img/fest-01.jpg', tone: 'from-sky-900/60' },
  { id: 'f7', event: 'DYT20', caption: 'The embrace at the crease', src: '/img/dyt20-02.jpg', tone: 'from-slate-700/60' },
  { id: 'f8', event: 'Marathon', caption: 'Finish-line high-fives', src: '/img/marathon-02.jpg', tone: 'from-orange-900/60' },
]

export const events = [
  {
    name: 'Induction 2026',
    date: 'Aug 2026',
    status: 'upcoming',
    blurb: 'No fees. No experience. Just show up — the intake session for the next crew.',
  },
  {
    name: 'Horizon',
    date: 'Mar 2026',
    status: 'past',
    blurb: 'The cultural night. Three stages, one pit, and the longest edit session of the year.',
  },
  {
    name: 'DY Patil T20 (DYT20)',
    date: 'Mar 2026',
    status: 'past',
    blurb: 'Stadium coverage from the press box — sport shot fast and cut faster.',
  },
  {
    name: 'RAIT Marathon',
    date: 'Jan 2026',
    status: 'past',
    blurb: 'Sunrise start, nine kilometres, and a finish line full of faces to find.',
  },
  {
    name: 'Ganpati Utsav',
    date: 'Sep 2025',
    status: 'past',
    blurb: 'Campus mandap, aarti to visarjan, documented end to end.',
  },
]

export const team = [
  { name: 'Secretary', role: 'Leads the club', unit: 'Core' },
  { name: 'Joint Secretary', role: 'Runs the shoot roster', unit: 'Core' },
  { name: 'Head of Photography', role: 'Stills, every event', unit: 'Photo' },
  { name: 'Head of Videography', role: 'Reels and recaps', unit: 'Video' },
  { name: 'Head of Editing', role: 'Same-day delivery', unit: 'Post' },
  { name: 'Head of Design', role: 'Posters and identity', unit: 'Design' },
  { name: 'Social Media Lead', role: 'Everything you see on the grid', unit: 'Social' },
  { name: 'Members', role: '60+ students across every year', unit: 'Crew' },
]
