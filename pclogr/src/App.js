// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import PrivateRoute from './components/PrivateRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ResetPassword from './pages/ResetPassword';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/reset" element={<ResetPassword />} />

          <Route path="/" element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          } />
          {/* fallback */}
          <Route path="*" element={<div style={{padding:20}}>404 — <Link to="/">Go home</Link></div>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
