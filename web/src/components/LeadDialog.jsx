import { useEffect, useMemo, useRef, useState } from 'react';
import { CONTACTS, LEAD_FORM, SITE } from '../lib/content.js';
import { displayName, telegramHandle } from '../lib/blogger.js';
import { api, ApiError, partitionFieldErrors } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { currentUser, haptic, openLink } from '../lib/telegram.js';

const EMPTY = {
  name: '',
  company: '',
  contact: '',
  social_url: '',
  task: '',
  budget: '',
  launch_date: '',
  website: '',
};

const RENDERED_FIELDS = new Set([
  'name',
  'company',
  'contact',
  'social_url',
  'task',
  'budget',
  'launch_date',
  'consent',
]);

export default function LeadDialog() {
  const { lead, closeLead, bloggers, config, picked, clearPicked } = useStore();
  const dialog = useRef(null);
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const [values, setValues] = useState(EMPTY);
  const [selected, setSelected] = useState([]);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [state, setState] = useState('idle');
  const [leadId, setLeadId] = useState(null);

  const telegramContact = config?.telegram || SITE.secondaryContact.url;
  const handle = telegramHandle(telegramContact);

  useEffect(() => {
    const node = dialog.current;
    if (!lead.open) {
      if (node?.open) node.close();
      return undefined;
    }
    setSelected(lead.bloggerIds.length ? lead.bloggerIds : pickedRef.current);
    setState('idle');
    setErrors({});
    setFormError('');
    const user = currentUser();
    setValues((previous) => ({
      ...EMPTY,
      ...previous,
      name: previous.name || user?.first_name || '',
      contact: previous.contact || (user?.username ? `@${user.username}` : ''),
    }));
    if (!node) return undefined;
    if (!node.open) node.showModal();
    const onCancel = () => closeLead();
    node.addEventListener('cancel', onCancel);
    return () => node.removeEventListener('cancel', onCancel);
  }, [lead.open, lead.bloggerIds, closeLead]);

  useEffect(() => {
    if (state !== 'idle') return;
    // A rejected submit can leave errors far above or below the fold on a phone.
    window.setTimeout(() => dialog.current?.querySelector('.error')?.scrollIntoView({ block: 'center' }), 0);
  }, [errors, formError, state]);

  const sorted = useMemo(() => [...bloggers].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)), [bloggers]);

  const update = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    if (key === 'consent') setConsent(value);
    else setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  const toggleBlogger = (id) =>
    setSelected((previous) => (previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]));

  async function submit(event) {
    event.preventDefault();
    if (state === 'sending') return;
    setFormError('');
    setState('sending');
    try {
      const response = await api.post('/leads', {
        ...values,
        social_url: values.social_url.trim(),
        blogger_ids: selected,
        consent,
      });
      setLeadId(response.id);
      setState('success');
      clearPicked();
      haptic('success');
    } catch (error) {
      setState('idle');
      haptic('error');
      if (error instanceof ApiError && error.fieldErrors) {
        const { mapped, hiddenMessage } = partitionFieldErrors(error.fieldErrors, RENDERED_FIELDS);
        setErrors(mapped);
        setFormError(hiddenMessage);
      } else {
        setErrors({});
        setFormError(error.message || 'Не удалось отправить заявку.');
      }
    }
  }

  const ready = config?.leadsReady;

  return (
    <dialog className="lead-dialog" ref={dialog} aria-labelledby="form-title" onClose={closeLead}>
      <div className="dialog-inner">
        <button type="button" className="close" aria-label="Закрыть форму" onClick={closeLead}>
          ×
        </button>
        <span className="eyebrow">{LEAD_FORM.eyebrow}</span>
        <h2 id="form-title">
          {LEAD_FORM.title[0]}
          <br />
          <em>{LEAD_FORM.title[1]}</em>
        </h2>

        {state === 'success' ? (
          <div className="success">
            <h3>{LEAD_FORM.successTitle}</h3>
            <p>{LEAD_FORM.successText}</p>
            <small>Номер заявки: {leadId}</small>
            <button className="btn dark full" onClick={closeLead}>
              {LEAD_FORM.successCta}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            {!ready ? (
              <p className="setup-notice">
                {LEAD_FORM.setupNotice}{' '}
                <a
                  href={telegramContact}
                  onClick={(event) => {
                    event.preventDefault();
                    openLink(telegramContact);
                  }}
                >
                  {handle} ↗
                </a>{' '}
                .
              </p>
            ) : null}

            <p className="form-note">{LEAD_FORM.required}</p>

            <div className="form-grid">
              <Field label={LEAD_FORM.labels.name} name="name" error={errors.name}>
                <input type="text" name="name" value={values.name} onChange={update('name')} autoComplete="name" />
              </Field>
              <Field label={LEAD_FORM.labels.company} name="company" error={errors.company}>
                <input
                  type="text"
                  name="company"
                  value={values.company}
                  onChange={update('company')}
                  autoComplete="organization"
                />
              </Field>
            </div>

            <Field label={LEAD_FORM.labels.contact} name="contact" error={errors.contact}>
              <input
                type="text"
                name="contact"
                value={values.contact}
                onChange={update('contact')}
                placeholder={LEAD_FORM.placeholders.contact}
                autoComplete="tel"
              />
            </Field>

            <Field label={LEAD_FORM.labels.social_url} name="social_url" error={errors.social_url}>
              <input
                type="url"
                name="social_url"
                value={values.social_url}
                onChange={update('social_url')}
                placeholder={LEAD_FORM.placeholders.social_url}
              />
            </Field>

            <Field label={LEAD_FORM.labels.task} name="task" error={errors.task}>
              <textarea
                name="task"
                rows="4"
                value={values.task}
                onChange={update('task')}
                placeholder={LEAD_FORM.placeholders.task}
              />
            </Field>

            <fieldset className="blogger-select">
              <legend>{LEAD_FORM.labels.bloggers}</legend>
              {sorted.map((blogger) => (
                <label key={blogger.id}>
                  <input
                    type="checkbox"
                    name="blogger_ids"
                    checked={selected.includes(blogger.id)}
                    onChange={() => toggleBlogger(blogger.id)}
                  />
                  {displayName(blogger)}
                </label>
              ))}
            </fieldset>

            <div className="form-grid">
              <Field label={LEAD_FORM.labels.budget} name="budget" error={errors.budget}>
                <input type="text" name="budget" value={values.budget} onChange={update('budget')} placeholder={LEAD_FORM.placeholders.budget} />
              </Field>
              <Field label={LEAD_FORM.labels.launch_date} name="launch_date" error={errors.launch_date}>
                <input type="date" name="launch_date" value={values.launch_date} onChange={update('launch_date')} />
              </Field>
            </div>

            <div className="honeypot" aria-hidden="true">
              <label>
                Website
                <input name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={update('website')} />
              </label>
            </div>

            <label className="consent">
              <input type="checkbox" name="consent" checked={consent} onChange={update('consent')} />
              <span>
                {LEAD_FORM.consent}.{' '}
                {config?.privacyUrl ? (
                  <>
                    {LEAD_FORM.consentPolicy}{' '}
                    <a href={config.privacyUrl} onClick={(event) => { event.preventDefault(); openLink(config.privacyUrl); }}>
                      {LEAD_FORM.consentPolicyLink}
                    </a>
                    .
                  </>
                ) : (
                  LEAD_FORM.consentPending
                )}
              </span>
            </label>
            {errors.consent ? <p className="error">{errors.consent}</p> : null}

            {formError ? <p className="error">{formError}</p> : null}

            <button className="btn dark full" type="submit" disabled={state === 'sending' || !ready}>
              {state === 'sending' ? 'Отправка…' : LEAD_FORM.submit}
            </button>
            {!ready ? <p className="form-note">{CONTACTS.letter.primaryLabel} {handle}</p> : null}
          </form>
        )}
      </div>
    </dialog>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="field">
      {label}
      {children}
      {error ? <p className="error">{error}</p> : null}
    </label>
  );
}
