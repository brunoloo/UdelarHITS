import { ReadMore } from '../../components/ui/ReadMore'
import { PreviewTextField } from '../../components/shared/PreviewTextField'

// La preview usa el mismo markup y la misma clase que el cuerpo del tema en TopicPage, y el
// textarea la misma tipografía.
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
