// Query keys del Home compartidas entre FeedPage, el sidebar de Comunidad, el
// permalink de comentario y useGoHome. Estaban duplicadas como literales en
// cada uno; tenerlas acá evita que se desincronicen (una key mal escrita no
// falla: simplemente no invalida nada).

// Feed del inicio (infinite query). Es FIJA a propósito: no lleva user.id —
// ver el comentario largo en context/AuthContext.jsx (login) sobre por qué, y
// por qué un cambio de sesión la invalida en vez de rearmarla.
export const HOME_FEED_KEY = ['categories', 'feed']

// Contador de comentarios de Home del sidebar de Comunidad: se refresca al
// publicar/eliminar un comentario de Home de primer nivel.
export const HOME_COUNT_KEY = ['replies', 'home', 'count']
