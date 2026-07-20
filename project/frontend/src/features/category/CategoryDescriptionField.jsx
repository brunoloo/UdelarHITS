import { ReadMore } from '../../components/ui/ReadMore'
import { PreviewTextField } from '../../components/shared/PreviewTextField'

// Campo de descripción de categoría con tabs Editar / Vista previa. Envuelve el
// PreviewTextField genérico con la config de categoría: la preview usa el MISMO
// markup que la página real (<p class="cat-desc"> + ReadMore), así el arte ASCII,
// los espacios y el truncado "Leer más" se ven igual que en CategoryPage.
// Compartido entre editar (EditCategoryModal) y crear (CreateCategoryPanel).
export function CategoryDescriptionField({ value, onChange, maxLength = 750, placeholder }) {
  return (
    <PreviewTextField
      value={value}
      onChange={onChange}
      label="Descripción (*)"
      maxLength={maxLength}
      placeholder={placeholder}
      renderPreview={v => <p className="cat-desc"><ReadMore text={v} maxLength={500} /></p>}
    />
  )
}
