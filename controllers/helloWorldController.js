import { StatusCodes } from "http-status-codes";
import dotenv from "dotenv";
dotenv.config();

// sendMessage
const doSomeThing = async (req, res) => {
  const user = req.user;

  const response = {
    user: user,
    message: "Hello World!",
  };
  res.status(StatusCodes.OK).json(response);
};

export { doSomeThing };
