import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import '@fontsource/mochiy-pop-one/latin-400.css';
import '@fontsource/patrick-hand/latin-400.css';
import '@fontsource/courier-prime/latin-400.css';
import './styles/tokens.css';
import './styles/base.css';
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
