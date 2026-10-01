import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import '@fontsource/anton/400.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import './index.css'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import FaceSearch from './pages/FaceSearch.jsx'
import Indexer from './pages/Indexer.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/gallery" element={<FaceSearch />} />
          <Route path="/indexer" element={<Indexer />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
