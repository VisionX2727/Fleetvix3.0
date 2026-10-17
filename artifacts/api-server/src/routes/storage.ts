import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { Router, type IRouter } from "express";
import { requireAuth } from "../lib/auth";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();
const maxFileBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

router.post("/storage/uploads/request-url", requireAuth, async (req, res) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a valid file smaller than 10 MB." });
    return;
  }
  if (parsed.data.size > maxFileBytes || !allowedMimeTypes.has(parsed.data.contentType)) {
    res.status(400).json({ error: "Only images, PDF, Word and Excel files up to 10 MB are supported." });
    return;
  }

  try {
    const uploadURL = await objectStorage.getObjectEntityUploadURL();
    const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
    res.json(RequestUploadUrlResponse.parse({ uploadURL, objectPath }));
  } catch (error) {
    req.log.error({ err: error, userId: req.authUserId }, "Could not create private file upload URL");
    res.status(500).json({ error: "File storage is unavailable. Please try again." });
  }
});

export default router;
