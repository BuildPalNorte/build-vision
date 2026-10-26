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
    // Only the image is read. Collection, threshold and other options are server-owned.
    const image = await validateImage(form.get("image"));
    return jsonResponse(await recognizeFaces(context, image));
  } catch (error) {
    return errorResponse(error);
  }
}
