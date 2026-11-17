import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/tokens.css'
import './styles/ui.css'
import App from './App'
import { installInputGuards } from './utils/validate'

installInputGuards()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
