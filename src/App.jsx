import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
// On the native build the app is served from a local bundle with no SPA
// fallback, so a hard reload or deep link to a sub-route would 404. HashRouter
// keeps routing in the URL fragment (index.html always loads). Web keeps clean
// URLs with BrowserRouter.
const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;
import PageNotFound from './lib/PageNotFound';
import { I18nProvider } from '@/lib/i18n';
import AppLayout from './components/layout/AppLayout';
import Onboarding from './components/Onboarding';
import SplashScreen from './components/SplashScreen';
import Home from './pages/Home';
import Calculator from './pages/Calculator';
import Compare from './pages/Compare';
import Ferrari from './pages/Ferrari';
import News from './pages/News';
import DriverDetail from './pages/DriverDetail';
import Games from './pages/Games';
import { useState, useEffect } from 'react';
import { showBanner } from '@/lib/ads';
import { initPurchases } from '@/lib/purchases';
import { initNativeChrome } from '@/lib/native';
import { useBannerSpace } from '@/lib/useBannerSpace';

function App() {
  const [splashDone, setSplashDone] = useState(false);

  /* The splash covers the whole screen: an ad on top of it is the first thing
     the app shows, before its own logo. */
  useBannerSpace('splash', !splashDone);

  // Show the AdMob banner on the native build (no-op on web). Overlays that
  // need the bottom of the screen hold it back until they close.
  useEffect(() => {
    initPurchases();  // restores "remove ads" entitlement (native only)
    initNativeChrome();  // brand-red native status bar (native only)
    showBanner();
  }, []);

  return (
    <I18nProvider>
      <QueryClientProvider client={queryClientInstance}>
        {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
        <Router>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/calculator" element={<Calculator />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/driver/:id" element={<DriverDetail />} />
              <Route path="/ferrari" element={<Ferrari />} />
              <Route path="/news" element={<News />} />
              <Route path="/games" element={<Games />} />
            </Route>
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Router>
        <Toaster />
        <Onboarding />
      </QueryClientProvider>
    </I18nProvider>
  );
}

export default App;
