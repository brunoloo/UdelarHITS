import { registerUserService, loginUserService, getUsersService, createUserByAdminService,
    getUserProfileService
 } from '../services/user.service.js';

const getMe = async (req, res) => {
  console.log('req.user =>', req.user);
  return res.status(200).json({
    ok: true,
    data: { user: { id: req.user.id } }
  });
};

const registerUser = async (req, res) => {
  try {
    const result = await registerUserService(req.body);
    return res.status(201).json({
        ok: true,
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
        nickname: result.nickname,
        nombre: result.nombre,
        email: result.email,
        rol: result.rol
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

const updateUserProfile = async (req, res) => {}

const changeUserPassword = async (req, res) => {}

export { getMe, registerUser, loginUser, logoutUser, getUsers, getUserProfile, 
    updateUserProfile, changeUserPassword }