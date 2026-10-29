"use server";

import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { getDb } from "@/lib/mongodb";
import { documentTypesSchema, saveRegistrationDocumentTypes } from "@/lib/registration-documents";

export interface DocumentTypesState {
  ok?: boolean;
  error?: string;
}

export async function saveDocumentTypes(_prev: DocumentTypesState, form: FormData): Promise<DocumentTypesState> {
  const user = await getCurrentUser();
  if (!user || user.scope !== "system" || user.access.level !== "allowed") {
    return { error: "Only the system administrator can change registration document types." };
  }

  let value: unknown;
  try {
    value = JSON.parse(String(form.get("documentTypes") ?? ""));
  } catch {
    return { error: "The document type list is not valid JSON." };
  }
  const parsed = documentTypesSchema.safeParse(value);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the document types and try again." };

  const configuredKeys = new Set(parsed.data.map((type) => type.key));
  const storedKeys = await (await getDb()).collection("registrations").distinct<string>("documents.docType", { documents: { $exists: true } });
  if (storedKeys.some((key) => !configuredKeys.has(key))) {
    return { error: "A document type already used by a registration cannot be removed. You can make it optional or change its label instead." };
  }

  await saveRegistrationDocumentTypes(parsed.data);
  await writeAudit({
    userId: new ObjectId(user.id), userName: user.name, headOfficeId: null, officeId: null,
    action: "registration.document_types.update", summary: `Updated registration document types (${parsed.data.length} types)`,
    entity: "setting", entityId: "registration_document_types",
  });
  revalidatePath("/signup");
  revalidatePath("/dashboard/registrations", "layout");
  return { ok: true };
}
