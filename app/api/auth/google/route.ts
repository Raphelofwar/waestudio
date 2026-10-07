import { randomBytes } from "crypto";

import { google } from "googleapis";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GOOGLE_OAUTH_STATE_COOKIE =
  "waestudio_google_oauth_state";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

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

export async function GET() {
  try {
    const oauth2Client =
      createGoogleOAuthClient();

    const state = randomBytes(
      32
    ).toString("hex");

    const authorizationUrl =
      oauth2Client.generateAuthUrl({
        access_type: "offline",

        prompt: "consent",

        include_granted_scopes: true,

        scope: GOOGLE_SCOPES,

        state,
      });

    const response =
      NextResponse.redirect(
        authorizationUrl
      );

    response.cookies.set(
      GOOGLE_OAUTH_STATE_COOKIE,
      state,
      {
        httpOnly: true,
        sameSite: "lax",
        secure:
          process.env.NODE_ENV ===
          "production",
        path: "/",
        maxAge: 10 * 60,
      }
    );

    return response;
  } catch (error) {
    console.error(
      "Google OAuth start error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "No fue posible iniciar la conexión con Google Calendar.",
      },
      {
        status: 500,
      }
    );
  }
}