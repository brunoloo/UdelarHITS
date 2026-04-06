import { registerUserService, loginUserService } from '../services/user.service.js';

const registerUser = async (req, res) => {
  try {
    const result = await registerUserService(req.body);
    return res.status(201).json({
        status: 'ok',
        data: {
            id: result.id,
            nickname: result.nickname,
            nombre: result.nombre,
            email: result.email
        }
    })
  } catch (error) {
    if (error.code === 'USER_EXISTS') {
      return res.status(409).json({ ok: false, message: error.message });
    }
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const loginUser = async (req, res) => {
    try {
    const result = await loginUserService(req.body);
    return res.status(200).json({ ok: true, user: result.user });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'INVALID_CREDENTIALS') return res.status(401).json({ ok: false, message: 'Credenciales inválidas' });
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: 'Usuario baneado' });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
}

const getUserProfile = async (req, res) => {}

const updateUserProfile = async (req, res) => {}

const changeUserPassword = async (req, res) => {}

export{registerUser, loginUser, getUserProfile, 
    updateUserProfile, changeUserPassword}