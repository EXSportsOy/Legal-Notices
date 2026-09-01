// ============================================================================
//  Edge Function: notify-feedback
//  Sends an email when a new row is inserted into public.feedback.
//  Triggered by a database trigger (supabase/webhook_trigger.sql).
//  Email is sent via Proton Mail SMTP submission (custom domain, no extra
//  provider account needed).
//
//  Secrets (Supabase → Edge Functions → Secrets):
//    SMTP_HOST          smtp.protonmail.ch
//    SMTP_PORT          587 (STARTTLS)
//    SMTP_USERNAME      the Proton address the token was generated for
//    SMTP_PASSWORD      Proton SMTP submission token
//    NOTIFY_EMAIL_TO    where notifications go, e.g. info@exsports.fi
//    NOTIFY_EMAIL_FROM  sender, must match the token's address
//    WEBHOOK_SECRET     shared secret checked against x-webhook-secret
// ============================================================================

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get("WEBHOOK_SECRET");
    if (secret && req.headers.get("x-webhook-secret") !== secret) {
      return new Response("Unauthorized", { status: 401 });
    }

    const payload = await req.json();
    const row = payload.record ?? payload;

    const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "smtp.protonmail.ch";
    const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "587");
    const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME");
    const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");
    const TO = Deno.env.get("NOTIFY_EMAIL_TO");
    const FROM = Deno.env.get("NOTIFY_EMAIL_FROM");
    if (!SMTP_USERNAME || !SMTP_PASSWORD || !TO || !FROM) {
      console.error("Missing env vars (SMTP_USERNAME / SMTP_PASSWORD / NOTIFY_EMAIL_TO / NOTIFY_EMAIL_FROM).");
      return new Response("Missing config", { status: 500 });
    }

    const kinds: Record<string, string> = {
      website: "Website feedback",
      program_general: "App feedback (quick)",
      program_bug: "Bug report",
    };
    const apps: Record<string, string> = {
      website: "Website", surveytools: "SurveyTools", heda: "Heda", shodia: "Shodia",
    };
    const esc = (s: unknown) =>
      String(s ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

    const kind = kinds[row.category] ?? row.category;
    const appName = apps[row.app] ?? row.app;
    const rows: string[] = [];
    const add = (k: string, v: unknown) => {
      if (v !== null && v !== undefined && String(v).trim() !== "")
        rows.push(`<tr><td style="padding:4px 12px 4px 0;color:#86988F;vertical-align:top">${k}</td><td style="padding:4px 0">${esc(v)}</td></tr>`);
    };

    add("Type", kind);
    add("App", appName);
    add("Title", row.bug_title);
    add("Severity", row.severity);
    if (row.rating) add("Rating", "★".repeat(row.rating) + "☆".repeat(5 - row.rating));
    add("Message", row.message);
    add("Steps", row.steps);
    add("Expected", row.expected);
    add("Actual", row.actual);
    add("Environment", row.environment);
    add("Email", row.email);
    add("Language", row.lang);
    add("Page", row.page_url);
    add("Browser", row.user_agent);
    add("Time", row.created_at);

    const subject = `[Feedback] ${appName} — ${kind}${row.bug_title ? `: ${row.bug_title}` : ""}`;
    const html = `
      <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:640px">
        <h2 style="margin:0 0 12px">${esc(subject)}</h2>
        <table style="border-collapse:collapse;font-size:14px">${rows.join("")}</table>
        <p style="color:#9aa3af;font-size:12px;margin-top:16px">Sent automatically from a Supabase Edge Function.</p>
      </div>`;

    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: false, // port 587: plain connect, then STARTTLS
        auth: { username: SMTP_USERNAME, password: SMTP_PASSWORD },
      },
    });

    try {
      await client.send({
        from: FROM,
        to: TO.split(",").map((s) => s.trim()),
        replyTo: row.email || undefined,
        subject,
        html,
      });
    } finally {
      try { await client.close(); } catch { /* ignore close errors */ }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("notify-feedback error:", err);
    return new Response("Email failed", { status: 502 });
  }
});
