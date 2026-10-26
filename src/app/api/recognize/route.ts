import { detectObjectsSchema } from "@/lib/contracts";
import { recognizeFaces } from "@/lib/server/faces";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { readUpload, validateImage } from "@/lib/server/images";
import { getFaceContext } from "@/lib/server/viso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const context = getFaceContext();
    const form = await readUpload(request);
    // Only the image and the opt-in objects flag are read. Collection, threshold, prompts
    // and targets are server-owned.
    const detectObjects = detectObjectsSchema.parse(form.get("objects") ?? undefined) === "true";
    const image = await validateImage(form.get("image"));
    return jsonResponse(await recognizeFaces(context, image, { detectObjects }));
  } catch (error) {
    return errorResponse(error);
  }
}
