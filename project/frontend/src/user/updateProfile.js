let currentUser = {};

// ESTE JS SOLO ESTÁ EN ALCANCE DE TESTING

async function loadProfile() {
  const result = await apiGet("/users/me");

  if (!result.ok) {
    alert(result.message || "No autorizado");
    window.location.href = "/";
    return;
  }

  const user = result.data.user || result.data;
  currentUser = user;

  document.querySelector("#profileNickname").textContent = user.nickname;
  document.querySelector("#profileNombre").textContent = user.nombre;
  document.querySelector("#profileEmail").textContent = user.email;
  document.querySelector("#profileBio").textContent = user.biografia || "";

  const avatar = document.querySelector("#profileAvatar");
  avatar.src = `http://localhost:5001/api/users/${user.id}/avatar`;
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.querySelector("#profileNickname")) return;

  loadProfile();

  // Lápices: alternar entre texto e input
  document.querySelectorAll(".edit-btn[data-field]").forEach(btn => {
    btn.addEventListener("click", () => {
      const field = btn.dataset.field;
      const inputMap = {
        nombre: { p: "#profileNombre", input: "#inputNombre" },
        biografia: { p: "#profileBio", input: "#inputBiografia" },
      };
      const { p, input } = inputMap[field];
      const pEl = document.querySelector(p);
      const inputEl = document.querySelector(input);
      const isEditing = inputEl.style.display !== "none";
      if (isEditing) {
        pEl.textContent = inputEl.value || currentUser[field] || "";
        inputEl.style.display = "none";
        pEl.style.display = "";
      } else {
        inputEl.value = pEl.textContent;
        inputEl.style.display = "";
        pEl.style.display = "none";
        inputEl.focus();
      }
    });
  });

  // Avatar
  document.querySelector("#avatarEditBtn").addEventListener("click", () => {
    const input = document.querySelector("#avatarInput");
    const isHidden = input.style.display === "none" || input.style.display === "";
    input.style.display = isHidden ? "block" : "none";
    if (isHidden) input.focus();
  });

  // Preview avatar al escribir URL
  document.querySelector("#avatarInput").addEventListener("input", (e) => {
    const url = e.target.value.trim();
    if (url) document.querySelector("#profileAvatar").src = url;
  });

  // Confirmar cambios
  document.querySelector("#confirmBtn").addEventListener("click", async () => {
    const body = {};
    const nombreInput = document.querySelector("#inputNombre");
    const bioInput = document.querySelector("#inputBiografia");
    const avatarInput = document.querySelector("#avatarInput");

    body.nombre = nombreInput.style.display !== "none"
      ? nombreInput.value.trim()
      : currentUser.nombre;

    body.biografia = bioInput.style.display !== "none"
      ? bioInput.value.trim()
      : currentUser.biografia || "";

    if (avatarInput.style.display !== "none" && avatarInput.value.trim()) {
      body.url_imagen = avatarInput.value.trim();
    }

    if (!body.nombre) {
      alert("El nombre no puede estar vacío.");
      return;
    }

    const result = await apiPatch("/users/me", body);
    if (result.ok) {
      alert("Perfil actualizado correctamente");
      window.location.href = "profile.html";
    } else {
      alert(result.message || "Error al actualizar");
    }
  });
});