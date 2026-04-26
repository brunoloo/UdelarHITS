import { registerUserService, loginUserService, getUsersService, createUserByAdminService,
    getUserProfileService, showMeService, updateMeService, 
    getUserAvatarService, banUserService, activeUserService, deleteUserService,
  followUserService, unfollowUserService, isFollowingService, updateAvatarService } from '../services/user.service.js';

const showMe = async (req, res) => {
  try {
    const result = await showMeService(req.user.nickname);
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ ok: false, message: error.message });
    }
    if (error.code === 'BAD_REQUEST') {
      return res.status(400).json({ ok: false, message: error.message });
    }
    return res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

const registerUser = async (req, res) => {
  try {
    const result = await registerUserService(req.body);
    return res.status(201).json({
        ok: true,
        message: 'Usuario registrado correctamente',
        data: {
            id: result.id,
            nickname: result.nickname,
            nombre: result.nombre,
            email: result.email,
            rol: result.rol
        }
    })
  } catch (error) {
    if (error.code === 'USER_EXISTS') {
      return res.status(409).json({ ok: false, message: error.message });
    }
    if (error.code === 'NICKNAME_EXISTS') {
      return res.status(409).json({ ok: false, message: error.message });
    }
    if (error.code === 'EMAIL_EXISTS') {
      return res.status(409).json({ ok: false, message: error.message });
    }
    if (error.code === 'BAD_REQUEST') {
      return res.status(400).json({ ok: false, message: error.message });
    }
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

// Crear usuario admin
export const createUserByAdmin = async (req, res) => {
  try {
    const result = await createUserByAdminService(req.body);
    return res.status(201).json({
      ok: true,
      data: {
        id: result.id,
        rol: result.rol,
        nickname: result.nickname,
        nombre: result.nombre,
        email: result.email
      }
    });
  } catch (error) {
    if (error.code === 'ADMIN_EXISTS') {
      return res.status(400).json({ ok: false, message: error.message });
    }
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const loginUser = async (req, res) => {
    try {
    const result = await loginUserService(req.body);
    res.cookie("jwt", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: (1000*60*60*24)*7 // 7 días
    })
    return res.status(200).json({ 
      ok: true,
      message: 'Login exitoso', 
      data: {
        user: result.user,
        token: result.token 
      } 
    });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'INVALID_CREDENTIALS') return res.status(401).json({ ok: false, message: error.message });
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
}

const logoutUser = async (req, res) => {
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });

  return res.status(200).json({
    ok: true,
    message: 'Logout exitoso'
  });
};

const getUsers = async (req, res) => {
  try {
    const users = await getUsersService();
    return res.status(200).json({ ok: true, data: users });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const { nickname } = req.params;
    const data = await getUserProfileService(nickname);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const updateMe = async (req, res) => {
  try {
    const updated = await updateMeService(req.user.id, req.body);
    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getUserAvatar = async (req, res) => {
  try {
    const { id } = req.params;
    const url = await getUserAvatarService(id);

    const fallback = '/assets/default-user.jpg';
    return res.redirect(url || fallback);
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const banUser = async (req, res) => {
  try {
    const { nickname } = req.params;
    const updated = await banUserService(nickname);
    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const activeUser = async (req, res) => {
  try {
    const { nickname } = req.params;
    const updated = await activeUserService(nickname);
    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { nickname } = req.params;
    const deleted = await deleteUserService(nickname);
    return res.status(200).json({ 
      ok: true, 
      message: 'Usuario eliminado correctamente',
      data: deleted });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'BAD_REQUEST') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const changeUserPassword = async (req, res) => {} // TODO

const followUser = async (req, res) => {
  try {
    const { nickname } = req.params;
    await followUserService(req.user.id, nickname);
    return res.status(200).json({ ok: true });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const unfollowUser = async (req, res) => {
  try {
    const { nickname } = req.params;
    await unfollowUserService(req.user.id, nickname);
    return res.status(200).json({ ok: true });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const checkFollowing = async (req, res) => {
  try {
    const { nickname } = req.params;
    const following = await isFollowingService(req.user.id, nickname);
    return res.status(200).json({ ok: true, data: { following } });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'No se proporcionó ninguna imagen' });
    }
    const updated = await updateAvatarService(req.user.id, req.file.buffer, req.file.mimetype);
    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

export { showMe, registerUser, loginUser, logoutUser, getUsers, 
  getUserProfile, updateMe, getUserAvatar, changeUserPassword, banUser, 
  activeUser, deleteUser, followUser, unfollowUser, checkFollowing, updateAvatar }