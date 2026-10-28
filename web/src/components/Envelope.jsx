import { useState } from 'react';
import { CONTACTS, HERO_SCROLL, SITE } from '../lib/content.js';
import { telegramHandle } from '../lib/blogger.js';
import { useStore } from '../lib/store.jsx';
import { haptic, openLink } from '../lib/telegram.js';
import { Plus } from './icons.jsx';

export default function Envelope() {
  const { config, openLead } = useStore();
  const [open, setOpen] = useState(false);

  const primary = config?.telegram || 'https://t.me/nesssvt';
  const primaryHandle = telegramHandle(primary);
  const secondary = SITE.secondaryContact;
  const [line1, line2, line3] = CONTACTS.letter.title;

  const toggle = () => {
    setOpen((value) => {
      haptic(value ? 'light' : 'medium');
      return !value;
    });
  };

  return (
    <div className="envelope-wrap envelope-v8 envelope-v10">
      <div className="envelope-hint">
        <Plus size={14} />
        <span>{CONTACTS.hint}</span>
      </div>

      <div className="envelope-stage">
        <img className="envelope-back" src="/images/site/envelope-back.webp" alt="" />

        <div
          className="envelope-flap"
          style={{ transform: `rotateX(${open ? -178 : 0}deg)`, zIndex: open ? 1 : 3 }}
          aria-hidden="true"
          onClick={toggle}
        >
          <img src="/images/site/envelope-flap.webp" alt="" />
        </div>

        <div className="letter-window">
          <div
            id="agency-letter"
            className="letter"
            style={{ transform: `translateY(${open ? -58 : 62}%)`, transition: 'transform 700ms cubic-bezier(0.22, 0.8, 0.2, 1)' }}
          >
            <div className="letter-top">
              <span>{CONTACTS.letter.top}</span>
              <Plus />
            </div>
            <h3>
              {line1} {line2}
              <br />
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

        <button type="button" className="envelope-front" aria-label={open ? CONTACTS.envelopeClose : CONTACTS.envelopeOpen} onClick={toggle}>
          <img src="/images/site/envelope-front.webp" alt={HERO_SCROLL.envelopeAlt} />
          <span className="envelope-label">
            НАЖМИ
            <br />
            НА МЕНЯ
            <small>{CONTACTS.eyebrow}</small>
          </span>
        </button>
      </div>

      <span className="envelope-state">{CONTACTS.state}</span>
    </div>
  );
}
