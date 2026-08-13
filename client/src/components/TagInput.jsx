import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';

const MAX_TAG_LENGTH = 32;
const MAX_TAGS_PER_ITEM = 20;

function normalizeTagName(raw) {
  if (raw == null) return null;
  const name = String(raw).trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH);
  return name || null;
}

function tagChipClass(active) {
  return active
    ? 'rounded-full border border-amber-500/60 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400'
    : 'rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-xs text-slate-300';
}

export function TagChip({ name, to, onClick, onRemove, active = false, title }) {
  const className = `${tagChipClass(active)} inline-flex max-w-full items-center gap-1`;
  const label = (
    <span className="truncate" title={title || name}>
      {name}
    </span>
  );

  if (to) {
    return (
      <Link to={to} className={`${className} hover:border-amber-500/60`}>
        {label}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} hover:border-amber-500/60`}>
        {label}
      </button>
    );
  }

  return (
    <span className={className}>
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${name}`}
          className="rounded-full text-slate-500 hover:text-slate-200"
        >
          ×
        </button>
      )}
    </span>
  );
}

function addTagToList(list, raw, vocabulary = []) {
  const name = normalizeTagName(raw);
  if (!name) return list;
  if (list.length >= MAX_TAGS_PER_ITEM) return list;
  const key = name.toLowerCase();
  if (list.some((tag) => tag.toLowerCase() === key)) return list;
  const existing = vocabulary.find((entry) => {
    const candidate = typeof entry === 'string' ? entry : entry?.name;
    return candidate && candidate.toLowerCase() === key;
  });
  const canonical = typeof existing === 'string' ? existing : existing?.name || name;
  return [...list, canonical];
}

export default function TagInput({ value = [], onChange, disabled = false, id }) {
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/items/tags')
      .then((res) => {
        if (!cancelled) setSuggestions(res.data.tags || []);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleClick(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = Array.isArray(value) ? value : [];

  const matches = useMemo(() => {
    const list = Array.isArray(value) ? value : [];
    const q = draft.trim().toLowerCase();
    const selectedKeys = new Set(list.map((tag) => tag.toLowerCase()));
    return suggestions
      .filter((tag) => !selectedKeys.has(tag.name.toLowerCase()))
      .filter((tag) => !q || tag.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [suggestions, value, draft]);

  const commit = (raw) => {
    const next = addTagToList(selected, raw, suggestions);
    if (next !== selected) onChange(next);
    setDraft('');
    setHighlight(0);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (open && matches[highlight]) {
        commit(matches[highlight].name);
      } else {
        commit(draft);
      }
      return;
    }
    if (event.key === 'Backspace' && draft === '' && selected.length) {
      event.preventDefault();
      onChange(selected.slice(0, -1));
      return;
    }
    if (event.key === 'ArrowDown' && matches.length) {
      event.preventDefault();
      setOpen(true);
      setHighlight((i) => (i + 1) % matches.length);
      return;
    }
    if (event.key === 'ArrowUp' && matches.length) {
      event.preventDefault();
      setOpen(true);
      setHighlight((i) => (i - 1 + matches.length) % matches.length);
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const handlePaste = (event) => {
    const text = event.clipboardData?.getData('text');
    if (!text || !text.includes(',')) return;
    event.preventDefault();
    let next = selected;
    for (const part of text.split(/[,;\n]/)) {
      next = addTagToList(next, part, suggestions);
    }
    if (next !== selected) onChange(next);
    setDraft('');
  };

  const atLimit = selected.length >= MAX_TAGS_PER_ITEM;

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={`flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 ${
          disabled ? 'opacity-60' : ''
        }`}
      >
        {selected.map((tag) => (
          <TagChip
            key={tag.toLowerCase()}
            name={tag}
            onRemove={disabled ? undefined : () => onChange(selected.filter((t) => t !== tag))}
          />
        ))}
        <input
          id={id}
          type="text"
          value={draft}
          disabled={disabled || atLimit}
          maxLength={MAX_TAG_LENGTH}
          placeholder={
            atLimit
              ? 'Tag limit reached'
              : selected.length
                ? 'Add another…'
                : 'Type a tag and press Enter'
          }
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-slate-600"
          aria-autocomplete="list"
          aria-expanded={open && matches.length > 0}
        />
      </div>
      {open && matches.length > 0 && !atLimit && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-md border border-slate-700 bg-slate-900 py-1 shadow-lg"
        >
          {matches.map((tag, index) => (
            <li key={tag.name}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlight}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                  index === highlight ? 'bg-slate-800 text-amber-300' : 'text-slate-200'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(tag.name);
                }}
              >
                <span>{tag.name}</span>
                <span className="text-xs text-slate-500">{tag.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
