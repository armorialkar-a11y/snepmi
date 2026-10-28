import { useMemo, useState } from 'react';
import { CATALOG_PAGE, CATEGORY_META, FILTER_PLATFORMS } from '../lib/content.js';
import { adLink, displayName, platformOptions, telegramHandle, topicOptions } from '../lib/blogger.js';
import { useStore } from '../lib/store.jsx';
import { haptic, openLink } from '../lib/telegram.js';
import { SectionIndex, SiteFooter, SiteHeader, SkipLink } from '../components/Layout.jsx';
import { BloggerCard, CategoryHeading, EmptyCatalog } from '../components/BloggerCard.jsx';
import { Heart, Plus } from '../components/icons.jsx';
import { selectionInquiry } from '../lib/selection-inquiry.js';

export default function CatalogPage() {
  const { bloggers, config, status, picked, togglePicked, clearPicked, openLead, reload } = useStore();
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('');
  const [topic, setTopic] = useState('');

  const platforms = useMemo(() => {
    const known = platformOptions(bloggers);
    return FILTER_PLATFORMS.filter((item) => known.includes(item)).concat(known.filter((item) => !FILTER_PLATFORMS.includes(item)));
  }, [bloggers]);
  const topics = useMemo(() => topicOptions(bloggers), [bloggers]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return bloggers.filter((blogger) => {
      if (platform && !(blogger.platform === platform || (blogger.social_links || []).some((link) => link.platform === platform))) return false;
      if (topic && !(blogger.topics || []).includes(topic)) return false;
      if (!needle) return true;
      return [blogger.name, blogger.nickname, blogger.social_url, ...(blogger.topics || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [bloggers, platform, query, topic]);

  const groups = CATEGORY_META.map((category) => ({
    ...category,
    items: visible.filter((blogger) => (blogger.category || 'unassigned') === category.key),
  })).filter((category) => category.items.length);

  const selected = picked.map((id) => bloggers.find((blogger) => blogger.id === id)).filter(Boolean);
  const filtered = Boolean(query.trim() || platform || topic);
  const inquiry = selectionInquiry(selected);
  const discussSelected = (event) => {
    event.preventDefault();
    haptic('light');
    openLink(inquiry);
  };

  return (
    <div className={`catalog-route${selected.length ? ' has-selection' : ''}`}>
      <SkipLink to="#catalog-main" label="К каталогу" />
      <SiteHeader variant="catalog" />
      <main id="catalog-main" className="full-catalog section-pad">
        <SectionIndex left={CATALOG_PAGE.index} />

        <div className="catalog-page-heading">
          <h1>
            {CATALOG_PAGE.title[0]}
            <br />
            <em>{CATALOG_PAGE.title[1]}</em>
          </h1>
          <p>{CATALOG_PAGE.lead}</p>
        </div>

        {config?.telegram ? (
          <p className="catalog-ad-contact">
            {CATALOG_PAGE.adContact}{' '}
            <a href={adLink({}, config)} onClick={(event) => { event.preventDefault(); openLink(adLink({}, config)); }}>
              {telegramHandle(config.telegram)}
            </a>
          </p>
        ) : null}

        <div className="catalog-filters" aria-label={CATALOG_PAGE.searchLabel}>
          <label>
            {CATALOG_PAGE.searchLabel}
            <input
              type="search"
              value={query}
              placeholder={CATALOG_PAGE.searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            {CATALOG_PAGE.platformLabel}
            <select aria-label={CATALOG_PAGE.platformLabel} value={platform} onChange={(event) => setPlatform(event.target.value)}>
              <option value="">{CATALOG_PAGE.allPlatforms}</option>
              {platforms.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            {CATALOG_PAGE.topicLabel}
            <select aria-label={CATALOG_PAGE.topicLabel} value={topic} onChange={(event) => setTopic(event.target.value)}>
              <option value="">{CATALOG_PAGE.allTopics}</option>
              {topics.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        {status === 'ready' && bloggers.length ? (
          <aside className="catalog-pick-hint" aria-label="Как выбрать блогеров">
            <Heart />
            <p><strong>Отметьте блогеров сердечком</strong> — внизу появится кнопка для обсуждения в Telegram.</p>
          </aside>
        ) : null}

        {status === 'loading' ? (
          <div className="catalog-empty">
            <Plus size={34} />
            <h2>Загружаем каталог…</h2>
          </div>
        ) : status === 'error' ? (
          <EmptyCatalog
            title="Каталог недоступен"
            lead="Не удалось загрузить список авторов. Обновите страницу — и мы попробуем снова."
            cta={
              <button className="btn dark" onClick={reload}>
                Обновить
              </button>
            }
          />
        ) : !bloggers.length ? (
          <EmptyCatalog title={CATALOG_PAGE.emptyCatalog} lead={CATALOG_PAGE.emptyCatalogLead} />
        ) : (
          <>
            <div className="catalog-result-count">
              {CATALOG_PAGE.shown} {visible.length} {CATALOG_PAGE.from} {bloggers.length}
            </div>

            {visible.length ? (
              <div className="catalog-categories">
                {groups.map((group) => (
                  <section key={group.key} className={`catalog-category category-${group.key}`}>
                    <CategoryHeading id={`category-${group.key}`} title={group.title} count={group.items.length} />
                    <div className="blogger-grid">
                      {group.items.map((blogger) => (
                        <BloggerCard
                          key={blogger.id}
                          blogger={blogger}
                          config={config}
                          picked={picked.includes(blogger.id)}
                          onToggle={(id) => {
                            haptic('light');
                            togglePicked(id);
                          }}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <EmptyCatalog
                title={filtered ? CATALOG_PAGE.searchEmpty : CATALOG_PAGE.categoryEmpty}
                lead={
                  filtered
                    ? 'Попробуйте изменить запрос или сбросить фильтры — возможно, подходящий автор находится в другой тематике.'
                    : CATALOG_PAGE.emptyCatalogLead
                }
                cta={
                  filtered ? (
                    <button
                      className="btn dark"
                      onClick={() => {
                        setQuery('');
                        setPlatform('');
                        setTopic('');
                      }}
                    >
                      Сбросить фильтры
                    </button>
                  ) : null
                }
              />
            )}
          </>
        )}

        {selected.length ? (
          <section className="catalog-selection" aria-live="polite">
            <div className="selection-heading">
              <h2>
                {CATALOG_PAGE.selectionTitle}{' '}
                <span>
                  {CATALOG_PAGE.selectionCount} {selected.length}
                </span>
              </h2>
            </div>
            <ul>
              {selected.map((blogger) => (
                <li key={blogger.id}>
                  <span>{displayName(blogger)}</span>
                  <button
                    aria-label={`${CATALOG_PAGE.remove} ${displayName(blogger)}`}
                    onClick={() => {
                      haptic('light');
                      togglePicked(blogger.id);
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <p>Мы соберём подборку под задачу и обсудим условия размещения по выбранным авторам.</p>
            <div className="selection-actions">
              <a className="btn dark" href={inquiry} onClick={discussSelected}>
                Обсудить в Telegram <span aria-hidden="true">↗</span>
              </a>
              <button className="text-link" onClick={() => openLead(selected.map((blogger) => blogger.id))}>
                Заполнить заявку
              </button>
              <button className="text-link" onClick={clearPicked}>
                {CATALOG_PAGE.clear}
              </button>
            </div>
          </section>
        ) : null}

        <div className="catalog-contact">
          <span className="eyebrow">{CATALOG_PAGE.notFoundEyebrow}</span>
          <h2>
            {CATALOG_PAGE.notFoundTitle[0]}{' '}
            <em>{CATALOG_PAGE.notFoundTitle[1]}</em>
          </h2>
          {config?.telegram ? (
            <p className="ad-contact">
              {CATALOG_PAGE.adContact}{' '}
              <a href={adLink({}, config)} onClick={(event) => { event.preventDefault(); openLink(adLink({}, config)); }}>
                {telegramHandle(config.telegram)}
              </a>
            </p>
          ) : null}
          <button className="btn dark" onClick={() => openLead(picked)}>
            {CATALOG_PAGE.discuss}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </main>
      <SiteFooter variant="catalog" />
      {selected.length ? (
        <section className="catalog-selection-bar" aria-label="Обсудить выбранных блогеров">
          <div className="catalog-selection-bar-inner">
            <span className="selection-bar-count" role="status" aria-live="polite">
              <Heart /> <span>Выбрано: <strong>{selected.length}</strong></span>
            </span>
            <a className="btn dark" href={inquiry} onClick={discussSelected}>
              Обсудить в Telegram <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      ) : null}
    </div>
  );
}
