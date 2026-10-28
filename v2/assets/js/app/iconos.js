// Íconos de línea, 24×24, heredan el color del texto.
const i = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICONOS = {
  casa: i('<path d="M4 11 12 4l8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'),
  calendario: i('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  diente: i('<path d="M7.5 3.5c-2.6 0-4 2-4 4.6 0 3 1.4 4.3 1.8 6.8.4 2.9.9 5.6 2.6 5.6 1.6 0 1.7-2.8 2.5-4.5.4-.9.8-1.3 1.6-1.3s1.2.4 1.6 1.3c.8 1.7.9 4.5 2.5 4.5 1.7 0 2.2-2.7 2.6-5.6.4-2.5 1.8-3.8 1.8-6.8 0-2.6-1.4-4.6-4-4.6-1.7 0-2.8.8-4.5.8s-2.8-.8-4.5-.8z"/>'),
  persona: i('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4 4.4-6 8-6s6.8 2 8 6"/>'),
  personas: i('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.6-5.2 6.5-5.2s5.5 1.7 6.5 5.2"/><path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M18 14.6c1.6.7 2.8 2.4 3.5 5.4"/>'),
  reloj: i('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  llave: i('<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2"/>'),
  salir: i('<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10"/>'),
  mas: i('<path d="M12 5v14M5 12h14"/>'),
  buscar: i('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>'),
  izquierda: i('<path d="m15 5-7 7 7 7"/>'),
  derecha: i('<path d="m9 5 7 7-7 7"/>'),
  telefono: i('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>'),
  whatsapp: i('<path d="M4 20l1.2-3.6A8 8 0 1 1 8 19.2z"/>'),
  correo: i('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7.5 8 6 8-6"/>'),
  enlace: i('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  check: i('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  alerta: i('<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>'),
  historial: i('<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 4v4h4M12 8v4.5l3 1.5"/>'),
  nota: i('<path d="M6 3.5h9l4 4V20a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 20z"/><path d="M14.5 3.5V8H19M9 12h7M9 16h5"/>'),
};
