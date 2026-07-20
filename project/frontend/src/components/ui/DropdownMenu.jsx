import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import './DropdownMenu.css';

export function DropdownMenu({ items }) {
  const [open, setOpen] = useState(false);
  // En viewports chicos (mobile) el menú puede no entrar debajo del trigger:
  // en ese caso se abre hacia arriba para que no quede cortado por el borde
  // inferior de la pantalla.
  const [openUpward, setOpenUpward] = useState(false);
  const wrapRef = useRef(null);
  const menuRef = useRef(null);

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

  // Se mide con el menú ya montado (offsetHeight real) pero antes del paint,
  // así el flip no produce parpadeo.
  useLayoutEffect(() => {
    if (!open) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight || 200;
    const spaceBelow = window.innerHeight - rect.bottom;
    // Solo se abre hacia arriba si no entra abajo Y arriba hay más lugar
    // (si no entra de ningún lado, mejor abajo que recortado contra el header).
    setOpenUpward(spaceBelow < menuHeight && rect.top > spaceBelow);
  }, [open]);

  return (
    <div className="comment-menu-wrap" ref={wrapRef}>
      <button
        className="comment-menu-btn"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Más opciones"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
        </svg>
      </button>

      {open && (
        <div
          className={`comment-dropdown${openUpward ? ' comment-dropdown--up' : ''}`}
          ref={menuRef}
        >
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
