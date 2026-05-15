(async function() {
  try {
    const response = await fetch('/api/users/me', {
      method: 'GET'
    });

    const body = await response.json();

    const isLogged = (body.ok && body.data && body.data.user);

    if (!isLogged) {
      window.location.replace("/src/auth/login.html?msg=ver-usuarios");
    } else {
      document.documentElement.style.visibility = 'visible';
    }
  } catch (error) {
    console.error("Error validando sesión:", error);
    window.location.replace("/src/auth/login.html?msg=error");
  }
})();