-- Webhook-triggeri: kutsuu notify-feedback-Edge Functionia jokaisesta
-- uudesta feedback-rivistä pg_netin kautta (asynkroninen, ei hidasta insertiä).
-- Tämä on ajettu tuotantokantaan 2026-09-01. Korvaa dashboardin
-- "Database Webhooks" -asetuksen, jota README:n vaihe 4 aiemmin ehdotti.
-- __WEBHOOK_SECRET__ = sama arvo kuin Edge Functionin WEBHOOK_SECRET-secret.

create extension if not exists pg_net;

create or replace function public.notify_feedback_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  perform net.http_post(
    url := 'https://jaepadyeyrrwhiomxyfj.supabase.co/functions/v1/notify-feedback',
    headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret','__WEBHOOK_SECRET__'),
    body := jsonb_build_object('record', to_jsonb(new)),
    timeout_milliseconds := 5000
  );
  return new;
end;
$fn$;

drop trigger if exists feedback_notify on public.feedback;
create trigger feedback_notify
  after insert on public.feedback
  for each row execute function public.notify_feedback_webhook();
