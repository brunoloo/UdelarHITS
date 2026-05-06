const createReplyForm = document.getElementById("createReplyForm");
const categoriaSelect = createReplyForm.querySelector('[name="categoria_id"]');
const temaSelect = createReplyForm.querySelector('[name="tema_id"]');

async function loadCategories() {
  const result = await apiGet("/categories/active");
  if (!result.ok) return;

  result.data.forEach(c => {
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = c.titulo;
    categoriaSelect.appendChild(option);
  });
}

async function loadTopics(categoriaId) {
  temaSelect.innerHTML = `<option value="">Comentar directo en la categoría</option>`;
  temaSelect.disabled = false;

  const result = await apiGet(`/topics/category/${categoriaId}`);
  if (!result.ok) return;

  result.data.forEach(t => {
    const option = document.createElement("option");
    option.value = t.contenido_id;
    option.textContent = t.titulo;
    temaSelect.appendChild(option);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadCategories();

  categoriaSelect.addEventListener("change", () => {
    const categoriaId = categoriaSelect.value;
    if (categoriaId) loadTopics(categoriaId);
  });

  createReplyForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const cuerpo = createReplyForm.querySelector('[name="cuerpo"]').value;
    const categoria_id = categoriaSelect.value;
    const tema_id = temaSelect.value && temaSelect.value !== "" ? temaSelect.value : null;

    if (!cuerpo?.trim()) {
      alert("El contenido no puede estar vacío");
      return;
    }
    if (!categoria_id) {
      alert("Seleccioná una categoría");
      return;
    }

    const body = { cuerpo };
    if (tema_id) {
      body.tema_id = tema_id;
    } else {
      body.categoria_id = categoria_id;
    }

    const result = await apiPost("/replies/create", body);

    if (result.ok) {
      alert("Comentario publicado correctamente");
      createReplyForm.reset();
      temaSelect.innerHTML = `<option value="">Comentar directo en la categoría</option>`;
      temaSelect.disabled = true;
    } else {
      alert(result.message || "Error desconocido");
    }
  });
});