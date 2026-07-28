import { jest } from '@jest/globals';

describe('index.js Component Tests', () => {
  let index;

  beforeAll(async () => {
    index = await import('../../scraper/index.js');
  });

  describe('transformJobsForSOLR', () => {
    it('should filter locations to only Romanian cities', () => {
      const payload = {
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', location: ['România'] },
          { url: 'https://test.com/2', title: 'Job 2', location: ['Bucharest'] },
          { url: 'https://test.com/3', title: 'Job 3', location: ['Bulgaria'] },
          { url: 'https://test.com/4', title: 'Job 4', location: ['Cluj-Napoca'] },
          { url: 'https://test.com/5', title: 'Job 5', location: [] }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.jobs[0].location).toEqual(['România']);
      expect(result.jobs[1].location).toEqual(['Bucharest']);
      expect(result.jobs[2].location).toEqual(['România']);
      expect(result.jobs[3].location).toEqual(['Cluj-Napoca']);
      expect(result.jobs[4].location).toEqual(['România']);
    });

    it('should keep company uppercase', () => {
      const payload = {
        source: 'lseg.com',
        company: 'lseg international srl',
        cif: '39176747',
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', company: 'lseg', cif: '39176747' }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.company).toBe('LSEG INTERNATIONAL SRL');
    });

    it('should normalize workmode values', () => {
      const payload = {
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', workmode: 'Remote' },
          { url: 'https://test.com/2', title: 'Job 2', workmode: 'ON-SITE' },
          { url: 'https://test.com/3', title: 'Job 3', workmode: 'Hybrid' },
          { url: 'https://test.com/4', title: 'Job 4', workmode: 'hybrid' }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.jobs[0].workmode).toBe('remote');
      expect(result.jobs[1].workmode).toBe('on-site');
      expect(result.jobs[2].workmode).toBe('hybrid');
      expect(result.jobs[3].workmode).toBe('hybrid');
    });

    it('should handle empty jobs array', () => {
      const result = index.transformJobsForSOLR({ jobs: [] });
      expect(result.jobs).toEqual([]);
    });
  });

  describe('mapToJobModel', () => {
    it('should map raw job to job model format', () => {
      const rawJob = {
        url: 'https://lseg.wd3.myworkdayjobs.com/en-US/Careers/job/123',
        title: 'Senior Developer',
        location: ['Bucharest'],
        tags: ['Java', 'Spring'],
        workmode: 'hybrid'
      };

      const COMPANY_NAME = 'LSEG BUSINESS SERVICES RM S.R.L.';
      const COMPANY_CIF = '39176747';

      const result = index.mapToJobModel(rawJob, COMPANY_CIF, COMPANY_NAME);

      expect(result.url).toBe(rawJob.url);
      expect(result.title).toBe(rawJob.title);
      expect(result.company).toBe(COMPANY_NAME);
      expect(result.cif).toBe(COMPANY_CIF);
      expect(result.location).toEqual(rawJob.location);
      expect(result.tags).toEqual(rawJob.tags);
      expect(result.workmode).toBe(rawJob.workmode);
      expect(result.status).toBe('scraped');
      expect(result.date).toBeDefined();
    });

    it('should remove undefined fields', () => {
      const rawJob = {
        url: 'https://test.com/1',
        title: 'Job 1'
      };

      const result = index.mapToJobModel(rawJob, '39176747');

      expect(result.location).toBeUndefined();
      expect(result.tags).toBeUndefined();
      expect(result.workmode).toBeUndefined();
    });

    it('should handle missing title', () => {
      const rawJob = { url: 'https://test.com/1' };

      const result = index.mapToJobModel(rawJob, '39176747');

      expect(result.title).toBeUndefined();
      expect(result.url).toBe('https://test.com/1');
    });
  });

  describe('parseApiJobs', () => {
    it('should parse Workday API response format', () => {
      const apiData = {
        total: 66,
        jobPostings: [
          {
            title: 'Senior Software Engineer',
            externalPath: '/job/Bucharest-Romania/Senior-Software-Engineer-_R0120628',
            locationsText: 'Bucharest, Romania',
            postedOn: 'Posted Today',
            bulletFields: ['R0120628', 'Division: Engineering']
          }
        ]
      };

      const result = index.parseApiJobs(apiData);

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].title).toBe('Senior Software Engineer');
      expect(result.jobs[0].location).toEqual(['Bucharest', 'Romania']);
    });

    it('should handle empty job list', () => {
      const apiData = { total: 0, jobPostings: [] };

      const result = index.parseApiJobs(apiData);

      expect(result.jobs).toEqual([]);
    });

    it('should handle missing jobPostings field', () => {
      const result = index.parseApiJobs({});

      expect(result.jobs).toEqual([]);
    });

    it('should extract tags from bulletFields', () => {
      const apiData = {
        total: 1,
        jobPostings: [
          {
            title: 'Developer',
            externalPath: '/job/Bucharest/Developer',
            locationsText: 'Bucharest, Romania',
            bulletFields: ['R0123456', 'Division: Engineering']
          }
        ]
      };

      const result = index.parseApiJobs(apiData);

      expect(result.jobs[0].tags).toContain('engineering');
    });

    it('should build full URL from externalPath', () => {
      const apiData = {
        total: 1,
        jobPostings: [
          {
            title: 'Test Job',
            externalPath: '/job/Bucharest-Romania/Test-Job_R0123456',
            locationsText: 'Bucharest, Romania',
            bulletFields: ['R0123456', 'Division: Engineering']
          }
        ]
      };

      const result = index.parseApiJobs(apiData);

      expect(result.jobs[0].url).toContain('lseg.wd3.myworkdayjobs.com');
      expect(result.jobs[0].url).toContain('Test-Job_R0123456');
    });
  });
});
