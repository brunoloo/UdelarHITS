// Se llama a la API REST con fetch, sin SDK. Solo se analizan imágenes.
// Si el servicio falla o no está configurado, la imagen se publica igual.

const VISION_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

// LIKELY o VERY_LIKELY en adult o racy marca la imagen.
const UNSAFE_LIKELIHOODS = new Set(['LIKELY', 'VERY_LIKELY']);

export const isVisionConfigured = () => Boolean(process.env.GOOGLE_VISION_API_KEY);

// Devuelve { safe: true } también cuando el análisis está desactivado o falla.
export const checkImageSafety = async (imageUrl) => {
  // Nunca se llama a la API real desde los tests, aunque haya una key en el entorno.
  if (process.env.NODE_ENV === 'test') return { safe: true };

  const apiKey = process.env.GOOGLE_VISION_API_KEY;

  // Sin API key el análisis queda desactivado.
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

    // La API puede responder 200 con un error por imagen: sin anotación se asume segura.
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
    // Un problema del servicio externo no bloquea al usuario.
    console.error(`[vision] no se pudo analizar la imagen ${imageUrl}: ${err.message}`);
    return { safe: true };
  }
};
