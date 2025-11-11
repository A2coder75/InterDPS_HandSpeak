import { useRef, useState, type DetailedHTMLProps, type HTMLAttributes } from "react"
import { BrowserRouter, Routes, Route, Link } from "react-router-dom"
import Home from "./Pages/Home"
import "./App.css"
import Convert from "./Pages/Convert"
import Feed from "./Pages/Feed"

export default function App() {
  const [mode, setMode] = useState("dark")
  const [menuOpen, setMenuOpen] = useState(false)
  const Menu: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> = useRef(null)

  const changeMenu = () => {
    setMenuOpen(!menuOpen)
    if (!menuOpen) {
      Menu.current.style.height = "55vh"
    } else {
      Menu.current.style.height = "10vh"
    }
  }
  return (
    <>
      <BrowserRouter>
      <nav ref={Menu} className={mode === "light" ? "lightNav" : "darkNav"}>
        <div className={`hamburger ${menuOpen ? "active" : ""}`} onClick={changeMenu}>
          <div className="line"></div>
          <div className="line"></div>
          <div className="line"></div>
        </div>
        <ul className={menuOpen ? "active" : ""}>
          <li>HandSpeakAI</li>
          <li>
            <button><Link style={{textDecoration:'none'}} to="/"><p style={{color: 'white'}}>Home</p></Link></button>
          </li>
          <li>
            <button><Link style={{textDecoration:'none'}} to="/feed?reload=1"><p style={{color: 'white'}}>Feed</p></Link></button>
          </li>
          <li>
            <button><Link style={{textDecoration:'none'}} to="/convert?reload=1"><p style={{color: 'white'}}>Translate</p></Link></button>
          </li>
        </ul>
      </nav>
      <Routes>
        <Route path="/" element={<Home mode={mode}/>} />
        <Route path="/feed" element={<Feed mode={mode}/>} />
        <Route path="/convert" element={<Convert mode={mode}/>} />
      </Routes>
      </BrowserRouter>
    </>
  )
}

