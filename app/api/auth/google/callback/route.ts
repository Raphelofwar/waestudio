import fs from "fs/promises";
import path from "path";

import { google } from "googleapis";
import {
  NextRequest,
  NextResponse,
} from "next/server";

export const runtime = "nodejs";

const GOOGLE_OAUTH_STATE_COOKIE =
  "waestudio_google_oauth_state";

function createGoogleOAuthClient() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID;

  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET;

  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI;

  if (
    !clientId ||
    !clientSecret ||
    !redirectUri
  ) {
    throw new Error(
      "Faltan variables de entorno de Google OAuth."
    );
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
}

async function saveRefreshTokenLocally(
  refreshToken: string
) {
  if (
    process.env.NODE_ENV === "production"
  ) {
    return false;
  }

  const envPath = path.join(
    process.cwd(),
    ".env.local"
  );

  let envContent = "";

  try {
    envContent = await fs.readFile(
      envPath,
      "utf8"
    );
  } catch {
    envContent = "";
  }

  const line =
    `GOOGLE_REFRESH_TOKEN=${refreshToken}`;

  if (
    /^GOOGLE_REFRESH_TOKEN=.*$/m.test(
      envContent
    )
  ) {
    envContent = envContent.replace(
      /^GOOGLE_REFRESH_TOKEN=.*$/m,
      line
    );
  } else {
    envContent =
      `${envContent.trimEnd()}\n${line}\n`;
  }

  await fs.writeFile(
    envPath,
    envContent,
    "utf8"
  );

  return true;
}

function successPage(
  savedLocally: boolean
) {
  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <title>WAESTUDIO · Google Calendar</title>
      </head>

      <body
        style="
          margin:0;
          min-height:100vh;
          display:flex;
          align-items:center;
          justify-content:center;
          background:#090909;
          color:#f5f1e8;
          font-family:Arial,sans-serif;
          padding:24px;
          box-sizing:border-box;
        "
      >
        <div
          style="
            width:100%;
            max-width:420px;
            border:1px solid rgba(255,255,255,.10);
            border-radius:28px;
            padding:28px;
            background:#111111;
          "
        >
          <div
            style="
              width:54px;
              height:54px;
              border-radius:50%;
              display:flex;
              align-items:center;
              justify-content:center;
              border:1px solid rgba(197,166,109,.45);
              background:rgba(197,166,109,.10);
              color:#c5a66d;
              font-size:24px;
              margin-bottom:24px;
            "
          >
            ✓
          </div>

          <p
            style="
              margin:0 0 10px;
              color:#c5a66d;
              font-size:11px;
              letter-spacing:.22em;
              text-transform:uppercase;
            "
          >
            WAESTUDIO
          </p>

          <h1
            style="
              margin:0;
              font-size:30px;
              line-height:1.1;
              font-weight:600;
            "
          >
            Google Calendar conectado
          </h1>

          <p
            style="
              margin:18px 0 0;
              color:rgba(245,241,232,.55);
              line-height:1.6;
              font-size:14px;
            "
          >
            ${
              savedLocally
                ? "El refresh token fue guardado automáticamente en tu archivo .env.local."
                : "La autorización fue completada."
            }
          </p>

          <p
            style="
              margin:18px 0 0;
              color:rgba(245,241,232,.35);
              line-height:1.6;
              font-size:12px;
            "
          >
            Ya puedes cerrar esta pestaña y volver a VS Code.
          </p>
        </div>
      </body>
    </html>
  `;
}

export async function GET(
  request: NextRequest
) {
  try {
    const code =
      request.nextUrl.searchParams.get(
        "code"
      );

    const returnedState =
      request.nextUrl.searchParams.get(
        "state"
      );

    const oauthError =
      request.nextUrl.searchParams.get(
        "error"
      );

    const storedState =
      request.cookies.get(
        GOOGLE_OAUTH_STATE_COOKIE
      )?.value;

    if (oauthError) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Google no autorizó el acceso.",
          error: oauthError,
        },
        {
          status: 400,
        }
      );
    }

    if (!code) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Google no devolvió un código de autorización.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !returnedState ||
      !storedState ||
      returnedState !== storedState
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "La validación de seguridad OAuth falló.",
        },
        {
          status: 400,
        }
      );
    }

    const oauth2Client =
      createGoogleOAuthClient();

    const {
      tokens,
    } =
      await oauth2Client.getToken(
        code
      );

    if (!tokens.refresh_token) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Google no devolvió un refresh token. Vuelve a iniciar la autorización.",
        },
        {
          status: 400,
        }
      );
    }

    const savedLocally =
      await saveRefreshTokenLocally(
        tokens.refresh_token
      );

    const response =
      new NextResponse(
        successPage(savedLocally),
        {
          status: 200,
          headers: {
            "Content-Type":
              "text/html; charset=utf-8",
          },
        }
      );

    response.cookies.set(
      GOOGLE_OAUTH_STATE_COOKIE,
      "",
      {
        httpOnly: true,
        sameSite: "lax",
        secure:
          process.env.NODE_ENV ===
          "production",
        path: "/",
        maxAge: 0,
      }
    );

    return response;
  } catch (error) {
    console.error(
      "Google OAuth callback error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "No fue posible completar la conexión con Google Calendar.",
      },
      {
        status: 500,
      }
    );
  }
}