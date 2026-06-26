import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import stripeRouter from "./stripe";
import resumesRouter from "./resumes";
import tailoredRouter from "./tailored";
import aiRouter from "./ai";
import jobsRouter from "./jobs";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(stripeRouter);
router.use(resumesRouter);
router.use(tailoredRouter);
router.use(aiRouter);
router.use(jobsRouter);
router.use(statsRouter);

export default router;
