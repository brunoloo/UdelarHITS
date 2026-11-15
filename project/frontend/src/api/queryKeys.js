// Keys del Home compartidas: una key mal escrita no falla, simplemente no invalida nada.

// Fija a propósito, sin user.id: un cambio de sesión la invalida (ver context/AuthContext.jsx).
export const HOME_FEED_KEY = ['categories', 'feed']

// Se refresca al publicar o eliminar un comentario de Home de primer nivel.
export const HOME_COUNT_KEY = ['replies', 'home', 'count']
