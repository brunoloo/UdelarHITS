const showMe = document.querySelector("#profileNickname");

async function loadProfile() {
  const result = await apiGet("/users/me");

  if (!result.ok) {
    alert(result.message || "No autorizado");
    window.location.href = "/testing/user-testing.html";
    return;
  }

  const user = result.data.user || result.data;

  document.querySelector("#profileNickname").textContent = `Nickname: ${user.nickname}`;
  document.querySelector("#profileNombre").textContent = `Nombre: ${user.nombre}`;
  document.querySelector("#profileEmail").textContent = `Email: ${user.email}`;
  document.querySelector("#profileBio").textContent = `Biografía: ${user.biografia || ""}`;


  const avatar = document.querySelector("#profileAvatar");
  avatar.src = `http://localhost:5001/api/users/${user.id}/avatar`; // esto solo para desarrollo
}

document.addEventListener("DOMContentLoaded", () => {
  const showMe = document.querySelector("#profileNickname");
  if (showMe) loadProfile();
});