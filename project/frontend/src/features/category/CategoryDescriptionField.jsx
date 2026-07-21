import { ReadMore } from '../../components/ui/ReadMore'
import { PreviewTextField } from '../../components/shared/PreviewTextField'

// Campo de descripción de categoría con tabs Editar / Vista previa. Envuelve el
// PreviewTextField genérico con la config de categoría. Los TRES lugares comparten
// el mismo contrato de render (ver .category-description-content en global.css):
//   • la preview usa <p class="category-description-content"> (igual que la página),
//   • el textarea usa class="category-description-editor" (misma fuente y ancho),
// así el arte ASCII, los espacios y el wrap coinciden entre editar, preview y página.
// Compartido entre editar (EditCategoryModal) y crear (CreateCategoryPanel).
export function CategoryDescriptionField({ value, onChange, maxLength = 1000, placeholder }) {
  return (
    <PreviewTextField
      value={value}
      onChange={onChange}
      maxLength={maxLength}
      placeholder={placeholder}
      editorClassName="category-description-editor"
      hideNote
      renderPreview={v => <p className="category-description-content"><ReadMore text={v} maxLength={500} /></p>}
    />
  )
}
