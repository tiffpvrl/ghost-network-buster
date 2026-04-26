import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Employer from "./pages/Employer";
import Landing from "./pages/Landing";
import Results from "./pages/Results";

function App() {
  return (
    <div className="shell">
      <header className="top-nav">
        <NavLink to="/" className="brand">
          Ghost Network Buster
        </NavLink>
        <nav className="nav-links">
          <NavLink end to="/" className={({ isActive }) => (isActive ? "active" : "")}>
            Patient audit
          </NavLink>
          <NavLink to="/employer" className={({ isActive }) => (isActive ? "active" : "")}>
            Employer
          </NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/audit/:auditId" element={<Dashboard />} />
        <Route path="/results/:auditId" element={<Results />} />
        <Route path="/employer" element={<Employer />} />
      </Routes>
    </div>
  );
}

export default App;
