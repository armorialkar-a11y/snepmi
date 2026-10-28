import { useCallback, useState } from 'react';
import { NAV, SITE } from '../lib/content.js';
import { adLink } from '../lib/blogger.js';
import { currentPath, navigate, toHref } from '../lib/router.js';
import { useStore } from '../lib/store.jsx';
import { openLink } from '../lib/telegram.js';
import { Menu, Plus } from './icons.jsx';

function followLink(event, to) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return true;
  event.preventDefault();
  if (to === currentPath()) return false;
  navigate(to);
  return false;
}

/** `/bloggers` is a route, `#contacts` is an anchor inside the landing page. */
export function SmartLink({ to, children, className, ...rest }) {
  const path = currentPath();
  const onClick = useCallback(
    (event) => {
      if (/^https?:/i.test(to)) {
        event.preventDefault();
        openLink(to);
        return;
      }
      if (to.startsWith('#')) {
        if (to.startsWith('#/')) {
          followLink(event, to.slice(1));
          return;
        }
        if (path === '/') return; // let the browser smooth-scroll
        event.preventDefault();
        navigate('/');
        const id = to.slice(1);
        window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 100);
        return;
      }
      followLink(event, to);
    },
    [path, to]
  );

  return (
    <a className={className} href={toHref(to)} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}

function Brand({ label }) {
  return (
    <SmartLink className="brand" to="/" aria-label={label}>
      {SITE.brand}
      <span>{SITE.brandSuffix}</span>
    </SmartLink>
  );
}

export function SiteHeader({ variant = 'home' }) {
  const { openLead, config } = useStore();
  const [open, setOpen] = useState(false);

  if (variant === 'catalog') {
    return (
      <header className="header catalog-header">
        <Brand label="SNEPMI AGENCY — на главную" />
        <div className="catalog-header-links">
          <SmartLink className="text-link" to="/">
            ← На главную
          </SmartLink>
          {config?.telegram ? (
            <SmartLink className="btn small" to={adLink({}, config)}>
              Telegram<span aria-hidden="true">↗</span>
            </SmartLink>
          ) : (
            <button className="btn small" onClick={() => openLead()}>
              Обсудить рекламу<span aria-hidden="true">↗</span>
            </button>
          )}
        </div>
      </header>
    );
  }

  return (
    <header className="header">
      <Brand label="SNEPMI AGENCY — в начало" />
      <nav className={open ? 'nav is-visible' : 'nav'} aria-label="Основная навигация" onClick={() => setOpen(false)}>
        {NAV.map((item) => (
          <SmartLink key={item.href} to={item.href}>
            {item.label}
          </SmartLink>
        ))}
        <button
          className="btn small"
          onClick={(event) => {
            event.stopPropagation();
            setOpen(false);
            openLead();
          }}
        >
          Обсудить рекламу<span aria-hidden="true">↗</span>
        </button>
      </nav>
      <button
        className="menu-toggle"
        aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Menu />
      </button>
    </header>
  );
}

export function SiteFooter({ variant = 'home' }) {
  return (
    <footer className="footer">
      <Brand label="SNEPMI AGENCY — в начало" />
      {variant === 'home' ? <span>{SITE.tagline}</span> : null}
      <div>
        {variant === 'home' ? (
          <button className="text-link" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Наверх ↑
          </button>
        ) : (
          <SmartLink className="text-link" to="/">
            На главную ↗
          </SmartLink>
        )}
      </div>
    </footer>
  );
}

export function SectionIndex({ left, right }) {
  return (
    <div className="section-index">
      <span>{left}</span>
      {right ? <span>{right}</span> : <Plus size={24} />}
    </div>
  );
}

export function SkipLink({ to, label }) {
  return <a className="skip-link" href={to}>{label}</a>;
}
