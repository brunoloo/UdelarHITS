// Set predefinido de íconos disponibles para las categorías (frontend).
// El valor almacenado en `categoria.icono` es uno de estos nombres (kebab-case,
// estilo Lucide). Mantener en sync con backend/src/config/categoryIcons.js.

export const DEFAULT_CATEGORY_ICON = 'grid';

export const CATEGORY_ICONS = [
  'grid',          // default
  'code',
  'terminal',
  'monitor',
  'graduation-cap',
  'book-open',
  'pencil',
  'music',
  'film',
  'camera',
  'palette',
  'flask',
  'atom',
  'brain',
  'heart',
  'users',
  'message-circle',
  'briefcase',
  'bar-chart',
  'dollar-sign',
  'globe',
  'map',
  'plane',
  'gamepad-2',
  'trophy',
  'wrench',
  'settings',
  'leaf',
  'paw-print',
  'utensils',
  'coffee',
  'scale',
  'gavel',
  'stethoscope',
];

export const isValidCategoryIcon = (name) => CATEGORY_ICONS.includes(name);
