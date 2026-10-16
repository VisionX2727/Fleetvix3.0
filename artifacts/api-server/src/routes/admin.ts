import { Router, type IRouter } from "express";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import {
  GetAdminSiteContentResponse,
  UpdateAdminSiteContentBody,
  UpdateAdminSiteContentResponse,
} from "@workspace/api-zod";
import { db, fleetMembers, fleetWorkspaces, supportTickets } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { requireAdmin } from "../lib/admin";
import { getSiteLegalContent, saveSiteLegalContent } from "../lib/site-legal-content";
import { signedAttachmentUrl } from "./support";

const router: IRouter = Router();
router.use(requireAuth, requireAdmin);

router.get("/", async (_req, res) => {
  const [[owners], [drivers], [tickets], [open], [high]] = await Promise.all([
    db.select({ value: count() }).from(fleetWorkspaces),
    db.select({ value: count() }).from(fleetMembers),
    db.select({ value: count() }).from(supportTickets),
    db.select({ value: count() }).from(supportTickets).where(or(eq(supportTickets.status, "Open"), eq(supportTickets.status, "In Progress"))),
    db.select({ value: count() }).from(supportTickets).where(and(eq(supportTickets.priority, "High"), eq(supportTickets.status, "Open"))),
  ]);
  res.json({
    stats: {
      totalUsers: Number(owners.value) + Number(drivers.value),
      totalOwners: Number(owners.value),
      totalDrivers: Number(drivers.value),
      activeSubscriptions: 0,
      expiredSubscriptions: 0,
      openSupportTickets: Number(open.value),
      highPriorityTickets: Number(high.value),
      totalTickets: Number(tickets.value),
    },
  });
});

router.get("/site-content", async (_req, res): Promise<void> => {
  const response = GetAdminSiteContentResponse.parse({ content: await getSiteLegalContent() });
  res.json(response);
});

router.put("/site-content", async (req, res): Promise<void> => {
  const parsed = UpdateAdminSiteContentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const [label, value] of [
    ["Support email", parsed.data.supportEmail],
    ["Privacy email", parsed.data.privacyEmail],
  ] as const) {
    if (value && !emailPattern.test(value)) {
      res.status(400).json({ error: `${label} must be a valid email address or left blank.` });
      return;
    }
  }

  const response = UpdateAdminSiteContentResponse.parse({
    content: await saveSiteLegalContent(parsed.data),
  });
  res.json(response);
});

router.get("/tickets", async (req, res) => {
  const search = String(req.query.search || "").trim();
  const status = String(req.query.status || "");
  const priority = String(req.query.priority || "");
  const category = String(req.query.category || "");
  const filters = [];
  if (search) filters.push(or(
    ilike(supportTickets.id, `%${search}%`),
    ilike(supportTickets.userName, `%${search}%`),
    ilike(supportTickets.userEmail, `%${search}%`),
    ilike(supportTickets.subject, `%${search}%`),
  ));
  if (status) filters.push(eq(supportTickets.status, status));
  if (priority) filters.push(eq(supportTickets.priority, priority));
  if (category) filters.push(eq(supportTickets.category, category));
  const rows = await db.select().from(supportTickets)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(supportTickets.createdAt))
    .limit(100);
  const ticketRows = await Promise.all(rows.map(async (ticket) => ({
    ...ticket,
    attachmentUrl: await signedAttachmentUrl(ticket.attachmentPath),
    attachmentPath: undefined,
  })));
  res.json({ tickets: ticketRows });
});

router.patch("/tickets/:ticketId", async (req, res) => {
  const status = ["Open", "In Progress", "Resolved", "Closed"].includes(req.body?.status) ? String(req.body.status) : undefined;
  const priority = ["Low", "Medium", "High"].includes(req.body?.priority) ? String(req.body.priority) : undefined;
  const adminReply = req.body?.adminReply === undefined ? undefined : String(req.body.adminReply).slice(0, 5000);
  if (!status && !priority && adminReply === undefined) {
    res.status(400).json({ error: "No ticket changes supplied" });
    return;
  }
  const updated = await db.update(supportTickets)
    .set({
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(adminReply !== undefined ? { adminReply } : {}),
      ...(status === "Resolved" || status === "Closed" ? { resolvedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(supportTickets.id, req.params.ticketId))
    .returning();
  if (!updated[0]) {
    res.status(404).json({ error: "Support ticket not found" });
    return;
  }
  res.json({ ticket: { ...updated[0], attachmentUrl: await signedAttachmentUrl(updated[0].attachmentPath), attachmentPath: undefined } });
});

export default router;