import { getUserIdFromToken } from "../services/authService.js";
import { StatusCodes } from "http-status-codes";

const authenticateUser = async (req, res, next) => {
  const authorization = req.headers.authorization;

  try {
    req.user = await getUserIdFromToken(authorization);
    next();
  } catch (error) {
    console.error(error);
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: error.message });
  }
};

export { authenticateUser };
