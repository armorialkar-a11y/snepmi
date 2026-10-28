import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { envelopeFrame } from '../lib/animation.js';
import { CONTACTS, HERO_SCROLL, SITE } from '../lib/content.js';
import { telegramHandle } from '../lib/blogger.js';
import { useStore } from '../lib/store.jsx';
import { haptic, openLink } from '../lib/telegram.js';
import { Plus } from './icons.jsx';

export default function Envelope() {
  const { config, openLead } = useStore();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const current = useRef(0);
  const stage = useRef(null);
  const paper = useRef(null);
  const [size, setSize] = useState({ paper: 600, stage: 500 });
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useLayoutEffect(() => {
    const measure = () => {
      if (paper.current && stage.current) setSize({ paper: paper.current.offsetHeight, stage: stage.current.offsetHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(paper.current);
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const target = open ? 1 : 0;
    const start = current.current;
    const duration = 960 * Math.abs(target - start);
    let raf = 0;
    let began;
    const update = (value) => { current.current = value; setProgress(value); };
    if (reduced || !duration) { update(target); return; }
    const tick = (now) => {
      began ??= now;
      const t = Math.min(1, (now - began) / duration);
      update(start + (target - start) * t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, reduced]);
  const frame = envelopeFrame(progress, size.paper, size.stage);
  const revealed = open && progress === 1;

  const primary = config?.telegram || 'https://t.me/nesssvt';
  const primaryHandle = telegramHandle(primary);
  const secondary = SITE.secondaryContact;
  const [line1, line2, line3] = CONTACTS.letter.title;

  const toggle = () => {
    haptic(open ? 'light' : 'medium');
    setOpen((value) => !value);
  };

  return (
    <div className={`envelope-wrap envelope-v8 envelope-v10 ${open ? 'is-open' : ''}`}>
      <div className="envelope-hint" style={{ marginBottom: frame.clearance }}>
        <Plus size={14} />
        <span>{CONTACTS.hint}</span>
      </div>

      <div className="envelope-stage" ref={stage}>
        <img className="envelope-back" src="/images/site/envelope-back.webp" alt="" />

        <div
          className="envelope-flap"
          style={{ transform: `rotateX(${frame.angle}deg)`, zIndex: frame.layer, transition: 'none' }}
          aria-hidden="true"
          onClick={toggle}
        >
          <img src="/images/site/envelope-flap.webp" alt="" />
        </div>

        <div className="letter-window">
          <div
            ref={paper}
            id="agency-letter"
            inert={revealed ? undefined : ''}
            aria-hidden={!revealed}
            className="letter"
            style={{ transform: `translate3d(0, ${frame.paperY}px, 0)`, transition: 'none' }}
          >
            <div className="letter-top">
              <span>{CONTACTS.letter.top}</span>
              <Plus />
            </div>
            <h3>
              {line1}
              <br />
              {line2}
              <br />
              <em>{line3}</em>
            </h3>
            <p>{CONTACTS.letter.lead}</p>

            <div className="letter-contacts">
              <span>{CONTACTS.letter.primaryLabel}</span>
              <a
                href={primary}
                onClick={(event) => {
                  event.preventDefault();
                  openLink(primary);
                }}
              >
                {primaryHandle}
              </a>
            </div>

            <div className="letter-contacts letter-additional-contact">
              <span>{secondary.label}</span>
              <a
                href={secondary.url}
                onClick={(event) => {
                  event.preventDefault();
                  openLink(secondary.url);
                }}
              >
                {secondary.handle}
              </a>
            </div>

            <button
              className="btn dark full"
              onClick={() => {
                const link = `${primary}${primary.includes('?') ? '&' : '?'}text=${encodeURIComponent(SITE.adPrefill)}`;
                openLink(link);
              }}
            >
              {CONTACTS.letter.cta}
            </button>
            <button className="text-link envelope-form-link" onClick={() => openLead([])}>
              Или заполните заявку в приложении ↗
            </button>
          </div>
        </div>

        <button type="button" className="envelope-front" aria-expanded={open} aria-controls="agency-letter" aria-label={open ? CONTACTS.envelopeClose : CONTACTS.envelopeOpen} onClick={toggle}>
          <img src="/images/site/envelope-front.webp" alt={HERO_SCROLL.envelopeAlt} />
          <span className="envelope-label">
            НАЖМИ
            <br />
            НА МЕНЯ
            <small>{CONTACTS.eyebrow}</small>
          </span>
        </button>
      </div>

      <span className="envelope-state">{open ? 'Письмо открыто. Нажмите на конверт, чтобы закрыть.' : 'Нажмите на конверт, чтобы открыть письмо.'}</span>
    </div>
  );
}
