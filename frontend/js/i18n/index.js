// ─── i18n helper — DG Limpiezas App ────────────────────────────────────────
// Uso: import { t, setLanguage } from '../i18n/index.js';
//
// NORMA DE DATOS INTERNOS:
//   Este helper traduce SOLO textos de interfaz visual.
//   Los valores guardados en Sheets (tipos de parte, estados, claves de
//   checklist, consumibles, incidencias, urgencias, casaLista) NUNCA
//   pasan por aquí. Siempre se guardan con sus valores estables en español.

import esDic from './es.js';
import ruDic from './ru.js';

const DICS = { es: esDic, ru: ruDic };

// Idioma activo — 'es' por defecto
let _lang = 'es';

/**
 * Establece el idioma de la interfaz.
 * Valores válidos: 'es' | 'ru'. Cualquier otro → fallback a 'es'.
 * @param {string} lang
 */
export function setLanguage(lang) {
  _lang = (lang === 'ru') ? 'ru' : 'es';
}

/** Devuelve el idioma activo actualmente. */
export function currentLang() {
  return _lang;
}

/**
 * Devuelve el texto traducido para la clave dada.
 * - Usa el diccionario del idioma activo.
 * - Si la clave no existe en el idioma activo, usa el español.
 * - Si tampoco existe en español, devuelve la propia clave (nunca undefined).
 *
 * Soporta interpolación simple de variables:
 *   t('sabayes.titulo', { activa: 'MIRADOR' })
 *   → 'Pausa tu parte de MIRADOR primero'
 *
 * @param {string} key
 * @param {Record<string, string>} [vars]
 * @returns {string}
 */
export function t(key, vars) {
  const dic = DICS[_lang] || esDic;
  let val = dic[key] ?? esDic[key] ?? key;
  if (vars) {
    val = val.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
  }
  return val;
}
