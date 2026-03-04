import clsx from 'clsx';
import type { FilterState, PostedAge, WorkModel, JobSource, SortBy } from '../types';

interface FilterPanelProps {
  filters: FilterState;
  onChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}

const POSTED_AGE: { value: PostedAge; label: string }[] = [
  { value: '1d', label: 'Today' },
  { value: '3d', label: '3 days' },
  { value: '1w', label: '1 week' },
  { value: '1m', label: '1 month' },
];

const WORK_MODELS: WorkModel[] = ['Remote', 'Hybrid', 'On-site'];

const SOURCES: { value: JobSource; label: string }[] = [
  { value: 'GitHub', label: 'GitHub' },
  { value: 'Greenhouse', label: 'Greenhouse' },
  { value: 'Lever', label: 'Lever' },
  { value: 'ATS', label: 'ATS' },
  { value: 'Manual', label: 'Manual' },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'newest_posted', label: 'Newest posted' },
  { value: 'newest_discovered', label: 'Newest discovered' },
  { value: 'company_az', label: 'Company A–Z' },
];

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap',
        active
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600',
      )}
    >
      {children}
    </button>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-7 px-2.5 text-xs border border-gray-200 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 w-32"
    />
  );
}

export default function FilterPanel({ filters, onChange, onClear, hasActiveFilters }: FilterPanelProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3 space-y-2.5">
      {/* Row 1: Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange('search', e.target.value)}
          placeholder="Search companies, titles, locations…"
          className="w-full h-9 pl-9 pr-4 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
        />
        {filters.search && (
          <button
            onClick={() => onChange('search', '')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Row 2: All filter controls */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Posted age */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Posted:</span>
          <div className="flex gap-1">
            {POSTED_AGE.map((opt) => (
              <PillButton
                key={opt.value}
                active={filters.postedAge === opt.value}
                onClick={() =>
                  onChange('postedAge', filters.postedAge === opt.value ? '' : opt.value)
                }
              >
                {opt.label}
              </PillButton>
            ))}
          </div>
        </div>

        <div className="w-px h-4 bg-gray-200" />

        {/* Work model */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Model:</span>
          <div className="flex gap-1">
            {WORK_MODELS.map((m) => (
              <PillButton
                key={m}
                active={filters.workModel === m}
                onClick={() => onChange('workModel', filters.workModel === m ? '' : m)}
              >
                {m}
              </PillButton>
            ))}
          </div>
        </div>

        <div className="w-px h-4 bg-gray-200" />

        {/* Text filters */}
        <TextInput
          value={filters.location}
          onChange={(v) => onChange('location', v)}
          placeholder="Location…"
        />
        <TextInput
          value={filters.company}
          onChange={(v) => onChange('company', v)}
          placeholder="Company…"
        />

        {/* Source dropdown */}
        <select
          value={filters.source}
          onChange={(e) => onChange('source', e.target.value as JobSource | '')}
          className="h-7 px-2 text-xs border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
        >
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {/* Active only toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters.activeOnly}
            onChange={(e) => onChange('activeOnly', e.target.checked)}
            className="w-3.5 h-3.5 rounded text-indigo-600 border-gray-300 focus:ring-indigo-400"
          />
          <span className="text-xs text-gray-600 font-medium whitespace-nowrap">Active only</span>
        </label>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Sort:</span>
          <select
            value={filters.sortBy}
            onChange={(e) => onChange('sortBy', e.target.value as SortBy)}
            className="h-7 px-2 text-xs border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clear */}
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-2 whitespace-nowrap"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
