import { useRef, useState, useEffect } from 'react';
import './DropdownMenu.css';

export function DropdownMenu({ items }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  return (
    <div className="comment-menu-wrap" ref={wrapRef}>
      <button
        className="comment-menu-btn"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
        </svg>
      </button>

      {open && (
        <div className="comment-dropdown">
          {items.map((item, index) => (
            <button
              key={index}
              className={`comment-dropdown-item${item.danger ? ' comment-dropdown-item--danger' : ''}`}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.icon && item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
