// Moderación automática de imágenes con Google Cloud Vision SafeSearch.
//
// Se llama a la API REST directamente con fetch (NO el SDK @google-cloud/vision,
// que pesa ~50MB). Es un POST con API key. Solo se analizan IMÁGENES, nunca
// documentos: Vision cobra por llamada (free tier 1.000/mes) y un PDF no tiene
// sentido analizarlo — ese bypass lo hacen los callers (no pasan documentos acá).
//
// Filosofía de fallback (consistente con Defensa 4 de Cloudinary / Defensa 5 de
// Resend): si Vision falla o no está configurado, NUNCA bloqueamos al usuario —
// la imagen se publica igual y se loguea el problema. Degradar la función
// específica, no tumbar el sitio.

const VISION_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

// Umbral de rechazo: 'LIKELY' o 'VERY_LIKELY' en adult/racy marca la imagen.
const UNSAFE_LIKELIHOODS = new Set(['LIKELY', 'VERY_LIKELY']);

// ¿Está configurada la API key? Lo usa server.js para avisar al arrancar.
export const isVisionConfigured = () => Boolean(process.env.GOOGLE_VISION_API_KEY);

// Analiza una imagen ya subida a Cloudinary por su URL pública.
// Devuelve:
//   { safe: true }                       → segura, o check desactivado/falló (fallback)
//   { safe: false, scores: { adult, racy } } → marcada por Vision
export const checkImageSafety = async (imageUrl) => {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;

  // Sin API key: check desactivado silenciosamente (permite dev/test sin key).
  if (!apiKey) return { safe: true };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${VISION_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        requests: [
          {
            image: { source: { imageUri: imageUrl } },
            features: [{ type: 'SAFE_SEARCH_DETECTION' }],
          },
        ],
      }),
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Vision respondió ${res.status}: ${detail.slice(0, 200)}`);
    }

    const data = await res.json();
    const annotation = data?.responses?.[0]?.safeSearchAnnotation;

    // La API puede responder 200 con un error por imagen (p. ej. URL no
    // accesible): sin anotación, no podemos decidir → fallback a seguro.
    if (!annotation) {
      const apiError = data?.responses?.[0]?.error?.message;
      throw new Error(apiError || 'Respuesta de Vision sin safeSearchAnnotation');
    }

    const adult = annotation.adult;
    const racy = annotation.racy;

    if (UNSAFE_LIKELIHOODS.has(adult) || UNSAFE_LIKELIHOODS.has(racy)) {
      return { safe: false, scores: { adult, racy } };
    }
    return { safe: true };
  } catch (err) {
    // Fallback: no bloquear al usuario por un problema de infra externo.
    console.error(`[vision] no se pudo analizar la imagen ${imageUrl}: ${err.message}`);
    return { safe: true };
  }
};
