import {
  LayoutGrid, Code, Terminal, Monitor, GraduationCap, BookOpen, Pencil, Music, Film,
  Camera, Palette, FlaskConical, Atom, Brain, Heart, Users, MessageCircle, Briefcase,
  BarChart3, DollarSign, Globe, Map, Plane, Gamepad2, Trophy, Wrench, Settings, Leaf,
  PawPrint, Utensils, Coffee, Scale, Gavel, Stethoscope,
} from 'lucide-react'
import { DEFAULT_CATEGORY_ICON } from '../../../../shared/categoryIcons.js'

// Mapa nombre (estilo Lucide, ver shared/categoryIcons.js) → componente Lucide.
const ICON_MAP = {
  'grid': LayoutGrid,
  'code': Code,
  'terminal': Terminal,
  'monitor': Monitor,
  'graduation-cap': GraduationCap,
  'book-open': BookOpen,
  'pencil': Pencil,
  'music': Music,
  'film': Film,
  'camera': Camera,
  'palette': Palette,
  'flask': FlaskConical,
  'atom': Atom,
  'brain': Brain,
  'heart': Heart,
  'users': Users,
  'message-circle': MessageCircle,
  'briefcase': Briefcase,
  'bar-chart': BarChart3,
  'dollar-sign': DollarSign,
  'globe': Globe,
  'map': Map,
  'plane': Plane,
  'gamepad-2': Gamepad2,
  'trophy': Trophy,
  'wrench': Wrench,
  'settings': Settings,
  'leaf': Leaf,
  'paw-print': PawPrint,
  'utensils': Utensils,
  'coffee': Coffee,
  'scale': Scale,
  'gavel': Gavel,
  'stethoscope': Stethoscope,
}

// Render del ícono de una categoría por nombre. Si el nombre no existe, cae al
// default ('grid'). Acepta size y demás props de los íconos de Lucide.
export function CategoryIcon({ name, size = 20, ...props }) {
  const Cmp = ICON_MAP[name] || ICON_MAP[DEFAULT_CATEGORY_ICON]
  return <Cmp size={size} {...props} />
}
