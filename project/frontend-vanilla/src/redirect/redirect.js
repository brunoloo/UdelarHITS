const params = new URLSearchParams(window.location.search);
const encodedUrl = params.get('to');

const urlBox = document.getElementById('externalUrl');
const continueBtn = document.getElementById('continueBtn');
const destinationHint = document.getElementById('destinationHint');

let destinationUrl = null;
try {
    destinationUrl = encodedUrl ? decodeURIComponent(encodedUrl) : null;
} catch (e) {
    destinationUrl = null;
}

if (destinationUrl && (destinationUrl.startsWith('https://') || destinationUrl.startsWith('http://'))) {
    urlBox.textContent = destinationUrl;
    continueBtn.href = destinationUrl;

    // Extraer el dominio para el hint
    try {
    const domain = new URL(destinationUrl).hostname;
    destinationHint.textContent = `Si no esperabas ir a "${domain}", no continúes.`;
    } catch (e) {
    // Si falla parsear la URL no mostrar hint
    }
} else {
    urlBox.textContent = 'Enlace inválido o no permitido.';
    urlBox.classList.add('url-box--invalid');
    continueBtn.style.display = 'none';
}

document.getElementById('backBtn').addEventListener('click', () => {
  if (history.length > 1) {
    history.back();
  } else {
    window.location.href = '/';
  }
});