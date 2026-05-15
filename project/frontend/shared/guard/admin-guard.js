(async function() {
  try {
    const response = await fetch('/api/users/me', {
      method: 'GET'
    });

    const body = await response.json();

    const isAdmin = (body.ok && body.data && body.data.user && body.data.user.rol === 'admin');

    if (!isAdmin) {
      window.location.replace("/");
    } else {
      document.documentElement.style.visibility = 'visible';
    }
  } catch (error) {
    console.error("Error validando sesión:", error);
    window.location.replace("/");
  }
})();