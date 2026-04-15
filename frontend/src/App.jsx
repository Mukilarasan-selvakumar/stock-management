import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Users from './pages/users';
import StockPage from './pages/StockPage';
import Billing from './pages/Billing';

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

    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
