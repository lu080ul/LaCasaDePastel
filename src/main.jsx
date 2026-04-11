import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter as Router } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Aplica configurações visuais salvas antes do React renderizar
const savedFontSize = localStorage.getItem('lacasa_font_size');
if (savedFontSize) {
  document.documentElement.style.setProperty('--lacasa-font-size', savedFontSize + 'px');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>,
)
