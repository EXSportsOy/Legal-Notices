# Palauteosio (`/feedback/`)

Uusi monikielinen palauteosio EXSports-sivustolle. Korvaa vanhan Google Forms ‑pohjaisen "report a bug" ‑ratkaisun. Palaute tallentuu **Supabaseen** (ilmainen taso) ja uudesta palautteesta lähtee **sähköposti-ilmoitus**. Toteutus on staattista HTML/CSS/JS:ää sivuston omalla tyylillä (`/styles.css`, Geist, Pine Mist) ja käyttää sivuston i18n-kielivalitsinta.

## Rakenne

```
feedback/
  index.html              Kielivalitsin (ohjaa /feedback/<kieli>/ — kuten /legal/)
  <kieli>/index.html      Palautesivu kullekin 15 kielelle (en, fi, sv, no, da, de,
                          nl, fr, es, it, pt, pl, et, lv, lt)
  feedback.css            Tyylit (rakentuu /styles.css-tokenien päälle)
  feedback-i18n.js        Kaikkien kielten tekstit yhdessä sanakirjassa
  feedback.js             Logiikka: i18n, näkymät, validointi, Supabase-tallennus
  feedback-config.js      Supabase-URL + julkinen anon-avain (TÄYTÄ)
  supabase/schema.sql     Tietokantataulu + käyttöoikeudet (RLS)
  supabase/functions/notify-feedback/index.ts   Edge Function: sähköposti-ilmoitus
```

## Käyttäjäpolku

1. **Verkkosivupalaute** tai **Sovelluspalaute**.
2. Sovelluspalaute → valitse **SurveyTools / Heda / Shodia** → **Nopea palaute** (vapaa teksti + tähtiarvio) tai **Bugiraportti** (otsikko, vakavuus, toistamisvaiheet, odotettu/tapahtui, ympäristö).
3. Onnistumisnäkymä.

Ei-englanninkielisillä sivuilla näkyy konekäännösilmoitus (englanti on virallinen versio) — sama linja kuin sivuston muilla käännetyillä sivuilla.

## Käyttöönotto

### 1. Supabase-projekti
Luo projekti osoitteessa [supabase.com](https://supabase.com) (ilmainen taso riittää).

### 2. Taulu + käyttöoikeudet
**SQL Editor** → aja `supabase/schema.sql`. Luo `feedback`-taulun ja RLS-säännön, joka sallii julkisella avaimella vain **lisäyksen** (ei lukua selaimesta).

### 3. Avaimet
**Project Settings → API** → kopioi *Project URL* ja *anon public* ‑avain tiedostoon `feedback/feedback-config.js`. Anon-avain on tarkoitettu julkiseksi; **älä** käytä service_role-avainta.

### 4. Sähköposti-ilmoitukset (Resend, ilmainen)
1. Luo tili [resend.com](https://resend.com), tee API-avain ja verifioi lähettäjädomain (esim. `exsports.fi`).
2. Julkaise funktio (Supabase CLI):
   ```bash
   supabase functions deploy notify-feedback --no-verify-jwt
   supabase secrets set RESEND_API_KEY=re_xxx \
     NOTIFY_EMAIL_TO=tiimi@exsports.fi \
     NOTIFY_EMAIL_FROM=feedback@exsports.fi \
     WEBHOOK_SECRET=satunnainen-merkkijono
   ```
3. Webhook on toteutettu suoraan tietokantatriggerinä (`supabase/webhook_trigger.sql`, ajettu tuotantoon 2026-09-01), joten dashboardin *Database Webhooks* -asetusta ei tarvita. Funktio, triggeri ja secretit `NOTIFY_EMAIL_TO=info@exsports.fi`, `NOTIFY_EMAIL_FROM` ja `WEBHOOK_SECRET` ovat valmiina; vain `RESEND_API_KEY` puuttuu.

> **Ilman domainia / Resendiä?** Ohjaa webhook suoraan Discord- tai Slack-webhook-URLiin (Type: *HTTP Request*). Täysin ilmaista. Muotoiltua viestiä varten käytä yllä olevaa Edge Functionia.

### 5. Vanhat report-bug-sivut
Kaikki 17 vanhaa `report-bug.html`-sivua (`legal/<kieli>/`, `heda/legal/`, `surveytools/legal/`) ohjaavat nyt automaattisesti uuteen osioon oikealla sovelluksella ja buginäkymällä esivalittuna. Google Forms ei ole enää käytössä. Sivut on merkitty `noindex`, joten hakukoneet siirtyvät uuteen osioon.

### 6. Sitemap (valinnainen)
Lisää uudet `/feedback/<kieli>/`-sivut `sitemap.xml`-tiedostoon hakukonenäkyvyyttä varten.

## Lokalisointi
Kaikki tekstit ovat `feedback-i18n.js`-sanakirjassa. Englanti on virallinen; muut ovat käännöksiä (suomi natiivilaatua, loput konekäännöslaatua konekäännösilmoituksella). Korjaa tai lisää kieliä muokkaamalla sanakirjaa — HTML-sivut ovat identtisiä `lang`-koodia lukuun ottamatta.

## Tietomalli (`feedback`-taulu)
`category` (website / program_general / program_bug), `app` (website / surveytools / heda / shodia), `lang`, `message`, `rating`, `email`, bugikentät (`bug_title`, `severity`, `steps`, `expected`, `actual`, `environment`), `page_url`, `user_agent`, `status` (käsittelyn seurantaan).

## Ilmaistason rajat
Supabase free: 500 MB tietokantaa, Edge Functions sisältyvät. Resend free: ~100 viestiä/päivä, 3 000/kk. Riittää palautteelle hyvin.

## Roskapostisuoja
Piilotettu hunajapurkkikenttä (botit täyttävät → hylätään hiljaa) + RLS rajoittaa viestin pituuden. Tarvittaessa lisää Cloudflare Turnstile (ilmainen).
