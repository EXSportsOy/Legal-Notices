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

### 4. Sähköposti-ilmoitukset (Proton Mail SMTP)
Funktio lähettää postin Proton Mailin SMTP submission -ominaisuudella (vaatii
Proton for Business -tason), joten erillistä lähetyspalvelua ei tarvita.

1. Proton: **Settings → IMAP/SMTP → SMTP submission → Generate token** osoitteelle `info@exsports.fi`.
2. Julkaise funktio ja aseta secretit (Supabase CLI):
   ```bash
   supabase functions deploy notify-feedback --no-verify-jwt
   supabase secrets set SMTP_HOST=smtp.protonmail.ch SMTP_PORT=465 \
     SMTP_USERNAME=info@exsports.fi SMTP_PASSWORD=<proton-smtp-token> \
     NOTIFY_EMAIL_TO=info@exsports.fi NOTIFY_EMAIL_FROM=info@exsports.fi \
     WEBHOOK_SECRET=satunnainen-merkkijono
   ```
3. Webhook on toteutettu suoraan tietokantatriggerinä (`supabase/webhook_trigger.sql`, ajettu tuotantoon 2026-09-01), joten dashboardin *Database Webhooks* -asetusta ei tarvita. Funktio, triggeri ja kaikki secretit paitsi `SMTP_PASSWORD` ovat valmiina tuotannossa.

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
Supabase free: 500 MB tietokantaa, Edge Functions sisältyvät. Sähköposti lähtee omasta Proton-postista (SMTP submission), ei erillistä viestirajaa palautemäärillä.

Palautetoiminnon regressiotestit (`.github/workflows/feedback-tests.yml`) ajetaan palautekoodin muutoksista, onnistuneen GitHub Pages -julkaisun jälkeen sekä päivittäin klo 06:17 UTC. Testit tarkistavat lomakkeen toiminnan, lähetyssisällöt, virheestä palautumisen sekä tuotantorajapinnan kentät ja virheellisten syötteiden hylkäämisen. Selaintestien lähetykset kaapataan; tuotantoon tehdään vain kenttien lukutarkistus ilman palauterivejä ja kaksi virheellistä lähetysyritystä. Katso ajokomennot, testauksen rajat ja virhetilanteiden ohjeet tiedostosta [tests/feedback/README.md](../tests/feedback/README.md).

[Supabasen mukaan](https://supabase.com/docs/guides/platform/free-project-pausing) muutama tietokantapyyntö päivässä yleensä riittää estämään tauotuksen, mutta Free-taso ei takaa tauottomuutta. Testien tarkoitus on havaita palautetoiminnon regressioita, eikä niiden tuottaman aktiivisuuden vaikutusta tauotukseen taata. [GitHub voi poistaa julkisen repon ajastukset käytöstä](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows), jos repossa ei ole toimintaa 60 päivään; ota ajastus tällöin uudelleen käyttöön Actionsista.

## Roskapostisuoja
Piilotettu hunajapurkkikenttä (botit täyttävät → hylätään hiljaa) + RLS rajoittaa viestin pituuden. Tarvittaessa lisää Cloudflare Turnstile (ilmainen).
