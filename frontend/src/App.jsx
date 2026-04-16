import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Users from './pages/users';
import StockPage from './pages/StockPage';
import Billing from './pages/Billing';
import Analytics from './pages/Analytics';

const ProtectedRoute = ({ children }) => {
  const { user } = useContext(AuthContext);
  if (!user) {
    return <Navigate to="/login" />;
  }
  return children;
};

const PublicRoute = ({ children }) => {
  const { user } = useContext(AuthContext);
  if (user) {
    return <Navigate to="/" />;
  }
  return children;
};

function AppRoutes() {
  return (
    <Routes>

      {/* PUBLIC */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />

      {/* PROTECTED */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <Users/>
          </ProtectedRoute>
        }
      />
<Route
        path="/stocks"
        element={
          <ProtectedRoute>
            <StockPage/>
          </ProtectedRoute>
        }
      />
<Route
        path="/billing"
        element={
          <ProtectedRoute>
            <Billing/>
          </ProtectedRoute>
        }
      />
<Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Analytics/>
          </ProtectedRoute>
        }
      />

    </Routes>
  );
}

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#0ea5e9',
          borderRadius: 12,
          fontFamily: 'Outfit, sans-serif',
          colorBgContainer: '#ffffff',
          colorBgLayout: '#f8fafc',
        },
        components: {
          Card: {
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
          Button: {
            fontWeight: 500,
          }
        }
      }}
    >
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </ConfigProvider>
  );
}

export default App;
