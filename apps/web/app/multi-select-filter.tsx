"use client";

import { useEffect, useRef, useState } from "react";

type MultiSelectFilterProps = {
  id: string;
  label: string;
  name: string;
  options: readonly string[];
  selectedValues: string[];
  allLabel: string;
};

export function MultiSelectFilter({
  id,
  label,
  name,
  options,
  selectedValues,
  allLabel,
}: MultiSelectFilterProps) {
  const [selected, setSelected] = useState(selectedValues);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? selected[0]
        : `${selected[0]} +${selected.length - 1}`;

  return (
    <div className="filterField multiSelect" ref={rootRef}>
      <label htmlFor={id}>{label}</label>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="multiSelectTrigger"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        onClick={() => setOpen((current) => !current)}
        disabled={options.length === 0}
      >
        <span>{summary}</span>
        <span className="multiSelectChevron" aria-hidden="true" />
      </button>
      <div
        id={`${id}-options`}
        className="multiSelectMenu"
        role="group"
        aria-label={`Selecionar ${label.toLowerCase()}`}
        hidden={!open}
      >
        {options.map((option) => (
          <label key={option} className="multiSelectOption">
            <input
              type="checkbox"
              name={name}
              value={option}
              checked={selected.includes(option)}
              onChange={() =>
                setSelected((current) =>
                  current.includes(option)
                    ? current.filter((value) => value !== option)
                    : [...current, option],
                )
              }
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
