import { useEffect, useId, useRef, useState } from 'react';
import { MdHelpOutline } from 'react-icons/md';
import { uiText } from 'lib/translations';
import './naturalHelp.scss';

export default function NaturalHelp({ kind, editing }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null),
    panel = useRef(null);
  const id = useId();
  useEffect(() => {
    const node = panel.current;
    if (!open) {
      if (node?.matches(':popover-open')) node.hidePopover();
      return undefined;
    }
    const position = () => {
      const box = trigger.current.getBoundingClientRect();
      const width = Math.min(380, window.innerWidth - 32);
      node.style.width = `${width}px`;
      node.style.left = `${Math.max(16, Math.min(box.right - width, window.innerWidth - width - 16))}px`;
      node.style.top = `${box.bottom + 8}px`;
      node.style.maxHeight = `${Math.max(120, window.innerHeight - box.bottom - 24)}px`;
    };
    position();
    if (!node.matches(':popover-open')) node.showPopover();
    window.addEventListener('resize', position);
    return () => {
      window.removeEventListener('resize', position);
      if (node.matches(':popover-open')) node.hidePopover();
    };
  }, [open]);
  const rows =
    kind === 'planning'
      ? ['dates']
      : kind === 'task'
        ? ['dates', 'notes', 'status']
        : [
            'dates',
            'times',
            'duration',
            'location',
            'notes',
            ...(!editing ? ['repeat', 'calendar'] : []),
          ];
  return (
    <div
      className="gwNaturalHelp"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (open && event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="gwNaturalHelpTrigger"
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
      >
        {uiText('natural_format')}
        <MdHelpOutline aria-hidden="true" />
      </button>
      <div ref={panel} id={id} popover="manual" role="tooltip" className="gwNaturalHelpPanel">
        <p>{uiText(kind === 'planning' ? 'planning_natural_help_intro' : 'natural_help_intro')}</p>
        <dl>
          {rows.map((row) => (
            <div key={row}>
              <dt>{uiText(`natural_help_${row}_title`)}</dt>
              <dd>{uiText(`natural_help_${row}`)}</dd>
            </div>
          ))}
        </dl>
        <p>
          {uiText(
            kind === 'planning'
              ? 'planning_natural_help_limit'
              : kind === 'task'
                ? 'natural_help_task_limit'
                : editing
                  ? 'natural_help_event_edit_limit'
                  : 'natural_help_event_limit',
          )}
        </p>
        <p>
          {uiText(kind === 'planning' ? 'planning_natural_help_manual' : 'natural_help_manual')}
        </p>
      </div>
    </div>
  );
}
