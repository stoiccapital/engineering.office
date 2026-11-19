import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Self-hosted fonts via @fontsource — replaces Google Fonts to avoid the
// third-country IP transfer that violates DSGVO (LG München 20.01.2022, 3 O 17493/20).
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
