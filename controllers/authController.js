import User from "../model/User.js";
import { StatusCodes } from "http-status-codes";
import { OAuth2Client } from "google-auth-library";
import {
  registerUser,
  loginUser,
  getUserIdFromToken,
} from "../services/authService.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

// Register a new user
const register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Register the user in the application
    const user = await registerUser(username, email, password);

    // Create a JWT token for the new user
    const token = user.createJWT();

    // Respond with user details and token
    res.status(StatusCodes.CREATED).json({
      user: {
        username: user.auth_user.username,
        email: user.auth_user.email,
      },
      token,
    });
  } catch (error) {
    console.error(error);
    res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
};

// Login an existing user
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await loginUser(email, password);
    res.status(StatusCodes.OK).json(result);
  } catch (error) {
    console.error(error);
    res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
};

// Handles Google login authentication
const clientId = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const googleAuth = async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "Invalid request" });
  }

  try {
    const response = await clientId.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { email_verified, email, name, picture } = response.payload;

    if (email_verified) {
      // Check if user already exists
      let user = await User.findOne({ "auth_user.email": email });

      // If user doesn't exist, create a new one
      if (!user) {
        const password = email + process.env.JWT_SECRET; // Dummy password for Google auth users
        user = await registerUser(name, email, password);
      }

      // Generate a new JWT token
      const token = jwt.sign(
        { email: user.auth_user.email, userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_LIFETIME }
      );

      res.status(StatusCodes.OK).json({ user, token });
    } else {
      res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ message: "Google authentication failed" });
    }
  } catch (error) {
    console.error("Error with Google authentication:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Error with Google authentication" });
  }
};

// Get user data by ID
const getUserById = async (req, res) => {
  try {
    // Extract user ID from the JWT token
    const user_id = await getUserIdFromToken(req.headers.authorization);

    const user = await User.findById(user_id);
    if (!user) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "User not found" });
    }

    res.status(StatusCodes.OK).json({ user });
  } catch (error) {
    console.error(error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
};

// Update user data
const updateUserData = async (req, res) => {
  const newUserData = req.body;

  try {
    // Extract user ID from the JWT token
    const user_id = await getUserIdFromToken(req.headers.authorization);

    const user = await User.findById(user_id);
    if (!user) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "User not found or unauthorized to update" });
    }

    // Update the user's data
    const updatedUser = await User.findByIdAndUpdate(user_id, newUserData, {
      new: true,
    });

    res.status(StatusCodes.OK).json({ updatedUser });
  } catch (error) {
    console.error(error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
};

export { register, login, googleAuth, getUserById, updateUserData };
