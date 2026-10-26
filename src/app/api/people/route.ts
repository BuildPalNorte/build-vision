import { cursorSchema, enrollmentInputSchema } from "@/lib/contracts";
import { listPeople, registerPerson } from "@/lib/server/faces";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { readUpload, validateImage } from "@/lib/server/images";
import { getFaceContext } from "@/lib/server/viso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const cursor = cursorSchema.parse(new URL(request.url).searchParams.get("cursor") ?? undefined);
    const context = getFaceContext();
    return jsonResponse(await listPeople(context, cursor));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = getFaceContext();
    const form = await readUpload(request);
    const input = enrollmentInputSchema.parse({
      name: form.get("name") ?? undefined,
      consent: form.get("consent") ?? undefined,
    });
    const image = await validateImage(form.get("image"));
    const person = await registerPerson(context, { image, name: input.name });
    return jsonResponse({ person }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
