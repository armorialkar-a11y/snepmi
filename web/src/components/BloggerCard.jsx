import { useEffect, useState } from 'react';
import { CATALOG_PAGE } from '../lib/content.js';
import { adLink } from '../lib/blogger.js';
import { openLink } from '../lib/telegram.js';
import { CategoryBow, Heart, Megaphone, Pin, PlatformIcon, Plus, Sparkle } from './icons.jsx';

function external(event, url) {
  event.preventDefault();
  openLink(url);
}

const PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 4"><rect width="3" height="4" fill="#f1ede6"/><path d="M0 4 3 0" stroke="#ded8cd" stroke-width=".06"/></svg>'
)}`;

/** Catalogue pictures can point at an upload that was since deleted; never show a broken image. */
export function SafeImage({ src, ...rest }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <img src={failed ? PLACEHOLDER : src} onError={() => setFailed(true)} {...rest} />;
}

export function SocialLinks({ blogger, primary = false }) {
  const name = blogger.name;
  const links = blogger.social_links?.length
    ? blogger.social_links
    : blogger.social_url
      ? [{ platform: blogger.platform || 'TikTok', url: blogger.social_url }]
      : [];

  if (!links.length) return null;

  const shown = primary ? [links.find((link) => link.platform === blogger.platform) || links[0]] : links;

  return (
    <div className={primary ? 'social-links social-primary' : 'social-links'} aria-label={`${CATALOG_PAGE.socialNetworks} — ${name}`}>
      {shown.map((link) => (
        <a key={`${link.platform}${link.url}`} href={link.url} aria-label={`${link.platform} — ${name}`} onClick={(event) => external(event, link.url)}>
          <PlatformIcon platform={link.platform} />
          {primary ? <span>{link.platform}</span> : null}
          {primary ? <span className="card-link-arrow">↗</span> : null}
        </a>
      ))}
    </div>
  );
}

export function BloggerCard({ blogger, config, picked, onToggle }) {
  const name = blogger.name;
  const discuss = adLink(blogger, config);
  const facts = [
    [CATALOG_PAGE.audience, blogger.audience],
    [CATALOG_PAGE.geography, blogger.geography],
  ].filter(([, value]) => value);

  return (
    <article className="blogger-card">
      <div className={`blogger-card-image ${blogger.image_kind === 'cutout' ? 'is-cutout' : 'is-photo'}`}>
        {blogger.image_url ? (
          <SafeImage src={blogger.image_url} alt={name} loading="lazy" decoding="async" />
        ) : (
          <span className="missing-image">
            <Plus size={40} />
          </span>
        )}
        <label className="blogger-pick">
          <input
            type="checkbox"
            checked={Boolean(picked)}
            onChange={() => onToggle(blogger.id)}
            aria-label={`${CATALOG_PAGE.pick} ${name}`}
          />
          <Heart />
        </label>
      </div>

      <div className="blogger-card-copy">
        <div className="blogger-card-title">
          <h2>{blogger.name}</h2>
          <Sparkle />
        </div>

        {blogger.topics?.length ? (
          <div className="compact-niche" aria-label={CATALOG_PAGE.topics}>
            {blogger.topics.map((topic) => (
              <span key={topic}>{topic}</span>
            ))}
          </div>
        ) : null}

        {blogger.geography ? (
          <p className="compact-geography">
            <Pin />
            <span>{blogger.geography}</span>
          </p>
        ) : null}

        <div className="blogger-card-actions">
          <SocialLinks blogger={blogger} primary />
          <a className="card-advertising" href={discuss} aria-label={`${CATALOG_PAGE.discuss} — ${name}`} onClick={(event) => external(event, discuss)}>
            <Megaphone />
            <span>{CATALOG_PAGE.advertising}</span>
            <span className="card-link-arrow">↗</span>
          </a>
        </div>

        <details className="blogger-extra">
          <summary>
            <span>{CATALOG_PAGE.details}</span>
            <span className="details-rule" />
          </summary>
          <SocialLinks blogger={blogger} />
          {blogger.nickname ? <p className="nickname">{blogger.nickname}</p> : null}
          {blogger.rkn_registered === null || blogger.rkn_registered === undefined ? null : (
            <p className="rkn-badge">{blogger.rkn_registered ? CATALOG_PAGE.rknYes : CATALOG_PAGE.rknNo}</p>
          )}
          {facts.length ? (
            <dl className="blogger-card-facts">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {blogger.ad_terms?.length || blogger.ad_restrictions?.length ? (
            <div className="advertising-details">
              {blogger.ad_terms?.length ? (
                <>
                  <h4>{CATALOG_PAGE.conditions}</h4>
                  <ul>
                    {blogger.ad_terms.map((term) => (
                      <li key={term}>{term}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {blogger.ad_restrictions?.length ? (
                <>
                  <h4>{CATALOG_PAGE.restrictions}</h4>
                  <ul>
                    {blogger.ad_restrictions.map((term) => (
                      <li key={term}>{term}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </details>
      </div>
    </article>
  );
}

export function CategoryHeading({ id, title, count }) {
  return (
    <header className="category-heading">
      <h2 id={id}>{title}</h2>
      <CategoryBow />
      <span>{count}</span>
    </header>
  );
}

export function EmptyCatalog({ title, lead, cta }) {
  return (
    <div className="catalog-empty">
      <Plus size={34} />
      <h2>{title}</h2>
      <p>{lead}</p>
      {cta}
    </div>
  );
}
