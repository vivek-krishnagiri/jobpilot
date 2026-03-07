import { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import type { ApplySession, FillResult, SessionStatus } from '../types';
import { startApplySession, fetchApplySession, triggerAutofill } from '../api/apply';

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<SessionStatus, string> = {
  created:       'Starting…',
  opening:       'Opening browser…',
  open:          'Browser open — watching for application form…',
  form_detected: 'Form detected — ready to autofill',
  filling:       'Filling form…',
  filled:        'Form filled — watching for next step…',
  error:         'Error',
  closed:        'Session closed',
};

const STATUS_COLOR: Record<SessionStatus, string> = {
  created:       'text-gray-500',
  opening:       'text-indigo-500',
  open:          'text-blue-500',
  form_detected: 'text-emerald-600',
  filling:       'text-indigo-500',
  filled:        'text-emerald-600',
  error:         'text-red-500',
  closed:        'text-gray-400',
};

// Poll while in any active (non-terminal) state, including filled so we detect
// new Workday wizard steps after the user clicks "Next" in the browser.
const POLLING_STATUSES: SessionStatus[] = ['created', 'opening', 'open', 'form_detected', 'filled'];

// ─── Component ────────────────────────────────────────────────────────────────

interface ApplyModalProps {
  jobId: number;
  jobTitle: string;
  company: string;
  onClose: () => void;
  onMarkApplied?: (jobId: number) => Promise<void>;
}

export default function ApplyModal({ jobId, jobTitle, company, onClose, onMarkApplied }: ApplyModalProps) {
  const [session, setSession]               = useState<ApplySession | null>(null);
  const [fillHistory, setFillHistory]       = useState<FillResult[]>([]);
  const [filling, setFilling]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [confirmState, setConfirmState]     = useState<'idle' | 'ask' | 'marking' | 'done' | 'declined'>('idle');

  // Start session immediately on mount
  useEffect(() => {
    startApplySession(jobId)
      .then(setSession)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to start session'));
  }, [jobId]);

  // Poll session status while in active states
  const poll = useCallback(async (id: number) => {
    try {
      const updated = await fetchApplySession(id);
      setSession(updated);
      return updated.status;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    if (!POLLING_STATUSES.includes(session.status)) return;

    const interval = setInterval(async () => {
      const status = await poll(session.id);
      if (!status || !POLLING_STATUSES.includes(status)) {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [session, poll]);

  const handleAutofill = async () => {
    if (!session) return;
    setFilling(true);
    setError(null);
    try {
      const { session: updated, fillResult: result } = await triggerAutofill(session.id);
      setSession(updated);
      setFillHistory((prev) => [...prev, result]);
      // Prompt after autofill completes — ask if they successfully applied
      if (onMarkApplied) setConfirmState('ask');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Autofill failed');
      // Refresh session to get error state
      const updated = await fetchApplySession(session.id).catch(() => null);
      if (updated) setSession(updated);
    } finally {
      setFilling(false);
    }
  };

  const handleConfirmYes = async () => {
    if (!onMarkApplied) return;
    setConfirmState('marking');
    try {
      await onMarkApplied(jobId);
      setConfirmState('done');
      setTimeout(onClose, 1500);
    } catch {
      setConfirmState('ask');
    }
  };

  const handleConfirmNo = () => {
    setConfirmState('declined');
  };

  const status = session?.status ?? 'created';
  const isError = status === 'error' || !!error;
  const canAutofill = status === 'form_detected' && !filling;
  const isBusy = status === 'opening' || status === 'open' || status === 'filling' || filling;
  const stepCount = fillHistory.length;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal card */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Apply with JobPilot</h2>
            <p className="text-sm text-gray-500 mt-0.5">{jobTitle} · {company}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-4 mt-0.5"
          >
            ×
          </button>
        </div>

        {/* Status */}
        <div className="px-6 py-4">
          <div className="flex items-center gap-2.5 mb-1">
            {isBusy && (
              <svg className="w-4 h-4 animate-spin text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {!isBusy && !isError && (status === 'form_detected' || status === 'filled') && (
              <div className="w-4 h-4 rounded-full bg-emerald-500 shrink-0" />
            )}
            {isError && (
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            )}
            <span className={clsx('text-sm font-medium', STATUS_COLOR[status])}>
              {stepCount > 0 && status === 'form_detected'
                ? `Step ${stepCount + 1} detected — ready to autofill`
                : STATUS_LABEL[status]}
            </span>
          </div>

          {/* Guidance: waiting for SPA form */}
          {status === 'open' && (
            <div className="mt-2 ml-6 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-xs text-blue-700 leading-relaxed">
                Waiting for the application form. If you see an <strong>Apply</strong> or <strong>Sign In</strong> button
                in the browser window, complete that step and we'll detect the form automatically.
              </p>
            </div>
          )}

          {/* Dropdown hint: form detected */}
          {status === 'form_detected' && (
            <div className="mt-2 ml-6 p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <p className="text-xs text-amber-700 leading-relaxed">
                This form may contain <strong>Yes/No dropdowns</strong> and custom widgets (sponsorship, work
                authorization, referral, etc.). Autofill will select the most confident answer based on your
                profile. Anything unclear will be skipped and shown below.
              </p>
            </div>
          )}

          {/* Filled guidance: watching for next step */}
          {status === 'filled' && (
            <div className="mt-2 ml-6 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-xs text-blue-700 leading-relaxed">
                Review the fields above, then click <strong>Next</strong> or <strong>Continue</strong> in
                the browser window. New fields on the next step will be detected automatically.
              </p>
            </div>
          )}

          {/* Error detail */}
          {(isError && (error || session?.error_msg)) && (
            <p className="text-xs text-red-500 mt-1 ml-6.5 leading-relaxed">
              {error || session?.error_msg}
            </p>
          )}

          {/* Detected fields */}
          {session?.detected_fields_json && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-600 mb-1.5">
                Detected fields ({JSON.parse(session.detected_fields_json as string).length}):
              </p>
              <div className="flex flex-wrap gap-1">
                {(JSON.parse(session.detected_fields_json as string) as string[]).map((f) => (
                  <span key={f} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fill history — one block per autofill step */}
        {fillHistory.length > 0 && (
          <div className="px-6 pb-4 space-y-4">
            {fillHistory.map((result, idx) => (
              <div key={idx}>
                {fillHistory.length > 1 && (
                  <p className="text-xs font-bold text-gray-500 mb-1.5">Step {idx + 1} results</p>
                )}
                {result.filled.length > 0 && (
                  <div className={fillHistory.length > 1 ? 'ml-2' : ''}>
                    <p className="text-xs font-semibold text-emerald-700 mb-1">
                      Filled ({result.filled.length})
                    </p>
                    <ul className="space-y-0.5">
                      {result.filled.map((f) => (
                        <li key={f} className="flex items-center gap-1.5 text-xs text-gray-700">
                          <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(result.draftNeeded ?? []).length > 0 && (
                  <div className={clsx(fillHistory.length > 1 ? 'ml-2' : '', result.filled.length > 0 ? 'mt-2' : '')}>
                    <p className="text-xs font-semibold text-amber-600 mb-1">
                      Write-in answers needed ({(result.draftNeeded ?? []).length})
                    </p>
                    <ul className="space-y-0.5">
                      {(result.draftNeeded ?? []).map((f) => (
                        <li key={f} className="flex items-center gap-1.5 text-xs text-amber-700">
                          <svg className="w-3 h-3 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.skipped.length > 0 && (
                  <div className={clsx(fillHistory.length > 1 ? 'ml-2' : '', (result.filled.length > 0 || (result.draftNeeded ?? []).length > 0) ? 'mt-2' : '')}>
                    <p className="text-xs font-semibold text-gray-500 mb-1">
                      Needs manual input ({result.skipped.length})
                    </p>
                    <ul className="space-y-0.5">
                      {result.skipped.map((f) => (
                        <li key={f} className="flex items-center gap-1.5 text-xs text-gray-400">
                          <svg className="w-3 h-3 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}

            {/* Post-apply confirmation */}
            {confirmState === 'ask' && (
              <div className="mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                <p className="text-xs font-semibold text-indigo-800 mb-2">
                  Did you apply to this job successfully?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleConfirmYes}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                  >
                    Yes, I applied!
                  </button>
                  <button
                    onClick={handleConfirmNo}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    Not yet
                  </button>
                </div>
              </div>
            )}
            {confirmState === 'marking' && (
              <p className="text-xs text-indigo-600 mt-2 flex items-center gap-1.5">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Marking as applied…
              </p>
            )}
            {confirmState === 'done' && (
              <p className="text-xs font-semibold text-emerald-700 mt-2">
                Moved to Current Jobs!
              </p>
            )}
            {confirmState === 'declined' && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <p className="text-xs text-amber-700">
                  Make sure to come back and submit once you're ready. This job stays in Browse Jobs.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/60">
          <p className="text-xs text-gray-400">
            Forms are never submitted automatically.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleAutofill}
              disabled={!canAutofill}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors',
                canAutofill
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed',
              )}
            >
              {filling ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Filling…
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  {stepCount > 0 ? `Autofill Step ${stepCount + 1}` : 'Autofill'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
