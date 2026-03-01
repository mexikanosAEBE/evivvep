import { Routes, Route } from 'react-router-dom';
import Join from './pages/Join';
import Meeting from './pages/Meeting';
import Admin from './pages/Admin';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Join />} />
      <Route path="/join" element={<Join />} />
      <Route path="/meeting" element={<Meeting />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}
