import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DebugPage from './pages/DebugPage';
import DataPlans from './pages/DataPlans';
import Login from './pages/Login';
import Register from './pages/Register';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<DataPlans />} />
          <Route path="/debug" element={<DebugPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/plans" element={<DataPlans />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
