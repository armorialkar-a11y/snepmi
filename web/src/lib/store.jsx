import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import { startParam } from './telegram.js';
import { publicBlogger } from '../../../shared/public-blogger.js';

const StoreContext = createContext(null);
const PICKED_KEY = 'snepmi.picked';

function readPicked() {
  try {
    const raw = sessionStorage.getItem(PICKED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function StoreProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [bloggers, setBloggers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [picked, setPickedState] = useState(readPicked);
  const [lead, setLead] = useState({ open: false, bloggerIds: [] });
  const notified = useRef(false);

  const reload = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const [configResponse, bloggersResponse] = await Promise.all([api.get('/config'), api.get('/bloggers')]);
      setConfig(configResponse);
      setBloggers((bloggersResponse.bloggers || []).map(publicBlogger));
      setStatus('ready');
    } catch (cause) {
      setError(cause.message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const setPicked = useCallback((next) => {
    setPickedState((previous) => {
      const value = typeof next === 'function' ? next(previous) : next;
      try {
        sessionStorage.setItem(PICKED_KEY, JSON.stringify(value));
      } catch {
        /* private mode: keep selection in memory only */
      }
      return value;
    });
  }, []);

  const togglePicked = useCallback(
    (id) => {
      setPicked((previous) => (previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]));
    },
    [setPicked]
  );

  const openLead = useCallback((bloggerIds = []) => {
    setLead({ open: true, bloggerIds: Array.isArray(bloggerIds) ? bloggerIds : [bloggerIds] });
  }, []);

  const closeLead = useCallback(() => setLead({ open: false, bloggerIds: [] }), []);

  const clearPicked = useCallback(() => setPicked([]), [setPicked]);

  // Deep link from the bot: `?startapp=catalog` / `leads` / `admin`.
  useEffect(() => {
    const param = startParam();
    if (!param || notified.current) return;
    notified.current = true;
    if (param === 'form' || param === 'lead') openLead([]);
  }, [openLead]);

  const value = useMemo(
    () => ({
      config,
      bloggers,
      status,
      error,
      reload,
      picked,
      setPicked,
      togglePicked,
      clearPicked,
      lead,
      openLead,
      closeLead,
    }),
    [config, bloggers, status, error, reload, picked, setPicked, togglePicked, clearPicked, lead, openLead, closeLead]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider');
  return value;
}
