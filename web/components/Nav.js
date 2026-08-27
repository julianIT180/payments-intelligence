import Link from 'next/link';

const links = [
  { href: '/', label: 'Feed' },
  { href: '/companies', label: 'Companies' },
  { href: '/reports', label: 'Reports' },
  { href: '/about', label: 'About' }
];

export default function Nav() {
  return (
    <nav className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center gap-6 px-6 py-3">
        <Link href="/" className="text-sm font-semibold tracking-tight text-stone-900">
          Payments Intelligence
        </Link>
        <div className="flex gap-5 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-stone-500 transition hover:text-stone-900">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}