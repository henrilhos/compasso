"use client";

import { useEffect, useRef, useState } from "react";

type SingleSelectFilterProps = {
  id: string;
  label: string;
  name: string;
  options: readonly { value: string; label: string }[];
  selectedValue: string;
};

export function SingleSelectFilter({
  id,
  label,
  name,
  options,
  selectedValue,
}: SingleSelectFilterProps) {
  const [selected, setSelected] = useState(selectedValue);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    selectedInputRef.current?.focus();

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

  return (
    <div className="filterField filterDropdown" ref={rootRef}>
      <label htmlFor={id}>{label}</label>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="filterTrigger"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{options.find((option) => option.value === selected)?.label}</span>
        <span className="filterChevron" aria-hidden="true" />
      </button>
      <div
        id={`${id}-options`}
        className="filterMenu"
        role="radiogroup"
        aria-label={label}
        hidden={!open}
      >
        {options.map((option) => (
          <label key={option.value} className="filterOption">
            <input
              ref={option.value === selected ? selectedInputRef : undefined}
              type="radio"
              name={name}
              value={option.value}
              checked={selected === option.value}
              onChange={() => {
                setSelected(option.value);
                setOpen(false);
                triggerRef.current?.focus();
              }}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
