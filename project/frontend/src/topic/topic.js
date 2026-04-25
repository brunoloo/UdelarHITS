async function loadTopic() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    alert("No se especificó un tema");
    window.location.href = "/src/topic/topics.html";
    return;
  }

  const [topicResult, meResult] = await Promise.all([
    apiGet(`/topics/${id}`),
    apiGet("/users/me")
  ]);

  if (!topicResult.ok) {
    alert(topicResult.message || "Error al cargar el tema");
    window.location.href = "/src/topic/topics.html";
    return;
  }

  const t = topicResult.data;
  const isAdmin = meResult.ok && meResult.data.user?.rol === 'admin';

  const topicBody = document.querySelector("#topicTable tbody");
  topicBody.innerHTML = `
    ${isAdmin ? `<tr><th>ID</th><td>${t.id}</td></tr>` : ''}
    <tr><th>Título</th><td>${t.titulo}</td></tr>
    <tr><th>Autor</th><td><a href="../user/profile.html?nickname=${encodeURIComponent(t.autor_nickname)}">${t.autor_nickname}</a></td></tr>
    <tr><th>Descripción</th><td>${t.cuerpo}</td></tr>
    <tr><th>Estado</th><td>${t.estado}</td></tr>
    <tr><th>Fecha de creación</th><td>${new Date(t.fecha_creacion).toLocaleString()}</td></tr>
  `;

  // Comentarios
  const commentsBody = document.querySelector("#commentsTable tbody");
  const repliesResult = await apiGet(`/replies/topic/${id}`);

  if (!repliesResult.ok || repliesResult.data.length === 0) {
    commentsBody.innerHTML = `<tr><td colspan="5">Sin comentarios aún</td></tr>`;
  } else {
    repliesResult.data.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.id}</td>
        <td><a href="../user/profile.html?nickname=${encodeURIComponent(r.autor_nickname)}">${r.autor_nickname}</a></td>
        <td>${r.cuerpo}</td>
      `;
      commentsBody.appendChild(tr);
    });
  }
}

loadTopic();