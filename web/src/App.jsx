import { useEffect } from 'react';
import { navigate, useRoute } from './lib/router.js';
import { startParam } from './lib/telegram.js';
import HomePage from './pages/HomePage.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import LeadDialog from './components/LeadDialog.jsx';

const ROUTES = { '/': HomePage, '/bloggers': CatalogPage, '/admin': AdminPage };

/** `?startapp=catalog|admin|form` decides where the Mini App lands. */
const START_ROUTES = { catalog: '/bloggers', bloggers: '/bloggers', admin: '/admin', form: '/', lead: '/' };

export default function App() {
  const path = useRoute();

  useEffect(() => {
    const target = START_ROUTES[startParam()];
    if (target && target !== '/') navigate(target, { replace: true });
  }, []);

  const Page = ROUTES[path] || HomePage;

  return (
    <>
      <Page />
      <LeadDialog />
    </>
  );
}
