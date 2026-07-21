import { ReadMore } from '../../components/ui/ReadMore'
import { PreviewTextField } from '../../components/shared/PreviewTextField'

// Campo de descripción de categoría con tabs Editar / Vista previa. Envuelve el
// PreviewTextField genérico con la config de categoría: la preview usa el MISMO
// markup y la MISMA clase que la página real (<p class="category-description-content">
// + ReadMore), así el arte ASCII, los espacios, el ancho de columna y el truncado
// "Leer más" se ven idénticos a CategoryPage.
// Compartido entre editar (EditCategoryModal) y crear (CreateCategoryPanel).
export function CategoryDescriptionField({ value, onChange, maxLength = 750, placeholder }) {
  return (
    <PreviewTextField
      value={value}
      onChange={onChange}
      maxLength={maxLength}
      placeholder={placeholder}
      hideNote
      renderPreview={v => <p className="category-description-content"><ReadMore text={v} maxLength={500} /></p>}
    />
  )
}
