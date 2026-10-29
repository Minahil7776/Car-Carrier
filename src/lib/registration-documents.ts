import "server-only";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "./mongodb";
import { DOCUMENT_TYPES, type DocumentType } from "./signup-config";

const typeSchema = z.object({
  key: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,39}$/, "Use 2 to 40 lowercase letters, numbers, underscores, or hyphens."),
  label: z.string().trim().min(2, "Enter a document name.").max(80, "Keep document names under 80 characters."),
  hint: z.string().trim().max(160, "Keep hints under 160 characters.").optional(),
  required: z.boolean(),
});

export const documentTypesSchema = z.array(typeSchema).min(1, "Keep at least one document type.").max(30, "You can configure up to 30 document types.")
  .refine((types) => new Set(types.map((type) => type.key)).size === types.length, "Document keys must be unique.");

const SETTING_ID = new ObjectId("6a7c43e0d034b0a07e3f2101");

export async function getRegistrationDocumentTypes(): Promise<DocumentType[]> {
  const setting = await (await getDb()).collection<{ documentTypes: unknown }>("system_settings").findOne({ _id: SETTING_ID });
  if (!setting) return DOCUMENT_TYPES;

  const parsed = documentTypesSchema.safeParse(setting.documentTypes);
  if (!parsed.success) throw new Error("The configured registration document types are invalid.");
  return parsed.data;
}

export async function saveRegistrationDocumentTypes(documentTypes: DocumentType[]) {
  await (await getDb()).collection<{ documentTypes: DocumentType[]; updatedAt: Date }>("system_settings").updateOne(
    { _id: SETTING_ID },
    { $set: { documentTypes, updatedAt: new Date() } },
    { upsert: true },
  );
}
