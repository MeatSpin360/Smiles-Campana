// Configuración del sitio.
// Mientras SUPABASE_URL y SUPABASE_ANON_KEY estén vacíos, el sistema funciona en
// "modo demostración": los datos se guardan solo en el navegador que lo usa.
// Para ponerlo online con datos reales, completá estos dos valores (ver README).

export const SUPABASE_URL = 'https://spmdxhnqvnintedcrnnw.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_tgF3pypzypXmKnQ0wdY5Cg_xRw8UqGu';

export const CONSULTORIO = {
  nombre: 'Smiles Campana',
  profesional: "Dra. Florencia Patricia D'Ambrosio",
  especialidad: 'Ortodoncista, jefa de clínica',
  direccion: 'Jean Jaurès 568, Campana, Buenos Aires',
  telefono: '3487-728866',
  whatsapp: '5493487728866',
  email: 'smiles.campana@gmail.com',
  instagram: 'https://www.instagram.com/smiles.campana',
};

// Avisos automáticos al paciente. 'correo' se activa cuando el envío de correos esté funcionando.
// Mientras esté en false, al confirmar, cambiar o cancelar un turno se ofrece avisar por WhatsApp.
export const AVISOS = {
  correo: false,
};
