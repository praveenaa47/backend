const User = require('./userModel');
const bcrypt = require('bcrypt');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenUtils');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Register User
exports.registerUser = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create new user
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
        });

        await newUser.save();

        // Generate tokens
        const payload = { id: newUser._id, role: newUser.role };
        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);

        return res.status(201).json({
            message: 'User registered successfully',
            user: {
                userId: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
            },
            accessToken,
            refreshToken,
        });

    } catch (error) {
        console.error('Registration Error:', error);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Login User
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if user has password (not Google-only user)
        if (!user.password) {
            return res.status(401).json({ message: "Please use Google login for this account" });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid password" });
        }

        // Generate tokens
        const payload = { id: user._id, role: user.role };
        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);

        return res.status(200).json({
            message: "Login successful",
            user: {
                userId: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
            accessToken,
            refreshToken,
        });

    } catch (error) {
        console.error("Login Error:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Google Login Callback
exports.googleLoginCallback = (req, res, next) => {
    passport.authenticate('google', { session: false }, async (err, user, info) => {
        if (err) {
            return res.status(500).json({ message: 'Authentication failed', error: err.message });
        }
        if (!user) {
            return res.status(401).json({ message: 'Google authentication failed' });
        }

        try {
            // Generate tokens
            const payload = { id: user._id, role: user.role };
            const accessToken = generateAccessToken(payload);
            const refreshToken = generateRefreshToken(payload);

            res.status(200).json({
                message: 'Google login successful',
                user: {
                    userId: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    profilePicture: user.profilePicture,
                },
                accessToken,
                refreshToken,
            });
        } catch (error) {
            console.error("Google Login Error:", error);
            res.status(500).json({ message: 'Server error', error: error.message });
        }
    })(req, res, next);
};

// Web Google Login (Token-based)
exports.googleLoginWeb = async (req, res) => {
    const { idToken } = req.body;

    try {
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        let user = await User.findOne({ 
            $or: [
                { googleId },
                { email }
            ]
        });

        if (!user) {
            // Create new user
            user = await User.create({
                googleId,
                name,
                email,
                profilePicture: picture
            });
        } else if (!user.googleId) {
            // Link existing email account with Google
            user.googleId = googleId;
            user.profilePicture = picture;
            await user.save();
        }

        // Generate tokens
        const tokenPayload = { id: user._id, role: user.role };
        const accessToken = generateAccessToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);

        res.status(200).json({
            message: 'Google login successful',
            user: {
                userId: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                profilePicture: user.profilePicture,
            },
            accessToken,
            refreshToken,
        });
    } catch (error) {
        console.error("Google Login Error:", error);
        res.status(401).json({ message: 'Invalid Google ID token', error: error.message });
    }
};