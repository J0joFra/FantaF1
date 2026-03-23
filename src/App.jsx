import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import AppLayout from './components/AppLayout';
import Home from './pages/Home';
import PickGp from './pages/PickGp';
import Leghe from './pages/Leghe';
import Classifica from './pages/Classifica';
import Profilo from './pages/Profilo';
import AdminResults from './pages/AdminResults';
import Regolamento from './pages/Regolamento';
import PageNotFound from './lib/PageNotFound';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index         element={<Home />} />
            <Route path="pick"   element={<PickGp />} />
            <Route path="leghe"  element={<Leghe />} />
            <Route path="classifica" element={<Classifica />} />
            <Route path="profilo"    element={<Profilo />} />
            <Route path="regolamento" element={<Regolamento />} />
            <Route path="admin/results" element={<AdminResults />} />
          </Route>
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
