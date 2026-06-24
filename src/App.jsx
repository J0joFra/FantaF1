import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { I18nProvider } from '@/lib/i18n';
import AppLayout from './components/layout/AppLayout';
import Onboarding from './components/Onboarding';
import SplashScreen from './components/SplashScreen';
import Home from './pages/Home';
import Calculator from './pages/Calculator';
import Compare from './pages/Compare';
import Ferrari from './pages/Ferrari';
import { useState } from 'react';

function App() {
  const [splashDone, setSplashDone] = useState(false);

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
              <Route path="/ferrari" element={<Ferrari />} />
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
