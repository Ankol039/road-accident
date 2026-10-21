/**
 * App entry point.
 *
 * Load order matters: Bootstrap first, then the app theme, then the landing
 * styles, then Leaflet (which the map components assume is present).
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import 'bootstrap/dist/css/bootstrap.min.css'
import 'leaflet/dist/leaflet.css'
import './styles/app.css'
import './styles/landing.css'

import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
