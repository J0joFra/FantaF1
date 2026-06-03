import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { I18nProvider } from '@/lib/i18n';
import AppLayout from './components/layout/AppLayout';
import Home from './pages/Home';
import Calculator from './pages/Calculator';
import Compare from './pages/Compare';
import Ferrari from './pages/Ferrari';
import Privacy from '../public/privacy';

function App() {
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/calculator" element={<Calculator />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/ferrari" element={<Ferrari />} />
              <Route path="/privacy" element={<Privacy />} />
            </Route>
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </I18nProvider>
  );
}

export default App;
