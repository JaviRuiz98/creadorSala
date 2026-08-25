import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

interface CreateUserPayload {
  full_name: string;
  username: string;
  password: string;
  role: "ADMIN" | "USER";
  admin_password: string;
}

const INTERNAL_AUTH_DOMAIN = "usuarios.salachocolatte.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "");
}

function validUsername(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);
}

function humanizeAuthError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("already registered") || text.includes("already exists") || text.includes("duplicate")) {
    return "Ese nombre de usuario ya existe.";
  }
  if (text.includes("invalid email") || text.includes("unable to validate email address") || text.includes("invalid format")) {
    return "No se pudo generar el identificador interno del usuario.";
  }
  if (text.includes("password") && (text.includes("6") || text.includes("short"))) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  return message;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Método no permitido." }, 405);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "No se recibió autenticación." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Configuración interna de Supabase incompleta." }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse(
        { error: "La sesión no es válida. Cierra sesión y vuelve a entrar.", detail: userError?.message },
        401,
      );
    }

    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return jsonResponse({ error: "No se pudo consultar el perfil del administrador.", detail: profileError.message }, 500);
    }

    if (profile?.role !== "ADMIN") {
      return jsonResponse({ error: "Solo un ADMIN puede crear usuarios." }, 403);
    }

    const body = (await req.json()) as CreateUserPayload;
    const fullName = body.full_name?.trim();
    const username = normalizeUsername(body.username ?? "");
    const password = body.password;
    const role = body.role;
    const adminPassword = body.admin_password;

    if (!fullName || !username || !password || !role || !adminPassword) {
      return jsonResponse({ error: "Completa todos los campos obligatorios." }, 400);
    }

    if (!validUsername(username)) {
      return jsonResponse(
        { error: "El nombre de usuario debe tener entre 3 y 32 caracteres y solo puede contener letras, números, punto, guion o guion bajo." },
        400,
      );
    }

    if (role !== "ADMIN" && role !== "USER") {
      return jsonResponse({ error: "Rol no válido." }, 400);
    }

    if (password.length < 6) {
      return jsonResponse({ error: "La contraseña debe tener al menos 6 caracteres." }, 400);
    }

    const { data: passwordOk, error: passwordError } = await userClient.rpc("verify_app_secret", {
      p_key: "user_management",
      p_secret: adminPassword,
    });

    if (passwordError) {
      return jsonResponse(
        { error: "No se pudo verificar la contraseña de administración.", detail: passwordError.message },
        500,
      );
    }

    if (passwordOk !== true) {
      return jsonResponse({ error: "La contraseña de administración es incorrecta." }, 403);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existingProfile) {
      return jsonResponse({ error: "Ese nombre de usuario ya existe." }, 409);
    }

    const internalEmail = `${username}@${INTERNAL_AUTH_DOMAIN}`;

    const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        username,
      },
    });

    if (createError || !createdUser.user) {
      return jsonResponse(
        { error: humanizeAuthError(createError?.message ?? "No se pudo crear el usuario.") },
        400,
      );
    }

    const newUserId = createdUser.user.id;
    const { error: roleError } = await adminClient
      .from("profiles")
      .update({ full_name: fullName, username, role })
      .eq("id", newUserId);

    if (roleError) {
      await adminClient.auth.admin.deleteUser(newUserId);
      return jsonResponse(
        { error: "No se pudo guardar el perfil del nuevo usuario.", detail: roleError.message },
        500,
      );
    }

    return jsonResponse({
      success: true,
      user: { id: newUserId, username, full_name: fullName, role },
    });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      {
        error: "Se produjo un error interno al crear el usuario.",
        detail: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
