import { Router, type IRouter } from "express";
import couplesRouter from "./couples";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(couplesRouter);

export default router;
