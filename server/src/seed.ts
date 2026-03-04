import db from './db/index';

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

interface SeedJob {
  source: string;
  url: string;
  company: string;
  title: string;
  location: string;
  work_model: string;
  posted_at: string | null;
}

const seedJobs: SeedJob[] = [
  { source: 'GitHub',     url: 'https://careers.google.com/jobs/results/1001',        company: 'Google',      title: 'Software Engineer L4',          location: 'Mountain View, CA',   work_model: 'Hybrid',   posted_at: daysAgo(2)  },
  { source: 'GitHub',     url: 'https://www.metacareers.com/jobs/2001',                company: 'Meta',        title: 'Frontend Engineer',             location: 'Remote',              work_model: 'Remote',   posted_at: daysAgo(3)  },
  { source: 'Manual',     url: 'https://jobs.apple.com/en-us/details/3001',            company: 'Apple',       title: 'iOS Software Engineer',         location: 'Cupertino, CA',       work_model: 'On-site',  posted_at: daysAgo(5)  },
  { source: 'ATS',        url: 'https://www.amazon.jobs/en/jobs/4001',                 company: 'Amazon',      title: 'Software Development Engineer II', location: 'Seattle, WA',      work_model: 'Hybrid',   posted_at: daysAgo(1)  },
  { source: 'GitHub',     url: 'https://careers.microsoft.com/jobs/5001',              company: 'Microsoft',   title: 'Software Engineer II',          location: 'Redmond, WA',         work_model: 'Hybrid',   posted_at: daysAgo(7)  },
  { source: 'GitHub',     url: 'https://jobs.netflix.com/jobs/6001',                   company: 'Netflix',     title: 'Senior Software Engineer',      location: 'Remote',              work_model: 'Remote',   posted_at: daysAgo(4)  },
  { source: 'Greenhouse', url: 'https://stripe.com/jobs/listing/7001',                 company: 'Stripe',      title: 'Full Stack Engineer',           location: 'San Francisco, CA',   work_model: 'Hybrid',   posted_at: daysAgo(2)  },
  { source: 'Greenhouse', url: 'https://careers.airbnb.com/positions/8001',            company: 'Airbnb',      title: 'Software Engineer, Infrastructure', location: 'San Francisco, CA', work_model: 'Hybrid',  posted_at: daysAgo(6)  },
  { source: 'Lever',      url: 'https://www.uber.com/us/en/careers/list/9001',         company: 'Uber',        title: 'Backend Engineer',              location: 'San Francisco, CA',   work_model: 'Hybrid',   posted_at: daysAgo(3)  },
  { source: 'Lever',      url: 'https://www.lyft.com/careers/10001',                   company: 'Lyft',        title: 'Frontend Engineer',             location: 'Remote',              work_model: 'Remote',   posted_at: daysAgo(1)  },
  { source: 'GitHub',     url: 'https://www.shopify.com/careers/11001',                company: 'Shopify',     title: 'Software Engineer',             location: 'Remote',              work_model: 'Remote',   posted_at: daysAgo(14) },
  { source: 'GitHub',     url: 'https://github.com/about/careers/12001',               company: 'GitHub',      title: 'Backend Engineer',              location: 'Remote',              work_model: 'Remote',   posted_at: daysAgo(5)  },
  { source: 'Greenhouse', url: 'https://www.cloudflare.com/careers/jobs/13001',        company: 'Cloudflare',  title: 'Systems Engineer',              location: 'Remote',              work_model: 'Remote',   posted_at: daysAgo(3)  },
  { source: 'GitHub',     url: 'https://vercel.com/careers/14001',                     company: 'Vercel',      title: 'Frontend Engineer',             location: 'Remote',              work_model: 'Remote',   posted_at: daysAgo(1)  },
  { source: 'Greenhouse', url: 'https://www.notion.com/careers/15001',                 company: 'Notion',      title: 'Software Engineer',             location: 'San Francisco, CA',   work_model: 'Hybrid',   posted_at: daysAgo(4)  },
  { source: 'GitHub',     url: 'https://linear.app/careers/16001',                     company: 'Linear',      title: 'Full Stack Engineer',           location: 'Remote',              work_model: 'Remote',   posted_at: daysAgo(2)  },
  { source: 'Greenhouse', url: 'https://www.figma.com/careers/17001',                  company: 'Figma',       title: 'Software Engineer II',          location: 'San Francisco, CA',   work_model: 'Hybrid',   posted_at: daysAgo(7)  },
  { source: 'Lever',      url: 'https://discord.com/jobs/18001',                       company: 'Discord',     title: 'Backend Engineer',              location: 'San Francisco, CA',   work_model: 'Hybrid',   posted_at: daysAgo(5)  },
  { source: 'GitHub',     url: 'https://www.twitch.tv/jobs/19001',                     company: 'Twitch',      title: 'Frontend Engineer',             location: 'Remote',              work_model: 'Remote',   posted_at: daysAgo(3)  },
  { source: 'Greenhouse', url: 'https://www.datadoghq.com/careers/20001',              company: 'Datadog',     title: 'Software Engineer',             location: 'New York, NY',        work_model: 'Hybrid',   posted_at: daysAgo(2)  },
  { source: 'ATS',        url: 'https://careers.snowflake.com/jobs/21001',             company: 'Snowflake',   title: 'Backend Engineer',              location: 'San Mateo, CA',       work_model: 'On-site',  posted_at: daysAgo(21) },
  { source: 'Manual',     url: 'https://jobs.lever.co/palantir/22001',                 company: 'Palantir',    title: 'Software Engineer',             location: 'Denver, CO',          work_model: 'On-site',  posted_at: daysAgo(1)  },
  { source: 'GitHub',     url: 'https://openai.com/careers/23001',                     company: 'OpenAI',      title: 'Software Engineer',             location: 'San Francisco, CA',   work_model: 'Hybrid',   posted_at: daysAgo(2)  },
  { source: 'GitHub',     url: 'https://www.anthropic.com/careers/24001',              company: 'Anthropic',   title: 'Software Engineer',             location: 'San Francisco, CA',   work_model: 'Remote',   posted_at: daysAgo(1)  },
  { source: 'Greenhouse', url: 'https://databricks.com/company/careers/25001',         company: 'Databricks',  title: 'Software Engineer, Platform',   location: 'San Francisco, CA',   work_model: 'Hybrid',   posted_at: daysAgo(5)  },
];

export function seedDatabase(): void {
  const row = db.prepare('SELECT COUNT(*) as count FROM job_postings').get() as { count: number };
  if (row.count > 0) {
    console.log(`[seed] Database already has ${row.count} jobs — skipping seed.`);
    return;
  }

  console.log('[seed] Seeding database with mock jobs...');

  const insert = db.prepare(`
    INSERT INTO job_postings (source, url, company, title, location, work_model, posted_at, first_seen_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    const now = new Date().toISOString();
    for (const job of seedJobs) {
      insert.run(job.source, job.url, job.company, job.title, job.location, job.work_model, job.posted_at, now, now);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  console.log(`[seed] Seeded ${seedJobs.length} jobs.`);
}
