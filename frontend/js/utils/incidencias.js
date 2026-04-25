import { CASA_ICON } from './casas.js';
import { t, currentLang } from '../i18n/index.js';

// Traducciones visuales de categorías (el valor guardado sigue siendo el español)
const CAT_RU = {
  'Electricidad': '\u042d\u043b\u0435\u043a\u0442\u0440\u0438\u0447\u0435\u0441\u0442\u0432\u043e',
  'Agua': '\u0412\u043e\u0434\u0430',
  'Calefacci\u00f3n': '\u041e\u0442\u043e\u043f\u043b\u0435\u043d\u0438\u0435',
  'WiFi': 'WiFi',
  'Puertas-cerraduras': '\u0414\u0432\u0435\u0440\u0438/\u0437\u0430\u043c\u043a\u0438',
  'Electrodom\u00e9sticos': '\u0411\u044b\u0442\u043e\u0432\u0430\u044f \u0442\u0435\u0445\u043d\u0438\u043a\u0430',
  'Mobiliario': '\u041c\u0435\u0431\u0435\u043b\u044c',
  'Exterior': '\u0423\u043b\u0438\u0446\u0430/\u0421\u0430\u0434',
  'Limpieza extra': '\u0414\u043e\u043f. \u0443\u0431\u043e\u0440\u043a\u0430',
  'Plagas': '\u0412\u0440\u0435\u0434\u0438\u0442\u0435\u043b\u0438',
  'Otro': '\u0414\u0440\u0443\u0433\u043e\u0435',
};

// Traducciones visuales de ubicaciones (el valor guardado sigue siendo el español)
const UBI_RU = {
  'Cocina': '\u041a\u0443\u0445\u043d\u044f',
  'Sal\u00f3n': '\u0413\u043e\u0441\u0442\u0438\u043d\u0430\u044f',
  'Ba\u00f1o': '\u0412\u0430\u043d\u043d\u0430\u044f',
  'Ba\u00f1o PB': '\u0412\u0430\u043d\u043d\u0430\u044f (1 \u044d\u0442.)',
  'Ba\u00f1o abajo': '\u0412\u0430\u043d\u043d\u0430\u044f (\u043d\u0438\u0437)',
  'Ba\u00f1os arriba': '\u0412\u0430\u043d\u043d\u044b\u0435 (\u0432\u0435\u0440\u0445)',
  'Ba\u00f1o com\u00fan PB': '\u041e\u0431\u0449\u0438\u0439 \u0441\u0430\u043d\u0443\u0437\u0435\u043b',
  'Entrada': '\u0412\u0445\u043e\u0434',
  'Habitaci\u00f3n grande': '\u0411\u043e\u043b\u044c\u0448\u0430\u044f \u043a\u043e\u043c\u043d\u0430\u0442\u0430',
  'Habitaci\u00f3n peque\u00f1a': '\u041c\u0430\u043b\u0430\u044f \u043a\u043e\u043c\u043d\u0430\u0442\u0430',
  'Habitaci\u00f3n Matrimonio': '\u0414\u0432\u0443\u0445\u0441\u043f\u0430\u043b\u044c\u043d\u0430\u044f',
  'Habitaci\u00f3n Nido': '\u041a\u043e\u043c\u043d\u0430\u0442\u0430 \u041d\u0438\u0434\u043e',
  'Habitaci\u00f3n Literas': '\u041a\u043e\u043c\u043d\u0430\u0442\u0430 \u0441 \u043a\u0440\u043e\u0432\u0430\u0442\u044f\u043c\u0438',
  'Habitaci\u00f3n 2 camas': '\u041a\u043e\u043c\u043d\u0430\u0442\u0430 2 \u043a\u0440\u043e\u0432\u0430\u0442\u0438',
  'Habitaci\u00f3n Flumen': 'Flumen',
  'Habitaci\u00f3n Gratal': 'Gratal',
  'Habitaci\u00f3n Tiacuto': 'Tiacuto',
  'Habitaci\u00f3n \u00c1guila': '\u00c1guila',
  'Habitaci\u00f3n Gabardiella': 'Gabardiella',
  'Habitaci\u00f3n Pic\u00f3n': 'Pic\u00f3n',
  'Sala de juegos': '\u0418\u0433\u0440\u043e\u0432\u0430\u044f \u043a\u043e\u043c\u043d\u0430\u0442\u0430',
  'Oficina': '\u041e\u0444\u0438\u0441',
  'Despensa': '\u041a\u043b\u0430\u0434\u043e\u0432\u0430\u044f',
  'Exterior': '\u0423\u043b\u0438\u0446\u0430',
  'Exterior/Jard\u00edn': '\u0421\u0430\u0434/\u0443\u043b\u0438\u0446\u0430',
  'Jard\u00edn delantero': '\u041f\u0435\u0440\u0435\u0434\u043d\u0438\u0439 \u0441\u0430\u0434',
  'Jard\u00edn trasero': '\u0417\u0430\u0434\u043d\u0438\u0439 \u0441\u0430\u0434',
  'Barbacoa': '\u041c\u0430\u043d\u0433\u0430\u043b',
  'Piscina': '\u0411\u0430\u0441\u0441\u0435\u0439\u043d',
  'Chimenea/Hogar': '\u041a\u0430\u043c\u0438\u043d',
  'Ba\u00f1o suite': '\u0421\u0430\u043d\u0443\u0437\u0435\u043b \u0441\u044e\u0438\u0442\u0430',
  'Ba\u00f1o escaleras': '\u0421\u0430\u043d\u0443\u0437\u0435\u043b \u043b\u0435\u0441\u0442\u043d\u0438\u0446\u044b',
  'Otro': '\u0414\u0440\u0443\u0433\u043e\u0435',
};

/**
 * Devuelve la etiqueta visual de una categor\u00eda en el idioma activo.
 * El valor interno espa\u00f1ol se guarda siempre; esto es solo para mostrar.
 */
export function tCat(cat) {
  if (currentLang() === 'ru') return CAT_RU[cat] || cat;
  return cat;
}

/**
 * Devuelve la etiqueta visual de una ubicaci\u00f3n en el idioma activo.
 */
export function tUbi(ubi) {
  if (currentLang() === 'ru') return UBI_RU[ubi] || ubi;
  return ubi;
}

// Traducciones visuales de consumibles conocidos del catálogo
// El valor guardado (data-item) sigue siendo el nombre español estable del catálogo.
const CONS_RU = {
  'Papel higiénico': 'Туалетная бумага',
  'Papel de cocina': 'Бумажные полотенца',
  'Jabón de manos': 'Мыло для рук',
  'Gel de ducha': 'Гель для душа',
  'Champú': 'Шампунь',
  'Línea de baño': 'Косметика для ванной',
  'Pastilla jabón': 'Мыло кусоковое',
  'Lavavajillas': 'Средство для посуды',
  'Pastillas lóvaplatos': 'Таблетки для посудомоечной машины',
  'Líquido lóvaplatos': 'Жидкость для посуды',
  'Bolsas basura': 'Мешки для мусора',
  'Bolsas basura pequeñas': 'Малые мешки для мусора',
  'Salón/cocina completos': 'Гостиная/кухня',
  'Toallas': 'Полотенца',
  'Sábanas': 'Постельное бельё',
  'Funda nórdica': 'Пуховое одеяло',
  'Sal': 'Соль',
  'Aceite': 'Масло',
  'Azúcar': 'Сахар',
  'Café': 'Кофе',
  'Filtros café': 'Фильтры для кофеварки',
  'Pastillas lóvaplatos maq.': 'Таблетки (посудомоечная)',
  'Ambientador': 'Освежитель',
  'Pastillas WC': 'Таблетки для унитаза',
  'Leña': 'Дрова',
  'Pilas': 'Батарейки',
};

/**
 * Devuelve la etiqueta visual de un consumible en el idioma activo.
 * El dato guardado (data-item, urgencia) nunca cambia.
 */
export function tConsumible(item) {
  if (currentLang() === 'ru') return CONS_RU[item] || item;
  return item;
}

export const CATEGORIAS_INCIDENCIA = [
  'Electricidad', 'Agua', 'Calefacción', 'WiFi', 'Puertas-cerraduras',
  'Electrodomésticos', 'Mobiliario', 'Exterior', 'Limpieza extra',
  'Plagas', 'Otro'
];

export function getUbicaciones(casa) {
  const map = {
    MIRADOR: ['Cocina', 'Salón', 'Habitación Flumen', 'Baño común PB', 'Oficina', 'Despensa',
      'Sala de juegos', 'Habitación Gratal', 'Habitación Tiacuto', 'Habitación Águila',
      'Habitación Gabardiella', 'Habitación Picón', 'Exterior/Jardín', 'Piscina'],
    CASON: ['Entrada', 'Cocina', 'Salón', 'Baño PB', 'Habitación grande', 'Habitación pequeña',
      'Baño suite', 'Baño escaleras', 'Chimenea/Hogar', 'Exterior'],
    GRATAL: ['Entrada', 'Cocina', 'Salón', 'Baño', 'Habitación Matrimonio', 'Habitación Nido',
      'Habitación Literas', 'Habitación 2 camas', 'Sala de juegos',
      'Jardín delantero', 'Jardín trasero', 'Barbacoa', 'Piscina'],
  };
  return map[casa] || [];
}
