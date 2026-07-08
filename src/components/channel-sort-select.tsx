"use client";

import type { ChannelSortKey } from "@/lib/channel-sort";

const SORT_OPTIONS: Array<{ value: ChannelSortKey; label: string }> = [
  { value: "viewers_desc", label: "Viewers: High to low" },
  { value: "viewers_asc", label: "Viewers: Low to high" },
  { value: "name", label: "Name (A\u2013Z)" }
];

type ChannelSortSelectProps = {
  value: ChannelSortKey;
  onChange: (value: ChannelSortKey) => void;
  ariaLabel?: string;
};

export function ChannelSortSelect({ value, onChange, ariaLabel = "Sort channels" }: ChannelSortSelectProps) {
  return (
    <label className="sort-select">
      <span className="sort-select-label">Sort</span>
      <select
        className="text-input compact-input select-input"
        value={value}
        onChange={(event) => onChange(event.target.value as ChannelSortKey)}
        aria-label={ariaLabel}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
