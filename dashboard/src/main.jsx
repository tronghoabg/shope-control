import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ShopeProvider, Toaster } from './ShopeContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ShopeProvider>
      <App />
      <Toaster />
    </ShopeProvider>
  </React.StrictMode>
)
