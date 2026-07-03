# API gestione sito

Endpoint Vercel:

```text
/api/site
```

Autenticazione:

```http
Authorization: Bearer <SITE_API_KEY>
```

Variabili ambiente da impostare su Vercel:

```text
SITE_API_KEY=una-chiave-lunga-che-conosci-solo-tu
GITHUB_TOKEN=token GitHub con permesso Contents read/write sul repo
GITHUB_OWNER=barotti
GITHUB_REPO=MHUB
GITHUB_BRANCH=main
API_ALLOWED_ORIGIN=*
```

Il token GitHub deve essere salvato solo nelle variabili ambiente di Vercel, mai nel codice.

## Lista file modificabili

```bash
curl "https://tuo-dominio.it/api/site?list=1" \
  -H "Authorization: Bearer <SITE_API_KEY>"
```

## Leggi un file

```bash
curl "https://tuo-dominio.it/api/site?file=index.html" \
  -H "Authorization: Bearer <SITE_API_KEY>"
```

## Sostituisci testo in una pagina

```bash
curl -X PATCH "https://tuo-dominio.it/api/site" \
  -H "Authorization: Bearer <SITE_API_KEY>" \
  -H "Content-Type: application/json" \
  -d "{\"file\":\"index.html\",\"message\":\"Update homepage copy\",\"replacements\":[{\"search\":\"testo vecchio\",\"replace\":\"testo nuovo\"}]}"
```

## Sovrascrivi un file testuale

```bash
curl -X PUT "https://tuo-dominio.it/api/site" \
  -H "Authorization: Bearer <SITE_API_KEY>" \
  -H "Content-Type: application/json" \
  -d "{\"file\":\"index.html\",\"message\":\"Update homepage\",\"content\":\"<html>...</html>\"}"
```

## Carica un'immagine

Invia il contenuto in base64:

```bash
curl -X PUT "https://tuo-dominio.it/api/site" \
  -H "Authorization: Bearer <SITE_API_KEY>" \
  -H "Content-Type: application/json" \
  -d "{\"file\":\"public/web/images/home/logo.png\",\"message\":\"Update logo\",\"contentBase64\":\"BASE64_DELL_IMMAGINE\"}"
```

Percorsi consentiti:

- file nella root del sito, come `index.html`, `group.html`, `studios.html`, `gaming.html`
- `css/`
- `js/`
- `servizi/`
- `public/web/images/`
- `public/web/videos/`

Metodi disponibili:

- `GET`: lista o lettura file
- `PUT` / `POST`: crea o sovrascrive file
- `PATCH`: sostituzioni testuali esatte
