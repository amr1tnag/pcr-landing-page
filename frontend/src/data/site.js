// Single source of truth for all site copy. Lines marked TODO need real details
// from the club. Images live in frontend/public/img/.

export const club = {
  name: 'PhotoCircle',
  campus: 'RAIT',
  tagline: 'Capturing moments, building community.',
  blurb:
    'PhotoCircle RAIT is the media team behind the campus. Most of us walked in knowing nothing about a camera.',
  hashtag: '#WeThePCR',
  instagram: 'https://instagram.com/photocircle_rait',
  handle: '@photocircle_rait',
  email: 'photocircle@rait.ac.in', // TODO: confirm the club's real address
  location: 'Ramrao Adik Institute of Technology, Nerul, Navi Mumbai',
}

// Labels and anchors are stable (nav, SEO, muscle memory). Change with care.
export const nav = [
  { label: 'Home', href: '/#top' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'About', href: '/#about' },
  { label: 'Events', href: '/#events' },
  { label: 'Contact', href: '/#contact' },
]

// The one primary call to action, used with this exact label everywhere.
export const primaryCta = { label: 'Find your photos', href: '/gallery' }

// What the club covers, shown once in the marquee.
export const coverage = ['Horizon', 'DYT20', 'Ganpati Utsav', 'RAIT Marathon', 'Felicitations', 'Cultural nights', 'Sports', 'Fests']

export const pillars = [
  { title: 'Learn', body: 'Photography and editing taught by seniors, on real shoots.' },
  { title: 'Build', body: 'A portfolio of real events by the end of your first year.' },
  { title: 'Belong', body: 'A crew that is backstage at every event on campus.' },
]

export const roles = ['Photographers', 'Videographers', 'Photo editors', 'Video editors', 'Design and graphics', 'Social media']

// Gallery bento: exactly eight frames, eight cells.
export const featured = [
  { id: 'f1', src: '/img/horizon-01.jpg', alt: 'Horizon: the singer on the main stage under purple light' },
  { id: 'f2', src: '/img/dyt20-01.jpg', alt: 'DYT20: a batter leaping after the winning run' },
  { id: 'f3', src: '/img/ganpati-01.jpg', alt: 'Ganpati Utsav: the idol, close up' },
  { id: 'f4', src: '/img/marathon-01.jpg', alt: 'RAIT Marathon: two runners mid-stride' },
  { id: 'f5', src: '/img/horizon-02.jpg', alt: 'Horizon: the singer kneeling at the edge of the stage' },
  { id: 'f6', src: '/img/fest-01.jpg', alt: 'College fest: the singer under pink stage light' },
  { id: 'f7', src: '/img/dyt20-02.jpg', alt: 'DYT20: two batters embracing at the crease' },
  { id: 'f8', src: '/img/marathon-02.jpg', alt: 'RAIT Marathon: runners high-fiving at the finish' },
]

// TODO: confirm event dates with the club.
export const upcoming = {
  name: 'Induction 2026',
  date: 'August 2026',
  blurb: 'The intake for the next crew. No fees and no experience needed. Bring yourself; we bring the cameras.',
}

export const pastEvents = [
  { name: 'Horizon', date: 'March 2026', blurb: 'The cultural night. Three stages, one pit, and the longest edit of the year.', src: '/img/horizon-01.jpg' },
  { name: 'DYT20', date: 'March 2026', blurb: 'Stadium coverage from the press box. Sport shot fast and cut faster.', src: '/img/dyt20-01.jpg' },
  { name: 'RAIT Marathon', date: 'January 2026', blurb: 'A sunrise start and a finish line full of faces to find.', src: '/img/marathon-01.jpg' },
  { name: 'Ganpati Utsav', date: 'September 2025', blurb: 'The campus mandap, from the first aarti to visarjan.', src: '/img/ganpati-01.jpg' },
]

// The core team, grouped. Each entry shows the name with the role under it.
export const team = [
  {
    group: 'Leadership',
    people: [
      { role: 'President', name: 'Dwijesh Rahatekar' },
      { role: 'Vice President', name: 'Soham Darne' },
      { role: 'Treasurer', name: 'Mansi Cheble' },
    ],
  },
  {
    group: 'Heads',
    people: [
      { role: 'Editor in Chief', name: 'Amrit Nag' },
      { role: 'Technical Head', name: 'Krrish Vaishya' },
      { role: 'Coordinator', name: 'Amey Nagesh' },
    ],
  },
]
