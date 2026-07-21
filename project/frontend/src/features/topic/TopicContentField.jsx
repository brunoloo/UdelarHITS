import { ReadMore } from '../../components/ui/ReadMore'
import { PreviewTextField } from '../../components/shared/PreviewTextField'

// Campo de contenido de tema con tabs Editar / Vista previa. Envuelve el
// PreviewTextField genérico con la config de tema: la preview usa el MISMO markup y
// la MISMA clase que el cuerpo real del tema en TopicPage (<div class="topic-header-body">
// + ReadMore), y el textarea usa class="topic-content-editor" (misma tipografía), así
// lo que se escribe, la preview y lo publicado se ven igual.
// Compartido entre crear (CreateTopicPanel) y editar (modal de TopicPage).
export function TopicContentField({ value, onChange, maxLength = 1000, placeholder }) {
  return (
    <PreviewTextField
      value={value}
      onChange={onChange}
      maxLength={maxLength}
      placeholder={placeholder}
      editorClassName="topic-content-editor"
      hideNote
      renderPreview={v => <div className="topic-header-body"><ReadMore text={v} maxLength={500} /></div>}
    />
  )
}
