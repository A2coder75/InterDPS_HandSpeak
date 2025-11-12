import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./Home";
import Feed from "./Feed";
import Convert from "./Convert";
import Navbar from "./Navbar";
import "./App.css";

export default function App() {
  return (
    <Router>
      <div className="app">
        <Navbar />
        <div className="page-container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/convert" element={<Convert />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
