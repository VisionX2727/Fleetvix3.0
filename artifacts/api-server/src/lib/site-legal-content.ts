import { eq } from "drizzle-orm";
import type { SiteContent, SiteContentInput } from "@workspace/api-zod";
import { db, siteLegalSettings, type SiteLegalSettings } from "@workspace/db";
import { DEFAULT_PRIVACY_CONTENT, DEFAULT_TERMS_CONTENT } from "./site-legal-defaults";

const GLOBAL_SITE_CONTENT_ID = "fleetvix";
const initialPolicyDate = new Date("2026-10-04T00:00:00.000Z");

type StoredSiteContent = Omit<SiteContent, "termsUpdatedAt" | "privacyUpdatedAt" | "updatedAt"> & {
  termsUpdatedAt: Date;
  privacyUpdatedAt: Date;
  updatedAt: Date;
};

function toSiteContent(row: StoredSiteContent | SiteLegalSettings): SiteContent {
  return {
    termsContent: row.termsContent,
    privacyContent: row.privacyContent,
    legalName: row.legalName,
    businessAddress: row.businessAddress,
    supportEmail: row.supportEmail,
    privacyEmail: row.privacyEmail,
    supportPhone: row.supportPhone,
    termsUpdatedAt: row.termsUpdatedAt,
    privacyUpdatedAt: row.privacyUpdatedAt,
    updatedAt: row.updatedAt,
  };
}

export async function getSiteLegalContent(): Promise<SiteContent> {
  const [row] = await db
    .select()
    .from(siteLegalSettings)
    .where(eq(siteLegalSettings.id, GLOBAL_SITE_CONTENT_ID))
    .limit(1);

  if (row) return toSiteContent(row);

  return {
    termsContent: DEFAULT_TERMS_CONTENT,
    privacyContent: DEFAULT_PRIVACY_CONTENT,
    legalName: "",
    businessAddress: "",
    supportEmail: "",
    privacyEmail: "",
    supportPhone: "",
    termsUpdatedAt: initialPolicyDate,
    privacyUpdatedAt: initialPolicyDate,
    updatedAt: initialPolicyDate,
  };
}

export async function saveSiteLegalContent(input: SiteContentInput): Promise<SiteContent> {
  const [existing] = await db
    .select()
    .from(siteLegalSettings)
    .where(eq(siteLegalSettings.id, GLOBAL_SITE_CONTENT_ID))
    .limit(1);
  const now = new Date();
  const [saved] = await db
    .insert(siteLegalSettings)
    .values({
      id: GLOBAL_SITE_CONTENT_ID,
      ...input,
      termsUpdatedAt: existing && existing.termsContent === input.termsContent ? existing.termsUpdatedAt : now,
      privacyUpdatedAt: existing && existing.privacyContent === input.privacyContent ? existing.privacyUpdatedAt : now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: siteLegalSettings.id,
      set: {
        ...input,
        termsUpdatedAt: existing && existing.termsContent === input.termsContent ? existing.termsUpdatedAt : now,
        privacyUpdatedAt: existing && existing.privacyContent === input.privacyContent ? existing.privacyUpdatedAt : now,
        updatedAt: now,
      },
    })
    .returning();

  return toSiteContent(saved);
}