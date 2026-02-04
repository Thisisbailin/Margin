import { corsHeaders, jsonResponse, requireUser } from "./_auth";

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

export const onRequest = async ({ request, env }: { request: Request; env: Record<string, string> }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  const auth = await requireUser(request, env);
  if ("error" in auth) return auth.error;
  const { userId } = auth;

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return jsonResponse({ error: "Missing Supabase configuration" }, 400);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ error: "Invalid form data" }, 400);
  }

  const type = String(form.get("type") || "");
  const file = form.get("file");
  const bookId = form.get("bookId") ? String(form.get("bookId")) : "";

  if (!(file instanceof File)) {
    return jsonResponse({ error: "Missing file" }, 400);
  }

  if (type !== "epub" && type !== "avatar") {
    return jsonResponse({ error: "Invalid upload type" }, 400);
  }

  if (type === "epub" && !bookId) {
    return jsonResponse({ error: "Missing bookId" }, 400);
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() || "" : "";
  const bucket = type === "avatar" ? "margin_avatars" : "margin_books";

  const objectPath =
    type === "avatar"
      ? `users/${userId}/avatar/${Date.now()}.${ext || "png"}`
      : `users/${userId}/books/${bookId}/${file.name}`;

  const encodedPath = encodePath(objectPath);
  const uploadEndpoint = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/${bucket}/${encodedPath}`;

  try {
    const uploadRes = await fetch(uploadEndpoint, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: await file.arrayBuffer(),
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return jsonResponse({ error: errText || "Upload failed" }, uploadRes.status);
    }

    let publicUrl = "";
    if (type === "avatar") {
      const signEndpoint = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/sign/${bucket}/${encodedPath}`;
      const signRes = await fetch(signEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 365 }),
      });

      if (signRes.ok) {
        const signData = (await signRes.json()) as { signedURL?: string; signedUrl?: string };
        publicUrl = signData.signedURL || signData.signedUrl || "";
      }
    }

    return jsonResponse({ path: objectPath, publicUrl });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Upload failed" }, 500);
  }
};
