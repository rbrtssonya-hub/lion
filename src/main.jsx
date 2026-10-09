import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/base.css';
import './styles/home.css';
import './styles/model.css';
import './styles/chapters.css';

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
