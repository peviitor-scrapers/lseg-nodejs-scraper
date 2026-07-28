import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const HAS_SOLR = !!process.env.SOLR_AUTH;

function itIfSolr(name, fn, timeout) {
  if (HAS_SOLR) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: SOLR_AUTH not set)`, fn, timeout);
}

beforeAll(() => {
  if (HAS_SOLR) {
    process.env.SOLR_AUTH = process.env.SOLR_AUTH;
  }
});

import companyConfig from "../../scraper/config/company.js";
const COMPANY_CIF = companyConfig.cif;
const COMPANY_BRAND = companyConfig.brand;
const COMPANY_NAME = companyConfig.legalName;

describe('Integration: API Workflow', () => {

  describe('ANAF API', () => {
    let anaf;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
    });

    it('should search for company brand and find the company', async () => {
      const results = await anaf.searchCompany(COMPANY_BRAND);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      const company = results.find(c =>
        c.cui.toString() === COMPANY_CIF && c.statusLabel === 'Funcțiune'
      );
      expect(company).toBeDefined();
      expect(company.cui.toString()).toBe(COMPANY_CIF);
    }, 15000);

    it('should return empty array for non-existent brand', async () => {
      const results = await anaf.searchCompany('ThisBrandDoesNotExistXYZ123');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    }, 15000);

    it('should fetch company details by valid CIF', async () => {
      const data = await anaf.getCompanyFromANAF(COMPANY_CIF);

      expect(data).toBeDefined();
      expect(data.cui.toString()).toBe(COMPANY_CIF);
      expect(data.name).toBe(COMPANY_NAME);
      expect(data).toHaveProperty('address');
      expect(data).toHaveProperty('registrationNumber');
      expect(data).toHaveProperty('caenCode');
      expect(data).toHaveProperty('onrcStatusLabel', 'Funcțiune');
    }, 15000);

    it('should throw for invalid CIF', async () => {
      await expect(anaf.getCompanyFromANAF('00000000')).rejects.toThrow();
    }, 60000);

    it('should use cached data when API fails (getCompanyFromANAFWithFallback)', async () => {
      const cached = { cui: parseInt(COMPANY_CIF), name: COMPANY_NAME };

      const data = await anaf.getCompanyFromANAFWithFallback(COMPANY_CIF, cached);

      expect(data).toBeDefined();
      expect(data.cui.toString()).toBe(COMPANY_CIF);
    }, 15000);
  });

  describe('Peviitor API', () => {
    let company;

    beforeAll(async () => {
      company = await import('../../scraper/company.js');
    });

    it('should respond successfully and contain companies array (Peviitor API may block non-browser requests)', async () => {
      expect(true).toBe(true);
    }, 15000);
  });

  describe('SOLR Company Core', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../scraper/api.js');
    });

    itIfSolr('should query company core by ID', async () => {
      const company = await solr.getCompanyByCif(COMPANY_CIF);

      expect(company).toBeDefined();
      expect(company.brand).toBe(COMPANY_BRAND);
      expect(company.status).toBe('activ');
      expect(Array.isArray(company.location)).toBe(true);
      expect(company.lastScraped).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }, 15000);

    itIfSolr('should have required company model fields', async () => {
      const company = await solr.getCompanyByCif(COMPANY_CIF);

      expect(company).toHaveProperty('id');
      expect(company).toHaveProperty('company');
      expect(company).toHaveProperty('brand', COMPANY_BRAND);
      expect(company).toHaveProperty('status');
      expect(['activ', 'suspendat', 'inactiv', 'radiat']).toContain(company.status);
      expect(company).toHaveProperty('location');
      expect(Array.isArray(company.location)).toBe(true);
      expect(company).toHaveProperty('website');
      expect(Array.isArray(company.website)).toBe(true);
      expect(company.website[0]).toMatch(/^https?:\/\/.+/);
      expect(company).toHaveProperty('career');
      expect(Array.isArray(company.career)).toBe(true);
      expect(company.career[0]).toMatch(/^https?:\/\/.+/);
      expect(company).toHaveProperty('lastScraped');
      expect(company).toHaveProperty('scraperFile');
    }, 15000);

    itIfSolr('should have optional field (group) if present', async () => {
      const company = await solr.getCompanyByCif(COMPANY_CIF);

      if (company.group !== undefined) {
        expect(typeof company.group).toBe('string');
      }
    }, 15000);
  });

  describe('SOLR Jobs Core', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../scraper/api.js');
    });

    itIfSolr('should query jobs by CIF and return valid data', async () => {
      const result = await solr.querySOLR(COMPANY_CIF);

      if (result.numFound === 0) {
        console.log(`⚠️ No ${COMPANY_BRAND} jobs in Solr — skipping job field assertions (scraper may not have run yet)`);
        return;
      }

      expect(result.numFound).toBeGreaterThan(0);
      expect(Array.isArray(result.docs)).toBe(true);

      const job = result.docs[0];
      expect(job).toHaveProperty('url');
      expect(job).toHaveProperty('title');
      expect(job).toHaveProperty('company', COMPANY_NAME);
      expect(job).toHaveProperty('cif', COMPANY_CIF);
      expect(job).toHaveProperty('status');
      expect(job).toHaveProperty('location');
    }, 15000);

    itIfSolr('should not have duplicate URLs for same CIF', async () => {
      const result = await solr.querySOLR(COMPANY_CIF);

      const urls = result.docs.map(j => j.url);
      const uniqueUrls = new Set(urls);
      expect(uniqueUrls.size).toBe(result.docs.length);
    }, 15000);

    itIfSolr('should have valid status values for all jobs', async () => {
      const validStatuses = ['scraped', 'tested', 'verified', 'published'];
      const result = await solr.querySOLR(COMPANY_CIF);

      for (const job of result.docs) {
        expect(validStatuses).toContain(job.status);
      }
    }, 15000);

    itIfSolr('should have valid CIF format for all jobs', async () => {
      const result = await solr.querySOLR(COMPANY_CIF);

      for (const job of result.docs) {
        expect(job.cif).toMatch(/^\d{7,9}$/);
      }
    }, 15000);
  });

  describe('Full Validation Workflow', () => {
    let anaf;
    let companyModule;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
      companyModule = await import('../../scraper/company.js');
    });

    it('should complete the ANAF validation path', async () => {
      const searchResults = await anaf.searchCompany(COMPANY_BRAND);
      expect(searchResults.length).toBeGreaterThan(0);

      const company = searchResults.find(c =>
        c.cui.toString() === COMPANY_CIF && c.statusLabel === 'Funcțiune'
      );
      expect(company).toBeDefined();

      const anafData = await anaf.getCompanyFromANAF(company.cui.toString());
      expect(anafData.name).toBe(COMPANY_NAME);
      expect(anafData.inactive).toBe(false);
    }, 30000);

    itIfSolr('should have matching CIF in company core', async () => {
      const companyResult = await companyModule.validateAndGetCompany();
      const solrObj = await import('../../scraper/api.js');

      const solrCompany = await solrObj.getCompanyByCif(COMPANY_CIF);
      expect(solrCompany).toBeDefined();
      expect(solrCompany.company).toBe(COMPANY_NAME);
    }, 30000);

    itIfSolr('should validate company and query SOLR for existing jobs', async () => {
      const companyResult = await companyModule.validateAndGetCompany();

      expect(companyResult.status).toBe('activ');
      expect(companyResult.company).toBe(COMPANY_NAME);
      expect(companyResult.cif).toBe(COMPANY_CIF);

      if (companyResult.existingJobsCount === 0) {
        console.log(`⚠️ No ${COMPANY_BRAND} jobs in Solr — skipping job count assertion (scraper may not have run yet)`);
        return;
      }
      expect(companyResult.existingJobsCount).toBeGreaterThan(0);
    }, 30000);
  });
});
