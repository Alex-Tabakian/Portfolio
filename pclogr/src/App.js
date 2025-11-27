// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Try to import the components you expect to have.
// NOTE: adjust these paths only if your files live somewhere else.
import { AuthProvider } from './components/AuthProvider';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ResetPassword from './pages/ResetPassword';
import Inventory from './pages/Inventory';
import Build from './pages/Build';
import Home from './pages/Home';

// Debug: log types so we can spot "object" or undefined (common default/named mismatch)
console.log('DEBUG imports:');
console.log('AuthProvider ->', typeof AuthProvider, AuthProvider);
console.log('PrivateRoute ->', typeof PrivateRoute, PrivateRoute);
console.log('Navbar ->', typeof Navbar, Navbar);
console.log('Login ->', typeof Login, Login);
console.log('Signup ->', typeof Signup, Signup);
console.log('ResetPassword ->', typeof ResetPassword, ResetPassword);
console.log('Inventory ->', typeof Inventory, Inventory);

// If any import is wrong (object/undefined), the logs above will show it.
// Fallback placeholders so the app stays usable even if one import is wrong.
function Placeholder({ label }) {
  return (
    <div style={{ padding: 20, background: '#fff7', borderRadius: 8 }}>
      <strong>Placeholder:</strong> {label}
      <div style={{ marginTop: 6, color: '#666' }}>
        Import may be missing or exported incorrectly.
      </div>
    </div>
  );
}

const SafeAuthProvider = typeof AuthProvider === 'function' ? AuthProvider : ({ children }) => <>{children}</>;
const SafePrivateRoute = typeof PrivateRoute === 'function' ? PrivateRoute : ({ children }) => children;
const SafeNavbar = typeof Navbar === 'function' ? Navbar : () => <Placeholder label="Navbar" />;
const SafeLogin = typeof Login === 'function' ? Login : () => <Placeholder label="Login" />;
const SafeSignup = typeof Signup === 'function' ? Signup : () => <Placeholder label="Signup" />;
const SafeReset = typeof ResetPassword === 'function' ? ResetPassword : () => <Placeholder label="ResetPassword" />;
const SafeInventory = typeof Inventory === 'function' ? Inventory : () => <Placeholder label="Inventory" />;


export default function App() {
  return (
    <BrowserRouter>
      <SafeAuthProvider>
        <SafeNavbar />
        <main style={{ padding: 20 }}>
          <Routes>
            <Route path="/home" element={<Home />} />
            <Route path="/login" element={<SafeLogin />} />
            <Route path="/signup" element={<SafeSignup />} />
            <Route path="/reset" element={<SafeReset />} />
            <Route
              path="/"
              element={
                <SafePrivateRoute>
                  <SafeInventory />
                </SafePrivateRoute>
              }
            />
            <Route
              path="/build"
              element={
                <PrivateRoute>
                  <Build />
                </PrivateRoute>
              }
            />
            <Route path="*" element={<div>Not found — <a href="/">Go home</a></div>} />
          </Routes>
        </main>
      </SafeAuthProvider>
    </BrowserRouter>
  );
}
