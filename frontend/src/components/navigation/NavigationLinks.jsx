import { useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';

const links = [
  { path: '/', label: 'Home' },
  { path: '/about', label: 'About' },
  { path: '/features', label: 'Features' },
];

export default function NavigationLinks() {
  const location = useLocation();

  return (
    <nav className="flex items-center gap-6 text-sm font-medium" aria-label="Main navigation">
      {links.map((link) => (
        <Link
          key={link.path}
          to={link.path}
          className={`${
            location.pathname === link.path
              ? 'text-[#166534]'
              : 'text-[#64748B] hover:text-[#166534]'
          } transition-colors`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}