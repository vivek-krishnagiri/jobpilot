import { useState, useEffect } from 'react';
import type { JobPosting } from '../types';
import { fetchAppliedJobs, updateJob } from '../api/jobs';
import JobTable from '../components/JobTable';
import { formatDate } from '../utils/date';

export default function CurrentJobs() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  const load = () => {
    setLoading(true);
    setError(null);
    fetchAppliedJobs()
      .then(setJobs)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const saveNotes = async (id: number) => {
    await updateJob(id, { notes: notesDraft });
    setJobs((prev) => prev.map((j) => j.id === id ? { ...j, notes: notesDraft } : j));
    setEditingNotes(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-2 text-gray-400">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-red-500 mb-2">{error}</p>
        <button onClick={load} className="text-xs text-indigo-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900">Current Jobs</h1>
          <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">
            {jobs.length} applied
          </span>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 bg-white transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {jobs.length === 0 ? (
          <AppliedEmptyState />
        ) : (
          <div>
            <JobTable jobs={jobs} showAppliedInfo />
            {/* Notes section */}
            <div className="px-6 py-4 border-t border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Application Notes</h2>
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div key={job.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{job.company}</span>
                        <span className="text-gray-400 mx-1.5">·</span>
                        <span className="text-sm text-gray-600">{job.title}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {job.applied_at && (
                          <span>Applied {formatDate(job.applied_at)}</span>
                        )}
                        <button
                          onClick={() => window.open(job.url, '_blank', 'noopener,noreferrer')}
                          className="text-indigo-500 hover:text-indigo-700 font-medium"
                        >
                          View posting ↗
                        </button>
                      </div>
                    </div>

                    {editingNotes === job.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          rows={3}
                          placeholder="Add notes about your application, interview status, follow-up dates…"
                          className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveNotes(job.id)}
                            className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingNotes(null)}
                            className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => { setEditingNotes(job.id); setNotesDraft(job.notes ?? ''); }}
                        className="text-sm text-gray-500 cursor-pointer hover:text-gray-700 min-h-[36px] group"
                      >
                        {job.notes
                          ? <p className="whitespace-pre-wrap">{job.notes}</p>
                          : <p className="italic text-gray-400 group-hover:text-gray-500">Click to add notes…</p>
                        }
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AppliedEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-5">
        <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">No applications yet</h3>
      <p className="text-sm text-gray-500 max-w-xs">
        Jobs you mark as applied will appear here. Use the Browse Jobs page to find and apply to positions.
      </p>
    </div>
  );
}
