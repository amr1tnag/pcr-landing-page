import { Link } from 'react-router-dom'

/** The club's camera mark (from the induction deck) plus the wordmark in type. */
export default function Logo({ className = '' }) {
  return (
    <Link to="/" className={`flex items-center gap-3 ${className}`} aria-label="PhotoCircle RAIT, home">
      <img src="/img/logo-mark.png" alt="" width="40" height="29" className="h-7 w-auto sm:h-8" />
      <span className="font-display text-lg uppercase leading-none tracking-wide sm:text-xl">
        PhotoCircle <span className="text-flame">RAIT</span>
      </span>
    </Link>
  )
}
