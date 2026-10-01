/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Brand palette from the induction deck. Dark-only by design: the brand is
      // black + one orange-red accent. No pure #000 / #fff anywhere.
      colors: {
        ink: '#0B0B0C', // page
        coal: '#131314', // raised sections
        smoke: '#1D1D1F', // image fallbacks, hovers
        bone: '#EFEDE8', // primary text (off-white)
        ash: '#9A9893', // secondary text, 7.0:1 on ink
        flame: '#FF3B14', // the single accent
      },
      fontFamily: {
        // Anton matches the deck's heavy condensed headlines; IBM Plex Sans its body.
        display: ['Anton', 'Impact', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      // z-index scale, used nowhere else: nav < mobile menu < film grain.
      zIndex: {
        nav: '50',
        grain: '60',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(28px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        rise: 'rise 0.9s cubic-bezier(0.16,1,0.3,1) both',
        marquee: 'marquee 38s linear infinite',
      },
    },
  },
  plugins: [],
}
