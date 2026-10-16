import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, supportTickets } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();
router.use(requireAuth);

const ticketCategories = new Set([
  "Report a Problem",
  "Payment/Subscription Issue",
  "Login/Account Issue",
  "Vehicle/Driver Issue",
  "Attendance Issue",
  "Work Log Issue",
  "Receipt/Report Issue",
  "Other",
]);
const ticketPriorities = new Set(["Low", "Medium", "High"]);
const maxAttachmentBytes = 5 * 1024 * 1024;
const supportBucket = "fleet-manager-support";
let supportBucketReady: Promise<void> | null = null;

function ticketId() {
  return `ticket_${crypto.randomUUID()}`;
}

function storageConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase Storage is not configured");
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ""), serviceRoleKey };
}

async function ensureSupportBucket() {
  if (supportBucketReady) return supportBucketReady;
  supportBucketReady = (async () => {
    const { supabaseUrl, serviceRoleKey } = storageConfig();
    const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: supportBucket,
        name: supportBucket,
        public: false,
        file_size_limit: maxAttachmentBytes,
        allowed_mime_types: ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"],
      }),
    });
    if (!response.ok && response.status !== 400 && response.status !== 409) {
      throw new Error("Could not prepare Supabase support storage");
    }
  })().catch((error) => {
    supportBucketReady = null;
    throw error;
  });
  return supportBucketReady;
}

async function uploadAttachment(dataUrl: string, userId: string, filename: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Attachment format is invalid");
  const [, contentType, encoded] = match;
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.byteLength > maxAttachmentBytes) throw new Error("Attachments must be 5 MB or smaller");
  const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);
  if (!allowed.has(contentType)) throw new Error("Only images and PDF attachments are supported");
  await ensureSupportBucket();
  const { supabaseUrl, serviceRoleKey } = storageConfig();
  const extension = filename.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${supportBucket}/${path}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": contentType,
      "x-upsert": "false",
    },
    body: bytes,
  });
  if (!response.ok) throw new Error("Could not upload the support attachment");
  return path;
}

export async function signedAttachmentUrl(path: string | null) {
  if (!path) return null;
  const { supabaseUrl, serviceRoleKey } = storageConfig();
  const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/${supportBucket}/${path}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { signedURL?: string };
  return payload.signedURL ? `${supabaseUrl}/storage/v1${payload.signedURL}` : null;
}

function publicTicket(ticket: typeof supportTickets.$inferSelect, attachmentUrl: string | null) {
  return {
    ...ticket,
    attachmentUrl,
    attachmentPath: undefined,
  };
}

router.get("/", async (req, res) => {
  const rows = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, req.authUserId!))
    .orderBy(desc(supportTickets.createdAt));
  const tickets = await Promise.all(rows.map(async (ticket) => publicTicket(ticket, await signedAttachmentUrl(ticket.attachmentPath))));
  res.json({ tickets });
});

router.post("/", async (req, res) => {
  const category = String(req.body?.category || "");
  const subject = String(req.body?.subject || "").trim();
  const description = String(req.body?.description || "").trim();
  const priority = ticketPriorities.has(req.body?.priority) ? String(req.body.priority) : "Medium";
  if (!ticketCategories.has(category)) {
    res.status(400).json({ error: "Choose a valid support category" });
    return;
  }
  if (!subject || subject.length > 160 || !description || description.length > 5000) {
    res.status(400).json({ error: "Add a subject and a description under the allowed length" });
    return;
  }
  try {
    const attachmentPath = req.body?.attachmentDataUrl
      ? await uploadAttachment(String(req.body.attachmentDataUrl), req.authUserId!, String(req.body.attachmentName || "attachment"))
      : null;
    const created = await db.insert(supportTickets).values({
      id: ticketId(),
      userId: req.authUserId!,
      userEmail: req.authUserEmail || "unknown",
      userName: req.authUserName || null,
      category,
      subject,
      description,
      attachmentPath,
      attachmentName: req.body?.attachmentName ? String(req.body.attachmentName).slice(0, 180) : null,
      priority,
      status: "Open",
      updatedAt: new Date(),
    }).returning();
    res.status(201).json({ ticket: publicTicket(created[0], await signedAttachmentUrl(attachmentPath)) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not submit support request" });
  }
});

export default router;