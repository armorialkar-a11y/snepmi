import { heroGeometry, heroFrame, dampedSpring } from '../lib/animation.js';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ABOUT,
  APPROACH,
  CATALOG_PAGE,
  CATALOG_TEASER,
  CASES,
  CONTACTS,
  FAQ,
  FORMATS,
  HERO_INTRO,
  HERO_SCROLL,
  MANIFESTO,
  PROCESS,
  SERVICES,
} from '../lib/content.js';
import { displayName, sortBloggers, tagsLine } from '../lib/blogger.js';
import { useStore } from '../lib/store.jsx';
import { haptic } from '../lib/telegram.js';
import { SectionIndex, SiteFooter, SiteHeader, SkipLink, SmartLink } from '../components/Layout.jsx';
import Envelope from '../components/Envelope.jsx';
import { SafeImage, SocialLinks } from '../components/BloggerCard.jsx';
import { ArrowUpRight, PhoneStatus, Plus, ScrollCue } from '../components/icons.jsx';

const RAIL_OFFSETS = [-3, -2, -1, 1, 2, 3];

export default function HomePage() {
  const { bloggers, status, openLead, reload } = useStore();
  const authors = useMemo(() => sortBloggers(bloggers), [bloggers]);
  const [stored, setActive] = useState(0);
  // The catalogue shrinks when an admin unpublishes an author, so the stored
  // index is clamped instead of trusted — otherwise the carousel reads `undefined`.
  const active = stored < authors.length ? stored : 0;

  return (
    <>
      <SkipLink to="#main" label="К содержимому" />
      <SiteHeader />
      <main id="main">
        <HeroScroll />
        <HeroIntro />
        <ManifestoStrip />

        <section id="bloggers" className="catalog section-pad">
          <SectionIndex left={CATALOG_TEASER.index[0]} right={CATALOG_TEASER.index[1]} />
          <div className="section-heading">
            <EditorialTitle id="catalog-title" lines={CATALOG_TEASER.title} breaks={0} />
            <p>{CATALOG_TEASER.lead}</p>
          </div>

          {status === 'loading' ? (
            <div className="phone-empty">
              <span className="eyebrow">Каталог</span>
              <h3>Загружаем авторов…</h3>
            </div>
          ) : status === 'ready' && authors.length ? (
            <BloggerCarousel authors={authors} active={active} setActive={setActive} onDiscuss={openLead} />
          ) : (
            <PhoneEmpty status={status} onRetry={reload} />
          )}

          {authors.length ? (
            <>
              <div className="carousel-controls">
                <button className="arrow" aria-label="Предыдущий блогер" onClick={() => step(authors, setActive, -1)}>
                  ←
                </button>
                <span>
                  {String(active + 1).padStart(2, '0')} / {authors.length} · {authors[active]?.name}
                </span>
                <button className="arrow" aria-label="Следующий блогер" onClick={() => step(authors, setActive, 1)}>
                  →
                </button>
              </div>
              <div className="catalog-all">
                <SmartLink className="btn dark" to="/bloggers">
                  {CATALOG_TEASER.allCta}
                  <span aria-hidden="true">↗</span>
                </SmartLink>
              </div>
            </>
          ) : null}

          <p className="catalog-foot">
            {CATALOG_TEASER.foot}{' '}
            <button onClick={() => openLead([])}>{CATALOG_TEASER.footCta}</button>
          </p>
        </section>

        <About />
        <Services />
        <Process />
        <Approach />
        <Formats />
        <Cases />
        <Faq />

        <section id="contacts" className="contacts section-pad">
          <SectionIndex left={CONTACTS.index[0]} right={CONTACTS.index[1]} />
          <div className="contact-heading">
            <span className="eyebrow">{CONTACTS.eyebrow}</span>
            <h2 id="contacts-title">
              {CONTACTS.title[0]}{' '}
              <em>
                {CONTACTS.title[1]}
                <Plus size={24} />
              </em>
            </h2>
            <p>
              {joinLines(CONTACTS.lead)}
              <br />
            </p>
          </div>
          <Envelope />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function step(authors, setActive, direction) {
  haptic('light');
  setActive((previous) => (previous + direction + authors.length) % authors.length);
}

function HeroScroll() {
  const section = useRef(null);
  useLayoutEffect(() => {
    const node = section.current;
    if (!node) return;
    const stage = node.querySelector('.hero-scroll-stage');
    const art = node.querySelector('.hero-scroll-art');
    const logo = node.querySelector('.hero-scroll-logo');
    const caption = node.querySelector('.hero-scroll-caption');
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let geometry;
    let scrollStart = 0, travel = 1;
    let frame = 0, lastTime = null;
    let scale = { value: 1.1, velocity: 0 };
    let lift = { value: 0, velocity: 0 };
    let progress = { value: 0, velocity: 0 };
    const draw = () => {
      art.style.transform = `translate3d(0, ${lift.value}px, 0) scale(${scale.value})`;
      caption.style.opacity = String(0.35 + progress.value * 0.65);
    };
    const tick = (now) => {
      frame = 0;
      const target = media.matches ? 0 : Math.max(0, Math.min(1, (window.scrollY - scrollStart) / travel));
      const goal = heroFrame(target, geometry);
      // Keep velocity through wheel/touch changes and reversals. A capped timestep
      // prevents catch-up jumps after a stalled frame or a backgrounded WebView.
      const dt = lastTime === null ? 0 : Math.min(0.032, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      scale = dampedSpring(scale, goal.scale, dt);
      lift = dampedSpring(lift, goal.y, dt);
      progress = dampedSpring(progress, target, dt);
      const settled = Math.abs(scale.value - goal.scale) < 0.00001 && Math.abs(scale.velocity) < 0.0001
        && Math.abs(lift.value - goal.y) < 0.01 && Math.abs(lift.velocity) < 0.1
        && Math.abs(progress.value - target) < 0.0001 && Math.abs(progress.velocity) < 0.001;
      if (settled || media.matches) {
        scale = { value: goal.scale, velocity: 0 };
        lift = { value: goal.y, velocity: 0 };
        progress = { value: target, velocity: 0 };
      }
      draw();
      if (!settled && !media.matches) frame = requestAnimationFrame(tick);
      else lastTime = null;
    };
    const refresh = () => { if (!frame) frame = requestAnimationFrame(tick); };
    const measure = () => {
      geometry = heroGeometry({
        stageWidth: stage.clientWidth, stageHeight: stage.clientHeight,
        artWidth: art.offsetWidth, artHeight: art.offsetHeight, artTop: art.offsetTop,
        logoHeight: logo.offsetHeight, mobile: window.matchMedia('(max-width: 760px)').matches,
      });
      const stickyTop = parseFloat(getComputedStyle(stage).top) || 0;
      scrollStart = node.getBoundingClientRect().top + window.scrollY - stickyTop;
      travel = Math.max(1, node.offsetHeight - stage.offsetHeight);
      // Updating responsive geometry changes the destination, never the current
      // transform. No synchronous redraw/snap from ResizeObserver.
      refresh();
    };
    measure();
    const observer = new ResizeObserver(measure);
    [node, stage, logo, art].forEach((element) => observer.observe(element));
    window.addEventListener('scroll', refresh, { passive: true });
    window.addEventListener('resize', measure);
    media.addEventListener('change', measure);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', refresh);
      window.removeEventListener('resize', measure);
      media.removeEventListener('change', measure);
    };
  }, []);

  return (
    <section className="hero-scroll" ref={section} aria-label="SNEPMI AGENCY — фирменные персонажи">
      <div className="hero-scroll-stage">
        <div className="hero-scroll-top hero-top">
          <span>{HERO_SCROLL.top[0]}</span>
          <span>{HERO_SCROLL.top[1]}</span>
        </div>
        <div className="hero-scroll-logo">
          snepmi<span>®</span>
        </div>
        <div className="hero-scroll-art" style={{ transform: 'translate3d(0, 0px, 0) scale(1.1)' }}>
          <img src="/images/site/hero-dolls.webp" alt={HERO_SCROLL.artAlt} />
        </div>
        <div className="hero-scroll-caption" style={{ opacity: 0.35 }}>
          <Plus />
          <span>
            {joinLines(HERO_SCROLL.caption)}
            <br />
          </span>
        </div>
        <div className="hero-scroll-bottom hero-bottom">
          <span>{HERO_SCROLL.bottom}</span>
          <SmartLink to="#intro">{HERO_SCROLL.scrollCta}</SmartLink>
        </div>
      </div>
    </section>
  );
}

function HeroIntro() {
  return (
    <section id="intro" className="hero-intro section-pad">
      <div className="hero-copy">
        <span className="micro-label">
          {HERO_INTRO.microLabel}
          <i aria-hidden="true" />
        </span>
        <h1 id="hero-title">
          {joinLines(HERO_INTRO.title.slice(0, -1))}
          <br />
          <br />
          <em>{HERO_INTRO.title.at(-1)}</em>
        </h1>
        <p>
          {joinLines(HERO_INTRO.lead)}
          <br />
          <br className="desktop" />
        </p>
        <div className="hero-actions">
          <SmartLink className="btn dark" to="#bloggers">
            Смотреть блогеров
            <span aria-hidden="true">↗</span>
          </SmartLink>
          <SmartLink className="text-link" to="#contacts">
            Связаться с нами ↗
          </SmartLink>
        </div>
      </div>
    </section>
  );
}

function joinLines(value) {
  return (Array.isArray(value) ? value : value.split('\n')).join(' ');
}

function EditorialTitle({ id, lines, breaks = 2 }) {
  const accent = lines.at(-1);
  return (
    <h2 id={id}>
      {joinLines(lines.slice(0, -1))}
      {breaks === 0 ? ' ' : null}
      {Array.from({ length: breaks }, (_, index) => (
        <br key={index} />
      ))}
      <em>{accent}</em>
    </h2>
  );
}

function ManifestoStrip() {
  return (
    <div className="manifesto-strip">
      {MANIFESTO.map((word, index) => (
        <Fragment key={word}>
          {index > 0 ? <Plus size={16} /> : null}
          <span>{word}</span>
        </Fragment>
      ))}
    </div>
  );
}

function PhoneEmpty({ status, onRetry }) {
  return (
    <div className="phone-empty">
      <span className="eyebrow">Каталог</span>
      <h3>Авторы пока не загружены</h3>
      <p>{status === 'error' ? 'Не удалось загрузить каталог.' : 'Как только администратор добавит блогеров, они появятся здесь.'}</p>
      <button className="btn dark" onClick={onRetry}>
        Обновить
      </button>
    </div>
  );
}

function BloggerCarousel({ authors, active, setActive, onDiscuss }) {
  const touch = useRef(null);
  const current = authors[active];
  const facts = [
    [CATALOG_PAGE.audience, current.audience],
    [CATALOG_PAGE.geography, current.geography],
  ].filter(([, value]) => value);

  const seen = new Set([active]);
  const rail = [];
  for (const offset of RAIL_OFFSETS) {
    const index = (active + offset + authors.length) % authors.length;
    if (seen.has(index)) continue;
    seen.add(index);
    rail.push({ offset, index });
  }

  return (
    <div
      className="carousel"
      aria-label={CATALOG_TEASER.carouselLabel}
      onTouchStart={(event) => {
        touch.current = event.changedTouches[0].clientX;
      }}
      onTouchEnd={(event) => {
        if (touch.current === null) return;
        const delta = event.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(delta) < 40) return;
        step(authors, setActive, delta < 0 ? 1 : -1);
      }}
    >
      <div className="rail-line" />

      {rail.map(({ offset, index }) => {
        const blogger = authors[index];
        return (
          <button
            key={blogger.id}
            className="side-card"
            style={{
              transform: `translateX(calc(-50% + ${offset * 232}px)) rotate(${offset * -3}deg) scale(${1 - Math.abs(offset) * 0.06})`,
              opacity: Math.max(1 - Math.abs(offset) * 0.22, 0.25),
              zIndex: 6 - Math.abs(offset),
            }}
            aria-label={`Показать ${displayName(blogger)}`}
            onClick={() => {
              haptic('light');
              setActive(index);
            }}
          >
            {blogger.image_url ? (
              <SafeImage className="side-doll" src={blogger.image_url} alt="" loading="lazy" />
            ) : (
              <span className="empty-slot">
                <Plus size={40} />
                <small>{displayName(blogger)}</small>
              </span>
            )}
            <strong>{displayName(blogger)}</strong>
            <small>{blogger.platform}</small>
          </button>
        );
      })}

      <div className="phone">
        <div className="phone-screen">
          <div className="phone-status">
            <span>9:41</span>
            <span className="island" />
            <PhoneStatus />
          </div>
          <div className="phone-brand">
            <span>snepmi</span>
            <Plus size={16} />
          </div>
          <div className="phone-content">
            <div className={`profile-art ${current.image_kind === 'cutout' ? 'is-cutout' : 'is-photo'}`}>
              {current.image_url ? <SafeImage src={current.image_url} alt={current.name} /> : <span className="missing-image"><Plus size={40} />{current.name}</span>}
            </div>
            <div id="active-blogger-info" className="profile-copy">
              <small>{current.platform}</small>
              <h3>{current.name}</h3>
              {facts.length ? (
                <dl className="profile-facts">
                  {facts.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {current.topics?.length ? <p className="tags">{tagsLine(current)}</p> : null}
              <SocialLinks blogger={current} />
              {current.rkn_registered ? <p className="rkn-badge">РКН: да</p> : null}
              <button className="btn dark full" onClick={() => onDiscuss([current.id])}>
                Обсудить рекламу<span aria-hidden="true">↗</span>
              </button>
            </div>
          </div>
          <a
            className="phone-scroll-cue"
            href="#active-blogger-info"
            aria-label={`Контакты и ${current.platform} выбранного блогера — ${current.name}`}
          >
            <ScrollCue />
          </a>
          <div className="home-indicator" />
        </div>
      </div>

      <div className="phone-note">
        <span className="note-line" />
        <span>
          {joinLines(CATALOG_TEASER.phoneNote)}
          <br />
        </span>
      </div>
    </div>
  );
}

function About() {
  return (
    <section id="about" className="about editorial-section section-pad">
      <SectionIndex left={ABOUT.index} />
      <div className="editorial-heading chrome-about">
        <div className="chrome-panel chrome-silver chrome-title">
          <EditorialTitle id="about-title" lines={ABOUT.title} />
        </div>
        <div className="editorial-copy chrome-panel chrome-pink">
          {ABOUT.paragraphs.map((text) => (
            <p key={text.slice(0, 24)}>{text}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

const SERVICE_TONES = ['chrome-pink', 'chrome-silver', 'chrome-silver', 'chrome-pink', 'chrome-silver'];

function Services() {
  return (
    <section id="services" className="editorial-section section-pad">
      <SectionIndex left={SERVICES.index[0]} right={SERVICES.index[1]} />
      <div className="editorial-heading">
        <EditorialTitle id="services-title" lines={SERVICES.title} breaks={1} />
        <p className="editorial-lead">{SERVICES.lead}</p>
      </div>
      <div className="service-list">
        {SERVICES.rows.map(([title, text], index) => (
          <article key={title} className={`service-row chrome-panel ${SERVICE_TONES[index] || 'chrome-silver'}`}>
            <span className="editorial-number">{String(index + 1).padStart(2, '0')}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Process() {
  return (
    <section id="process" className="editorial-section editorial-soft section-pad">
      <SectionIndex left={PROCESS.index} />
      <div className="editorial-heading">
        <EditorialTitle id="process-title" lines={PROCESS.title} />
        <p className="editorial-lead">{PROCESS.lead}</p>
      </div>
      <ol className="process-list chrome-panel chrome-silver chrome-process">
        {PROCESS.steps.map(([title, text], index) => (
          <li key={title}>
            <span className="process-number">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const PRINCIPLE_TONES = ['chrome-silver', 'chrome-pink', 'chrome-pink', 'chrome-silver'];

function Approach() {
  return (
    <section id="approach" className="editorial-section section-pad">
      <SectionIndex left={APPROACH.index[0]} right={APPROACH.index[1]} />
      <div className="editorial-heading">
        <EditorialTitle id="approach-title" lines={APPROACH.title} />
        <div className="editorial-copy">
          {APPROACH.paragraphs.map((text) => (
            <p key={text.slice(0, 24)}>{text}</p>
          ))}
        </div>
      </div>
      <div className="principle-grid">
        {APPROACH.principles.map(([title, text], index) => (
          <article key={title} className={`chrome-panel chrome-plate ${PRINCIPLE_TONES[index]}`}>
            <span className="editorial-number">{String(index + 1).padStart(2, '0')} /</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Formats() {
  const { bloggers } = useStore();
  const formats = useMemo(() => {
    const set = new Set();
    for (const blogger of bloggers) for (const format of blogger.formats || []) set.add(format);
    return [...set];
  }, [bloggers]);

  return (
    <section id="formats" className="editorial-section editorial-soft section-pad">
      <SectionIndex left={FORMATS.index[0]} />
      <div className="editorial-heading">
        <EditorialTitle id="formats-title" lines={FORMATS.title} breaks={1} />
        <p className="editorial-lead">{FORMATS.lead}</p>
      </div>
      {formats.length ? (
        <div className="format-grid">
          {formats.map((format) => (
            <article key={format} className="chrome-panel chrome-plate chrome-silver">
              <h3>{format}</h3>
            </article>
          ))}
        </div>
      ) : (
        <div className="editorial-empty chrome-panel chrome-pink chrome-plate">
          <Plus size={28} />
          <p>
            {FORMATS.empty[0]}
            <br />
            {FORMATS.empty[1]}
          </p>
          <SmartLink className="text-link" to="#contacts">
            {FORMATS.cta}
          </SmartLink>
        </div>
      )}
    </section>
  );
}

function Cases() {
  return (
    <section id="cases" className="editorial-section section-pad">
      <SectionIndex left={CASES.index[0]} right={CASES.index[1]} />
      <div className="editorial-heading">
        <EditorialTitle id="cases-title" lines={CASES.title} />
        <p className="editorial-lead">{CASES.lead}</p>
      </div>
      <div className="portfolio-note chrome-panel chrome-silver chrome-plate">
        <span className="portfolio-mark">
          <ArrowUpRight />
        </span>
        <div>
          <h3>{CASES.note[0]}</h3>
          <p>{CASES.note[1]}</p>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="editorial-section editorial-soft section-pad">
      <SectionIndex left={FAQ.index} />
      <div className="faq-layout">
        <EditorialTitle id="faq-title" lines={FAQ.title} breaks={1} />
        <div className="faq-list chrome-panel chrome-silver chrome-faq">
          {FAQ.items.map(([question, answer]) => (
            <details key={question} name="snepmi-faq">
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
