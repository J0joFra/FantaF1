// App.jsx
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import AppLayout from './components/AppLayout';
import Home from './pages/Home';
import Leghe from './pages/Leghe';
import Classifica from './pages/Classifica';
import Regolamento from './pages/Regolamento';
import Profilo from './pages/Profilo';
import AdminResults from './pages/AdminResults';

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/leghe" element={<Leghe />} />
              <Route path="/classifica" element={<Classifica />} />
              <Route path="/regolamento" element={<Regolamento />} />
              <Route path="/profilo" element={<Profilo />} />
              <Route path="/admin/results" element={<AdminResults />} />
            </Route>
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App