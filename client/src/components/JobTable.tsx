import { useState } from 'react';
import clsx from 'clsx';
import type { JobPosting, WorkModel } from '../types';
import { relativeDate } from '../utils/date';
import ApplyModal from './ApplyModal';

interface JobTableProps {
  jobs: JobPosting[];
  onMarkApplied?: (id: number) => Promise<void>;
  showAppliedInfo?: boolean;
}

function WorkModelBadge({ model }: { model: WorkModel }) {
  const styles: Record<WorkModel, string> = {
    Remote: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    Hybrid: 'bg-blue-50 text-blue-700 ring-blue-200',
    'On-site': 'bg-orange-50 text-orange-700 ring-orange-200',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset',
        styles[model],
      )}
    >
      {model}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const styles: Record<string, string> = {
    GitHub:       'bg-gray-100 text-gray-700',
    Greenhouse:   'bg-green-50 text-green-700',
    Lever:        'bg-purple-50 text-purple-700',
    Manual:       'bg-yellow-50 text-yellow-700',
    ATS:          'bg-indigo-50 text-indigo-700',
    SimplifyJobs: 'bg-sky-50 text-sky-700',
    Jobright:     'bg-violet-50 text-violet-700',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        styles[source] ?? 'bg-gray-100 text-gray-600',
      )}
    >
      {source}
    </span>
  );
}

function CompanyAvatar({ company }: { company: string }) {
  const colors = [
    'bg-indigo-100 text-indigo-700',
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-pink-100 text-pink-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-cyan-100 text-cyan-700',
    'bg-rose-100 text-rose-700',
  ];
  const idx = company.charCodeAt(0) % colors.length;
  return (
    <div
      className={clsx(
        'w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0',
        colors[idx],
      )}
    >
      {company[0].toUpperCase()}
    </div>
  );
}

export default function JobTable({ jobs, showAppliedInfo = false }: JobTableProps) {
  const [applyTarget, setApplyTarget] = useState<JobPosting | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-52">
                Company
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-44">
                Location
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                Model
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
                {showAppliedInfo ? 'Applied' : 'Posted'}
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                Source
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                showAppliedInfo={showAppliedInfo}
                onApply={() => setApplyTarget(job)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {applyTarget && (
        <ApplyModal
          jobId={applyTarget.id}
          jobTitle={applyTarget.title}
          company={applyTarget.company}
          onClose={() => setApplyTarget(null)}
        />
      )}
    </>
  );
}

function JobRow({
  job,
  showAppliedInfo,
  onApply,
}: {
  job: JobPosting;
  showAppliedInfo: boolean;
  onApply: () => void;
}) {
  const postedLabel = job.posted_at ? relativeDate(job.posted_at) : `Seen ${relativeDate(job.first_seen_at)}`;
  const appliedLabel = job.applied_at ? relativeDate(job.applied_at) : '—';

  const handleOpen = () => window.open(job.url, '_blank', 'noopener,noreferrer');

  return (
    <tr className="hover:bg-gray-50/60 transition-colors group">
      {/* Company */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <CompanyAvatar company={job.company} />
          <span className="font-medium text-gray-900 truncate max-w-[120px]">{job.company}</span>
        </div>
      </td>

      {/* Title */}
      <td className="px-4 py-3">
        <button
          onClick={handleOpen}
          className="text-left text-gray-800 hover:text-indigo-600 font-medium transition-colors"
        >
          {job.title}
        </button>
        {!job.posted_at && (
          <span className="ml-1.5 text-xs text-gray-400 italic">(no post date)</span>
        )}
      </td>

      {/* Location */}
      <td className="px-4 py-3 text-gray-500 text-xs">{job.location || '—'}</td>

      {/* Work Model */}
      <td className="px-4 py-3">
        <WorkModelBadge model={job.work_model} />
      </td>

      {/* Posted / Applied */}
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
        {showAppliedInfo ? appliedLabel : postedLabel}
      </td>

      {/* Source */}
      <td className="px-4 py-3">
        <SourceBadge source={job.source} />
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleOpen}
            title="Open job posting"
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Open
          </button>

          {/* Apply button — opens autofill modal */}
          {!showAppliedInfo && !job.applied_flag && (
            <button
              onClick={onApply}
              title="Autofill application"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Apply
            </button>
          )}
          {!showAppliedInfo && job.applied_flag && (
            <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-600 border border-emerald-200 bg-emerald-50 rounded-md cursor-default">
              ✓ Applied
            </span>
          )}
          {showAppliedInfo && (
            <button
              onClick={onApply}
              title="Autofill application"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Autofill
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
