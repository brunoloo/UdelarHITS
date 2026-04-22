let currentReply = {};

async function loadReply() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    alert("No se especificó un comentario");
    window.location.href = "/src/reply/myReplies.html";
    return;
  }

  const result = await apiGet(`/replies/${id}`);

  if (!result.ok) {
    alert(result.message || "Error al cargar el comentario");
    window.location.href = "/src/reply/myReplies.html";
    return;
  }

  const r = result.data;
  currentReply = r;

  document.querySelector("#replyDestino").textContent = r.destino_titulo;
  document.querySelector("#replyCuerpo").textContent = r.cuerpo;
}

document.addEventListener("DOMContentLoaded", () => {
  loadReply();

  document.querySelector(".edit-btn[data-field='cuerpo']").addEventListener("click", () => {
    const p = document.querySelector("#replyCuerpo");
    const input = document.querySelector("#inputCuerpo");
    const isEditing = input.style.display !== "none";
    if (isEditing) {
      p.textContent = input.value || currentReply.cuerpo;
      input.style.display = "none";
      p.style.display = "";
    } else {
      input.value = p.textContent;
      input.style.display = "";
      p.style.display = "none";
      input.focus();
    }
  });

  document.querySelector("#confirmBtn").addEventListener("click", async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    const inputCuerpo = document.querySelector("#inputCuerpo");
    const cuerpo = inputCuerpo.style.display !== "none"
      ? inputCuerpo.value.trim()
      : currentReply.cuerpo;

    if (!cuerpo) {
      alert("El contenido no puede estar vacío");
      return;
    }

    const result = await apiPatch(`/replies/update/${id}`, { cuerpo });

    if (result.ok) {
      alert("Comentario actualizado correctamente");
      window.location.href = "/src/reply/myReplies.html";
    } else {
      alert(result.message || "Error al actualizar");
    }
  });
});