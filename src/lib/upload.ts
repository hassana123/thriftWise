import { getSupabaseMode } from "@/lib/supabase/config";

const BUCKET = "receipts";

export async function uploadReceipt(
  file: File,
  memberId: string,
  weekId: string
): Promise<string> {
  if (getSupabaseMode() === "supabase") {
    const { getSupabaseClient } = await import("@/lib/supabase/client");
    const sb = getSupabaseClient();
    const path = `${memberId}/${weekId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    await sb.storage.from(BUCKET).upload(path, file, { upsert: true });
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }
  return URL.createObjectURL(file);
}

export async function deleteReceipt(receiptUrl: string): Promise<void> {
  if (getSupabaseMode() !== "supabase") return;
  if (!receiptUrl || receiptUrl.startsWith("blob:")) return;
  try {
    const { getSupabaseClient } = await import("@/lib/supabase/client");
    const sb = getSupabaseClient();
    const url = new URL(receiptUrl);
    const marker = "/object/public/";
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return;
    const path = url.pathname.slice(idx + marker.length);
    await sb.storage.from(BUCKET).remove([path]);
  } catch {
    /* best effort */
  }
}
