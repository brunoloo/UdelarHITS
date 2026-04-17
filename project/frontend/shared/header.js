document.addEventListener('DOMContentLoaded', () => {
  const header = document.createElement('header');
  header.innerHTML = `<a href="/"><h1>UdelarHITS</h1></a>`;
  document.body.prepend(header);
});