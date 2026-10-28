import { useEffect } from 'react';
import { navigate, useRoute } from './lib/router.js';
import { startParam } from './lib/telegram.js';
import { launchRoute } from './lib/launch-route.js';
import HomePage from './pages/HomePage.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import LeadDialog from './components/LeadDialog.jsx';

const ROUTES = { '/': HomePage, '/bloggers': CatalogPage, '/admin': AdminPage };


export default function App() {
  const path = useRoute();

  useEffect(() => {
    const target = launchRoute(startParam());
    if (target) navigate(target, { replace: true });
  }, []);

  const Page = ROUTES[path] || HomePage;

  return (
    <>
      <Page />
      <LeadDialog />
    </>
  );
}
