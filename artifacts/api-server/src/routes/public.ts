import { Router, type IRouter } from "express";
import { GetPublicLegalContentResponse } from "@workspace/api-zod";
import { getSiteLegalContent } from "../lib/site-legal-content";

const router: IRouter = Router();

router.get("/legal", async (_req, res): Promise<void> => {
  const response = GetPublicLegalContentResponse.parse({ content: await getSiteLegalContent() });
  res.json(response);
});

export default router;