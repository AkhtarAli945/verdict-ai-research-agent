import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import New from './pages/New.jsx';
import Analysis from './pages/Analysis.jsx';
import Documents from './pages/Documents.jsx';
import History from './pages/History.jsx';

function Protected() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="splash"><span className="spin" /></div>;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: loc.pathname }} />;
}
function Guest() {
  const { user, loading } = useAuth();
  if (loading) return <div className="splash"><span className="spin" /></div>;
  return user ? <Navigate to="/" replace /> : <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Guest />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>
      <Route element={<Protected />}>
        <Route element={<Layout />}>
          <Route index element={<New />} />
          <Route path="analyses/:id" element={<Analysis />} />
          <Route path="documents" element={<Documents />} />
          <Route path="history" element={<History />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
