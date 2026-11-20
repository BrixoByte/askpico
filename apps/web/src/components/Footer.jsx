import React from 'react';

const PRODUCT_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
];

const RESOURCE_LINKS = [
  { label: 'Docs', href: '#docs' },
  { label: 'API', href: '#api' },
  { label: 'System Status', href: '#status' },
];

const LEGAL_LINKS = [
  { label: 'Privacy Policy', href: '#privacy' },
  { label: 'Terms of Service', href: '#terms' },
];

const SOCIAL_LINKS = [
  {
    label: 'Twitter / X',
    href: 'https://twitter.com',
    path: 'M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z',
  },
  {
    label: 'GitHub',
    href: 'https://github.com',
    path: 'M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21',
  },
  {
    label: 'Discord',
    href: 'https://discord.com',
    path: 'M9 10a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM7 4c2.5-1 7.5-1 10 0l1 4c1 4 .5 8-1 10-2 .8-3.5 1-4 1l-1-2c-1 .3-2.5.3-4 0l-1 2c-.5 0-2-.2-4-1-1.5-2-2-6-1-10z',
  },
];

const linkClass = 'text-sm text-zinc-400 transition-colors hover:text-zinc-100';

const LinkColumn = ({ title, links }) => (
  <div className="flex flex-col items-center gap-3 md:items-start">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</h3>
    <ul className="flex flex-col items-center gap-2 md:items-start">
      {links.map((link) => (
        <li key={link.label}>
          <a href={link.href} className={linkClass}>
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  </div>
);

const Footer = () => {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 text-zinc-400">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 md:flex-row md:justify-between">
        <div className="flex flex-col items-center gap-3 text-center md:items-start md:text-left">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-sm font-bold text-zinc-950">
              P
            </span>
            <span className="text-lg font-bold tracking-tight text-zinc-100">Pico AI</span>
          </div>
          <p className="max-w-xs text-sm text-zinc-400">Empowering multi-modal AI conversations</p>
        </div>

        <nav className="grid grid-cols-1 gap-10 text-center sm:grid-cols-3 md:text-left">
          <LinkColumn title="Product" links={PRODUCT_LINKS} />
          <LinkColumn title="Resources" links={RESOURCE_LINKS} />
          <LinkColumn title="Legal" links={LEGAL_LINKS} />
        </nav>
      </div>

      <div className="border-t border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-6 md:flex-row md:justify-between">
          <p className="text-xs text-zinc-500">
            © {new Date().getFullYear()} Pico AI. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 transition-all hover:border-emerald-400 hover:text-emerald-400"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d={social.path} />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
