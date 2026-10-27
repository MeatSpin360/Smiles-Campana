// Elige la implementación según config.js: Supabase si está configurado, demostración si no.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../../config.js';

const configurado = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const mod = configurado ? await import('./supabase.js') : await import('./demo.js');

export const api = mod.api;
export const modoDemo = mod.modoDemo;
