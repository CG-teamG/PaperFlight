import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import FlightTest from './FlightTest.jsx'
import './FlightTest.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FlightTest />
  </StrictMode>,
)
