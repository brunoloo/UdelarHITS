import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { BASE_TITLE } from '../utils/pageTitle'
import { reportPageView } from '../utils/analytics'

// Fija el document.title de la vista actual en la navegación de la SPA.
//
// El servidor ya inyecta el <title> correcto en la carga inicial; al navegar en
// cliente React cambia la vista sin recargar y nadie actualizaba el título, que
// quedaba con el de la carga anterior (p. ej. entrar a un perfil y volver al
// home dejaba el título del usuario). Cada vista llama a este hook para fijar su
// propio título con el mismo formato del servidor (ver utils/pageTitle.js).
//
// `title`  — título a mostrar. Un valor vacío cae al título base genérico, así
//            una ruta de detalle con contenido inexistente no se queda con el de
//            la vista anterior.
// `ready`  — si el título ya es el definitivo. Las vistas con datos async pasan
//            `!isLoading`: mientras cargan fijan el título (genérico) pero no
//            emiten el page_view hasta tener el título real, para que la
//            analítica no agrupe la navegación bajo un título de carga.
export function useDocumentTitle(title, ready = true) {
  const location = useLocation()
  const path = location.pathname + location.search
  const resolved = title || BASE_TITLE

  // Fija el título apenas se conoce (incluso durante la carga), para no arrastrar
  // el de la vista previa.
  useEffect(() => {
    document.title = resolved
  }, [resolved])

  // Reporta el título ya resuelto para que RootLayout emita el page_view con él.
  useEffect(() => {
    if (ready) reportPageView(path, resolved)
  }, [ready, resolved, path])
}
