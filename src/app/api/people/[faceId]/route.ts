import { faceIdSchema } from "@/lib/contracts";
import { deletePerson } from "@/lib/server/faces";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { getFaceContext } from "@/lib/server/viso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ faceId: string }> },
) {
  try {
    const { faceId } = await params;
    const id = faceIdSchema.parse(faceId);
    const context = getFaceContext();
    return jsonResponse(await deletePerson(context, id));
  } catch (error) {
    return errorResponse(error, "face");
  }
}
