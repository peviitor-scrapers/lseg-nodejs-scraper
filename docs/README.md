# job_seeker_ro_spider

**job_seeker_ro_spider** — scraper pentru job-urile LSEG Systems din România.

Extrage anunțurile de pe [LSEG Careers Romania](https://lseg.wd3.myworkdayjobs.com/en/jobs/romania) și le publică în [peviitor.ro](https://peviitor.ro) prin API-ul Peviitor.

## Identificare

Toate request-urile HTTP folosesc User-Agent-ul:

```
job_seeker_ro_spider
```

## Ce face

1. **Validează compania** — interoghează API-ul public ANAF ([demoanaf.ro](https://demoanaf.ro)) + CUIScan + CUIFirma și verifică:
   - Denumirea oficială: LSEG BUSINESS SERVICES RM S.R.L.
   - Status: activ/inactiv/radiat
   - Adresa completă din registrul comerțului
2. **Cross-validează cu Peviitor** — verifică existența companiei în API-ul Peviitor
3. **Scrape-uiește job-urile** — extrage lista completă de job-uri din API-ul public LSEG Careers Workday, filtrat pe România
4. **Transformă datele** — normalizează locațiile (doar orașe românești), tag-urile (lowercase), workmode-ul (remote/on-site/hybrid)
5. **Upsert în Peviitor API** — upsert în `job` core (job-urile) și `company` core (datele companiei cu adresa completă)
6. **Generează docs/jobs.md** — fișier markdown cu informații companie + toate job-urile curente, publicat pe [GitHub Pages](https://peviitor-scrapers.github.io/lseg-nodejs-scraper/jobs.md)

## Structură proiect

```
├── scraper/
│   ├── config/company.json     # Sursa unică de adevăr (CIF, brand, URL-uri, API)
│   ├── config/company.js       # Loader ESM pentru config/company.json
│   ├── index.js                # Orchestrator principal
│   ├── company.js              # Validare companie (ANAF + Peviitor) cu cache 7 zile
│   ├── anaf.js                # Modul multi-sursă: ANAF + CUIScan + CUIFirma
│   ├── demoanaf.js            # CLI wrapper pentru anaf.js
│   ├── api.js                  # Operații Peviitor API (query, upsert, delete, company)
│   ├── job-validator.js        # Primitivă comună: validateByHead, validateByContent
│   └── markdown-generator.js   # Generează docs/jobs.md după scrape
├── tests/
│   ├── unit/          # Teste unitare (API-uri mock-uite)
│   ├── integration/   # Teste de integrare (ANAF + API live)
│   ├── e2e/           # Teste end-to-end (pipelin complet)
│   └── consistency/   # Verificări repo (public, topics, workflow naming)
├── docs/
│   ├── jobs.md        # Job-urile scrapate (generat de CI)
│   └── company.json   # Copie statică a config/company.json
└── .github/workflows/
    ├── job-seeker-ro-spider.yml     # Rulează zilnic la 6 AM UTC
    └── automation-testing.yml       # Teste automate la fiecare push/PR
```

## API-uri folosite

| API | URL | Autentificare |
|---|---|---|
| LSEG Careers | `https://lseg.wd3.myworkdayjobs.com/wday/cxs/lseg/Careers/jobs` | Public |
| ANAF (demoanaf) | `https://demoanaf.ro/api/...` | Public |
| CUIScan | `https://cuiiscan.ro/api/...` | Public |
| CUIFirma | `https://cuifirma.ro/api/...` | Public |
| Peviitor | `https://api.peviitor.ro/v1/` | Public (User-Agent: job_seeker_ro_spider) |

## Robots.txt

LSEG Careers [robots.txt](https://lseg.wd3.myworkdayjobs.com/robots.txt) dezactivează:
- `/api/*` — API-ul JSON folosit de scraper
- `/*/vacancy/*` — paginile individuale de job

Scraper-ul folosește API-ul cu rate limiting (1s delay între pagini, 10 job-uri/cerere) și un singur User-Agent identificabil. Paginile individuale de job sunt doar verificate (HEAD request), nu parse-uite.

Pentru analiza completă, vezi [ROBOTS.md](../ROBOTS.md).

## Testare

```bash
# Toate testele
npm test

# Doar unitare
npm run test:unit

# Doar integrare (necesită ANAF live + API Peviitor)
npm run test:integration

# Doar E2E (API real LSEG + ANAF + Peviitor)
npm run test:e2e
```

Testele de integrare și E2E auto-detectează disponibilitatea ANAF și a API-ului Peviitor — se auto-skip dacă nu sunt accesibile.
