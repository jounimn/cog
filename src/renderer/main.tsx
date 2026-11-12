import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/global.css'
import './ui/ui.css'
import { mountVoiceRecorder } from './streamdeck/voice-recorder'

mountVoiceRecorder()

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
