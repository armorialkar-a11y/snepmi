import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ADMIN_TEXT, CATALOG_PAGE, CATEGORY_META } from '../lib/content.js';
import { ApiError, api, partitionFieldErrors } from '../lib/api.js';
import { navigate } from '../lib/router.js';
import { displayName } from '../lib/blogger.js';
import { SafeImage } from '../components/BloggerCard.jsx';
import { confirmAction, haptic, initDataRaw, isMiniApp, onBackClick } from '../lib/telegram.js';
import { Plus } from '../components/icons.jsx';

const LEAD_STATUSES = ['new', 'in_work', 'contacted', 'done', 'rejected'];
const PLATFORMS = ['TikTok', 'Instagram', 'Telegram', 'YouTube', 'VK', 'Likee'];
const PAGE_SIZE = 25;

const EMPTY_BLOGGER = {
  name: '',
  nickname: '',
  platform: 'TikTok',
  category: 'unassigned',
  image_url: '',
  image_kind: 'photo',
  social_url: '',
  followers: '',
  average_views: '',
  price: '',
  audience: '',
  geography: '',
  description: '',
  topics: '',
  formats: '',
  ad_terms: '',
  ad_restrictions: '',
  social_links: [],
  published: true,
  featured_first: false,
  rkn_registered: '',
  ad_contact: '',
  sort_order: '',
};

export default function AdminPage() {
  const [access, setAccess] = useState({ status: 'checking', me: null, error: '' });
  const [tab, setTab] = useState('leads');

  useEffect(() => {
    let alive = true;
    api
      .get('/admin/me')
      .then((me) => alive && setAccess({ status: 'granted', me, error: '' }))
      .catch((error) => {
        if (!alive) return;
        const denied = error instanceof ApiError && (error.status === 401 || error.status === 403);
        setAccess({ status: denied ? 'denied' : 'offline', me: null, error: messageOf(error) });
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(
    () =>
      onBackClick(() => {
        navigate('/');
      }),
    []
  );

  if (access.status === 'checking') {
    return (
      <div className="admin-shell">
        <div className="admin-status">Проверяем доступ…</div>
      </div>
    );
  }

  if (access.status !== 'granted') {
    const forbidden = access.status === 'denied';
    return (
      <div className="admin-login">
        <span className="eyebrow">SNEPMI AGENCY / ADMIN</span>
        <h1>{ADMIN_TEXT.title}</h1>
        <p className="admin-status">
          {!isMiniApp() && forbidden ? ADMIN_TEXT.needTelegram : access.error || ADMIN_TEXT.denied}
        </p>
        {forbidden ? <p>{ADMIN_TEXT.deniedLead}</p> : null}
        <div className="admin-actions">
          {!forbidden ? (
            <button
              className="btn dark"
              onClick={() => {
                setAccess({ status: 'checking', me: null, error: '' });
                api
                  .get('/admin/me')
                  .then((me) => setAccess({ status: 'granted', me, error: '' }))
                  .catch((error) => setAccess({ status: 'offline', me: null, error: messageOf(error) }));
              }}
            >
              Повторить
            </button>
          ) : null}
          <button className="btn" onClick={() => navigate('/')}>
            {ADMIN_TEXT.back}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell editorial-admin">
      <header className="admin-header">
        <div>
          <span className="eyebrow">SNEPMI AGENCY / ADMIN</span>
          <h1>{ADMIN_TEXT.title}</h1>
          <p className="admin-header-copy">
            {access.me.user.firstName || access.me.user.username || access.me.user.id} · {access.me.user.id}
            {access.me.authDisabled ? ' · авторизация отключена' : ''}
          </p>
        </div>
        <button className="text-link" onClick={() => navigate('/')}>
          {ADMIN_TEXT.back}
        </button>
      </header>

      <div className="admin-tabs" role="tablist">
        {Object.entries(ADMIN_TEXT.tabs).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-pressed={tab === key}
            onClick={() => {
              haptic('light');
              setTab(key);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'leads' ? <LeadsTab /> : null}
      {tab === 'bloggers' ? <BloggersTab /> : null}
      {tab === 'settings' ? <SettingsTab /> : null}
    </div>
  );
}

function messageOf(error) {
  if (error instanceof ApiError) return error.message;
  return 'Не удалось связаться с сервером.';
}

// -------------------------------------------------------------------- leads

function LeadsTab() {
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState({ leads: [], total: 0 });
  const [state, setState] = useState('loading');
  const [note, setNote] = useState('');
  const request = useRef(0);

  // Typing in the search box used to fire one request per keystroke.
  useEffect(() => {
    const at = window.setTimeout(() => {
      setSearch(query.trim());
      setOffset(0);
    }, 350);
    return () => window.clearTimeout(at);
  }, [query]);

  const load = useCallback(async () => {
    const id = ++request.current;
    setState('loading');
    setNote('');
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (status) params.set('status', status);
      if (search) params.set('q', search);
      const response = await api.get(`/admin/leads?${params}`);
      if (id !== request.current) return;
      setData(response);
      setState('ready');
    } catch (error) {
      if (id !== request.current) return;
      setNote(messageOf(error));
      setState('error');
    }
  }, [offset, search, status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="catalog-filters">
        <label>
          Поиск
          <input
            type="search"
            value={query}
            placeholder="имя, компания, контакт или задача"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          {ADMIN_TEXT.leadFields.status}
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setOffset(0);
            }}
          >
            <option value="">Все статусы</option>
            {LEAD_STATUSES.map((item) => (
              <option key={item} value={item}>
                {ADMIN_TEXT.statusLabels[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Экспорт
          <button className="btn" onClick={() => downloadCsv(status, search).then(setNote)}>
            {ADMIN_TEXT.downloadCsv}
          </button>
        </label>
      </div>

      <div className="catalog-result-count">
        Заявок: {data.total}
      </div>

      {note ? <p className="admin-status">{note}</p> : null}

      {state === 'loading' ? <p className="empty-admin">Загружаем заявки…</p> : null}

      {state === 'ready' && !data.leads.length ? <p className="empty-admin">{ADMIN_TEXT.noLeads}</p> : null}

      {data.leads.map((lead) => (
        <LeadCard key={lead.id} lead={lead} onSaved={(message) => setNote(message)} reload={load} />
      ))}

      {data.total > PAGE_SIZE ? (
        <div className="admin-pagination">
          <button className="btn" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
            ← Назад
          </button>
          <span>
            {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} из {data.total}
          </span>
          <button
            className="btn"
            disabled={offset + PAGE_SIZE >= data.total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Вперёд →
          </button>
        </div>
      ) : null}
    </>
  );
}

function LeadCard({ lead, onSaved, reload }) {
  const [form, setForm] = useState({ status: lead.status, note: lead.note || '' });
  const [busy, setBusy] = useState(false);
  const changed = form.status !== lead.status || form.note !== (lead.note || '');

  async function save() {
    setBusy(true);
    try {
      await api.patch(`/admin/leads/${lead.id}`, { status: form.status, note: form.note });
      haptic('success');
      onSaved(`Заявка №${lead.id} обновлена.`);
      reload();
    } catch (error) {
      onSaved(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="admin-lead">
      <h3>
        №{lead.id} · {lead.name}
      </h3>
      <small>
        {ADMIN_TEXT.leadFields.created}: {formatDate(lead.created_at)}
      </small>
      <p>{lead.task}</p>
      <small>
        {lead.company} · {ADMIN_TEXT.leadFields.contact}: {lead.contact}
      </small>
      {lead.social_url ? <small> · {lead.social_url}</small> : null}
      <p>
        {lead.budget ? `${ADMIN_TEXT.leadFields.budget}: ${lead.budget}. ` : ''}
        {lead.launch_date ? `${ADMIN_TEXT.leadFields.launch}: ${lead.launch_date}. ` : ''}
        {lead.tg_username ? `${ADMIN_TEXT.leadFields.tg}: @${lead.tg_username}.` : ''}
      </p>
      {lead.blogger_names?.length ? (
        <p>
          {ADMIN_TEXT.leadFields.bloggers}: {lead.blogger_names.join(', ')}
        </p>
      ) : null}
      <label>
        {ADMIN_TEXT.leadFields.status}
        <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
          {LEAD_STATUSES.map((item) => (
            <option key={item} value={item}>
              {ADMIN_TEXT.statusLabels[item]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        {ADMIN_TEXT.leadFields.note}
        <textarea rows={3} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
      </label>
      <div className="admin-actions">
        <button className="btn dark" disabled={!changed || busy} onClick={save}>
          {busy ? 'Сохранение…' : ADMIN_TEXT.save}
        </button>
      </div>
    </article>
  );
}

async function downloadCsv(status, search) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search) params.set('q', search);
  const suffix = params.toString() ? `?${params}` : '';
  const headers = {};
  const token = initDataRaw();
  if (token) headers.Authorization = `tma ${token}`;
  try {
    const response = await fetch(`/api/admin/leads.csv${suffix}`, { headers });
    if (!response.ok) return `Не удалось выгрузить CSV (${response.status}).`;
    const text = await response.text();
    const rows = text.split(/\r?\n/).filter((line) => line.trim()).length - 1; // minus the header
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `snepmi-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    // A blob click is silently ignored by some webviews (notably iOS), so an empty
    // export has to say so — otherwise the admin waits for a file that never lands.
    return rows > 0 ? '' : 'В выгрузке нет заявок: CSV только с заголовками.';
  } catch {
    return 'Не удалось выгрузить CSV: нет связи с сервером.';
  }
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('ru-RU');
}

// ----------------------------------------------------------------- bloggers

function BloggersTab() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [state, setState] = useState('loading');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const response = await api.get('/admin/bloggers');
      setItems(response.bloggers);
      setSelected((current) => current ?? response.bloggers[0]?.id ?? null);
      setState('ready');
    } catch (error) {
      setNote(messageOf(error));
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = useMemo(() => items.find((item) => item.id === selected) || null, [items, selected]);

  return (
    <>
      {note ? <p className="admin-status">{note}</p> : null}
      <div className="admin-panel">
        <div className="admin-list">
          <button
            className={selected === null ? 'btn dark' : 'btn'}
            onClick={() => {
              setSelected(null);
              setNote('');
            }}
          >
            {ADMIN_TEXT.newBlogger}
            <Plus size={16} />
          </button>
          {state === 'loading' ? <p className="empty-admin">Загружаем каталог…</p> : null}
          {state === 'ready' && !items.length ? <p className="empty-admin">{ADMIN_TEXT.noBloggers}</p> : null}
          {items.map((blogger) => (
            <button
              key={blogger.id}
              aria-pressed={selected === blogger.id}
              onClick={() => {
                haptic('light');
                setSelected(blogger.id);
              }}
            >
              {displayName(blogger)}
              <small>
                {blogger.platform || '—'} · {blogger.published ? 'опубликован' : 'черновик'}
              </small>
            </button>
          ))}
        </div>

        <BloggerForm
          key={current?.id || 'new'}
          blogger={current}
          onSaved={(message) => {
            setNote(message);
            load();
          }}
          onDeleted={(message) => {
            setNote(message);
            setSelected(null);
            load();
          }}
        />
      </div>
    </>
  );
}

function toDraft(blogger) {
  if (!blogger) return { ...EMPTY_BLOGGER, social_links: [] };
  return {
    name: blogger.name || '',
    nickname: blogger.nickname || '',
    platform: blogger.platform || '',
    category: blogger.category || 'unassigned',
    image_url: blogger.image_url || '',
    image_kind: blogger.image_kind || 'photo',
    social_url: blogger.social_url || '',
    followers: blogger.followers === null || blogger.followers === undefined ? '' : String(blogger.followers),
    average_views: blogger.average_views ?? '',
    price: blogger.price ?? '',
    audience: blogger.audience || '',
    geography: blogger.geography || '',
    description: blogger.description || '',
    topics: (blogger.topics || []).join('\n'),
    formats: (blogger.formats || []).join('\n'),
    ad_terms: (blogger.ad_terms || []).join('\n'),
    ad_restrictions: (blogger.ad_restrictions || []).join('\n'),
    social_links: (blogger.social_links || []).map((link) => ({ ...link })),
    published: Boolean(blogger.published),
    featured_first: Boolean(blogger.featured_first),
    rkn_registered: blogger.rkn_registered === null || blogger.rkn_registered === undefined ? '' : String(blogger.rkn_registered),
    ad_contact: blogger.ad_contact || '',
    sort_order: blogger.sort_order ?? '',
  };
}

function toPayload(draft) {
  const numberOrNull = (value) => (value === '' || value === null || Number.isNaN(Number(value)) ? null : Number(value));
  const list = (value) =>
    String(value)
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  return {
    name: draft.name.trim(),
    nickname: draft.nickname.trim() || null,
    platform: draft.platform.trim() || null,
    category: draft.category,
    image_url: draft.image_url.trim() || null,
    image_kind: draft.image_kind,
    social_url: draft.social_url.trim() || null,
    followers: numberOrNull(draft.followers),
    average_views: numberOrNull(draft.average_views),
    price: numberOrNull(draft.price),
    audience: draft.audience.trim() || null,
    geography: draft.geography.trim() || null,
    description: draft.description.trim() || null,
    topics: list(draft.topics),
    formats: list(draft.formats),
    ad_terms: list(draft.ad_terms),
    ad_restrictions: list(draft.ad_restrictions),
    social_links: draft.social_links.filter((link) => link.url && link.platform),
    published: draft.published,
    featured_first: draft.featured_first,
    rkn_registered: draft.rkn_registered === '' ? null : draft.rkn_registered === 'true',
    ad_contact: draft.ad_contact.trim() || null,
    sort_order: numberOrNull(draft.sort_order) ?? 0,
  };
}

const BLOGGER_FIELDS = new Set([
  'name',
  'nickname',
  'platform',
  'image_url',
  'social_url',
  'followers',
  'average_views',
  'price',
  'audience',
  'geography',
  'description',
  'topics',
  'formats',
  'ad_terms',
  'ad_restrictions',
  'ad_contact',
  'sort_order',
]);

function BloggerForm({ blogger, onSaved, onDeleted }) {
  const [draft, setDraft] = useState(() => toDraft(blogger));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setDraft((current) => ({ ...current, [key]: value }));
  };

  async function save() {
    setBusy(ADMIN_TEXT.saving);
    setErrors({});
    try {
      const payload = toPayload(draft);
      if (blogger) await api.patch(`/admin/bloggers/${blogger.id}`, payload);
      else await api.post('/admin/bloggers', payload);
      haptic('success');
      onSaved(blogger ? `Каталог обновлён: ${draft.name}.` : `Блогер добавлен: ${draft.name}.`);
    } catch (error) {
      setBusy('');
      haptic('error');
      if (error instanceof ApiError && error.fieldErrors) {
        const { mapped, hiddenMessage } = partitionFieldErrors(error.fieldErrors, BLOGGER_FIELDS);
        setErrors(mapped);
        onSaved(hiddenMessage || 'Исправьте отмеченные поля.');
      } else {
        setErrors({});
        onSaved(messageOf(error));
      }
      return;
    }
    setBusy('');
  }

  async function remove() {
    if (!(await confirmAction(ADMIN_TEXT.confirmDelete, 'Удалить блогера?'))) return;
    setBusy(ADMIN_TEXT.deleting);
    try {
      await api.del(`/admin/bloggers/${blogger.id}`);
      haptic('warning');
      onDeleted(`Блогер удалён: ${draft.name}.`);
    } catch (error) {
      onSaved(messageOf(error));
    } finally {
      setBusy('');
    }
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(ADMIN_TEXT.imageUploading);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await api.upload('/admin/media', form);
      setDraft((current) => ({ ...current, image_url: response.url, image_kind: 'cutout' }));
      onSaved('Изображение загружено.');
    } catch (error) {
      onSaved(messageOf(error));
      haptic('error');
    } finally {
      setBusy('');
      event.target.value = '';
    }
  }

  return (
    <form
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <h2>{blogger ? draft.name || 'Блогер' : ADMIN_TEXT.newBlogger}</h2>

      {draft.image_url ? <SafeImage className="admin-image" src={draft.image_url} alt="" /> : null}

      <div className="admin-actions">
        <label className="btn">
          <input type="file" accept="image/webp,image/jpeg,image/png" hidden onChange={upload} />
          {busy === ADMIN_TEXT.imageUploading ? ADMIN_TEXT.imageUploading : ADMIN_TEXT.imageUpload}
        </label>
      </div>

      <label className="field">
        Имя
        <input value={draft.name} onChange={set('name')} required />
        <ErrorText error={errors.name} />
      </label>

      <div className="form-grid">
        <label className="field">
          Никнейм
          <input value={draft.nickname} onChange={set('nickname')} />
          <ErrorText error={errors.nickname} />
        </label>
        <label className="field">
          Площадка
          <input value={draft.platform} onChange={set('platform')} />
          <ErrorText error={errors.platform} />
        </label>
      </div>

      <div className="form-grid">
        <label className="field">
          Категория
          <select value={draft.category} onChange={set('category')}>
            {CATEGORY_META.map((category) => (
              <option key={category.key} value={category.key}>
                {category.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Изображение (URL)
          <input value={draft.image_url} onChange={set('image_url')} placeholder="/images/bloggers/…" />
          <ErrorText error={errors.image_url} />
        </label>
      </div>

      <div className="form-grid">
        <label className="field">
          Подписчики
          <input type="number" min="0" value={draft.followers} onChange={set('followers')} />
          <ErrorText error={errors.followers} />
        </label>
        <label className="field">
          Средние просмотры
          <input type="number" min="0" value={draft.average_views} onChange={set('average_views')} />
          <ErrorText error={errors.average_views} />
        </label>
      </div>

      <div className="form-grid">
        <label className="field">
          Цена, ₽
          <input type="number" min="0" step="0.01" value={draft.price} onChange={set('price')} />
          <ErrorText error={errors.price} />
        </label>
        <label className="field">
          Порядок
          <input type="number" value={draft.sort_order} onChange={set('sort_order')} />
          <ErrorText error={errors.sort_order} />
        </label>
      </div>

      <div className="form-grid">
        <label className="field">
          {CATALOG_PAGE.audience}
          <input value={draft.audience} onChange={set('audience')} />
          <ErrorText error={errors.audience} />
        </label>
        <label className="field">
          {CATALOG_PAGE.geography}
          <input value={draft.geography} onChange={set('geography')} />
          <ErrorText error={errors.geography} />
        </label>
      </div>

      <label className="field">
        Основная ссылка
        <input value={draft.social_url} onChange={set('social_url')} placeholder="https://" />
        <ErrorText error={errors.social_url} />
      </label>

      <label className="field">
        {CATALOG_PAGE.topics} (по одному в строке)
        <textarea rows={3} value={draft.topics} onChange={set('topics')} />
        <ErrorText error={errors.topics} />
      </label>

      <label className="field">
        Форматы рекламы (по одному в строке)
        <textarea rows={2} value={draft.formats} onChange={set('formats')} />
        <ErrorText error={errors.formats} />
      </label>

      <label className="field">
        Описание
        <textarea rows={3} value={draft.description} onChange={set('description')} />
        <ErrorText error={errors.description} />
      </label>

      <label className="field">
        {CATALOG_PAGE.conditions} (по одному в строке)
        <textarea rows={3} value={draft.ad_terms} onChange={set('ad_terms')} />
        <ErrorText error={errors.ad_terms} />
      </label>

      <label className="field">
        {CATALOG_PAGE.restrictions} (по одному в строке)
        <textarea rows={3} value={draft.ad_restrictions} onChange={set('ad_restrictions')} />
        <ErrorText error={errors.ad_restrictions} />
      </label>

      <fieldset className="blogger-select">
        <legend>{CATALOG_PAGE.socialNetworks}</legend>
        {draft.social_links.map((link, index) => (
          <div className="form-grid" key={index}>
            <label className="field">
              Площадка
              <select
                value={link.platform}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    social_links: current.social_links.map((item, position) =>
                      position === index ? { ...item, platform: event.target.value } : item
                    ),
                  }))
                }
              >
                {PLATFORMS.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Ссылка
              <input
                value={link.url}
                placeholder="https://"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    social_links: current.social_links.map((item, position) =>
                      position === index ? { ...item, url: event.target.value } : item
                    ),
                  }))
                }
              />
            </label>
            <button
              type="button"
              className="btn danger"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  social_links: current.social_links.filter((_, position) => position !== index),
                }))
              }
            >
              {ADMIN_TEXT.remove}
            </button>
          </div>
        ))}
        {draft.social_links.length < PLATFORMS.length ? (
          <button
            type="button"
            className="text-link"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                social_links: [...current.social_links, { platform: PLATFORMS[0], url: '' }],
              }))
            }
          >
            Добавить площадку +
          </button>
        ) : null}
      </fieldset>

      <div className="form-grid">
        <label className="field">
          {CATALOG_PAGE.rknYes}
          <select value={draft.rkn_registered} onChange={set('rkn_registered')}>
            <option value="">Не указано</option>
            <option value="true">Да</option>
            <option value="false">Нет</option>
          </select>
        </label>
        <label className="field">
          Контакт рекламы (URL)
          <input value={draft.ad_contact} onChange={set('ad_contact')} placeholder="https://t.me/" />
          <ErrorText error={errors.ad_contact} />
        </label>
      </div>

      <label className="consent">
        <input type="checkbox" checked={draft.published} onChange={set('published')} />
        <span>Показывать в каталоге</span>
      </label>
      <label className="consent">
        <input type="checkbox" checked={draft.featured_first} onChange={set('featured_first')} />
        <span>Показывать первым в подборке</span>
      </label>

      {errors.form ? <p className="error">{errors.form}</p> : null}

      <div className="admin-actions">
        <button className="btn dark" type="submit" disabled={Boolean(busy)}>
          {busy || ADMIN_TEXT.save}
        </button>
        {blogger ? (
          <button className="btn danger" type="button" disabled={Boolean(busy)} onClick={remove}>
            {ADMIN_TEXT.remove}
          </button>
        ) : null}
      </div>
    </form>
  );
}

function ErrorText({ error }) {
  return error ? <span className="error">{error}</span> : null;
}

// ---------------------------------------------------------------- settings

const SETTINGS_FIELDS = new Set(['telegram', 'email', 'privacyUrl', 'operator', 'leadsReady', 'adminUserIds']);

function SettingsTab() {
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');

  useEffect(() => {
    api
      .get('/admin/settings')
      .then((response) => {
        setSettings(response);
        setDraft({
          telegram: response.telegram || '',
          email: response.email || '',
          privacyUrl: response.privacyUrl || '',
          operator: response.operator || '',
          leadsReady: Boolean(response.leadsReady),
          adminUserIds: (response.adminUserIds || []).join(', '),
        });
      })
      .catch((error) => setNote(messageOf(error)));
  }, []);

  if (!draft) return <p className="empty-admin">{note || 'Загружаем настройки…'}</p>;

  async function save() {
    setBusy(ADMIN_TEXT.saving);
    setErrors({});
    try {
      const payload = {
        telegram: draft.telegram.trim() || null,
        email: draft.email.trim(),
        privacyUrl: draft.privacyUrl.trim(),
        operator: draft.operator.trim() || null,
        leadsReady: draft.leadsReady,
        adminUserIds: draft.adminUserIds
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      };
      await api.put('/admin/settings', payload);
      haptic('success');
      setNote('Настройки сохранены.');
      const fresh = await api.get('/admin/settings');
      setSettings(fresh);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        const { mapped, hiddenMessage } = partitionFieldErrors(error.fieldErrors, SETTINGS_FIELDS);
        setErrors(mapped);
        setNote(hiddenMessage || 'Исправьте отмеченные поля.');
      } else {
        setErrors({});
        setNote(messageOf(error));
      }
      haptic('error');
    } finally {
      setBusy('');
    }
  }

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <form
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <h2>{ADMIN_TEXT.tabs.settings}</h2>
      {settings ? (
        <p className="admin-header-copy">
          Приём заявок: {settings.leadsReady ? 'включён' : 'выключен'} · администраторов:{' '}
          {(settings.adminUserIds || []).length}
        </p>
      ) : null}

      <label className="field">
        {ADMIN_TEXT.settingsLabels.telegram}
        <input value={draft.telegram} onChange={set('telegram')} placeholder="https://t.me/" />
        <ErrorText error={errors.telegram} />
      </label>

      <label className="field">
        {ADMIN_TEXT.settingsLabels.email}
        <input value={draft.email} onChange={set('email')} placeholder="mail@example.com" />
        <ErrorText error={errors.email} />
      </label>

      <label className="field">
        {ADMIN_TEXT.settingsLabels.privacyUrl}
        <input value={draft.privacyUrl} onChange={set('privacyUrl')} placeholder="https://" />
        <ErrorText error={errors.privacyUrl} />
      </label>

      <label className="field">
        {ADMIN_TEXT.settingsLabels.operator}
        <input value={draft.operator} onChange={set('operator')} />
        <ErrorText error={errors.operator} />
      </label>

      <label className="field">
        {ADMIN_TEXT.settingsLabels.adminUserIds}
        <input value={draft.adminUserIds} onChange={set('adminUserIds')} placeholder="123456789, 987654321" />
        <ErrorText error={errors.adminUserIds} />
      </label>

      <label className="consent">
        <input type="checkbox" checked={draft.leadsReady} onChange={set('leadsReady')} />
        <span>{ADMIN_TEXT.settingsLabels.leadsReady}</span>
      </label>

      {note ? <p className="admin-status">{note}</p> : null}

      <div className="admin-actions">
        <button className="btn dark" type="submit" disabled={Boolean(busy)}>
          {busy || ADMIN_TEXT.save}
        </button>
      </div>
    </form>
  );
}
