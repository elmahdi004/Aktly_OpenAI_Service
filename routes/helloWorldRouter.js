import express from "express";
import { authenticateUser } from "../middleware/authMiddleware.js";
import { doSomeThing } from "../controllers/helloWorldController.js";

const router = express.Router();

router.route("/do").post(authenticateUser, doSomeThing);

export default router;
