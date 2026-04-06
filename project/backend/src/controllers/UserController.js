const registerUser = async (req, res) => {
    const body = req.body;
    
    res.json({ message: 'User registered successfully' });
}

const loginUser = async (req, res) => {}

const getUserProfile = async (req, res) => {
    res.json({
        username: 'testuser',
        email: 'testuser@example.com'
    });
}

const updateUserProfile = async (req, res) => {}

const changeUserPassword = async (req, res) => {}

export{registerUser, loginUser, getUserProfile, 
    updateUserProfile, changeUserPassword}