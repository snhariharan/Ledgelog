import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/** Small shared modal shell: Escape / backdrop click closes. */
export default function Modal({ title, onClose, children, maxWidth = 440 }) {
  useEffect(() => {
    const esc = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}><X size={14}/></button>
        </div>
        <div style={{ padding: '1.25rem' }}>{children}</div>
      </div>
    </div>
  );
}
