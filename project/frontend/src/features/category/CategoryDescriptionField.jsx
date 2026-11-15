import { ReadMore } from '../../components/ui/ReadMore'
import { PreviewTextField } from '../../components/shared/PreviewTextField'

// La preview usa la misma clase que la página (.category-description-content) y el textarea
// la misma fuente y ancho, para que los espacios y el wrap coincidan entre editar, preview y página.
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
