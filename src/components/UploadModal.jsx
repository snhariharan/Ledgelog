import React, { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';

function UploadModal({ onClose }) {
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState(null);
  const ref = useRef();
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal-box" style={{maxWidth:440}}>
        <div className="modal-hdr">
          <div className="modal-ttl"><Upload size={15} style={{color:'var(--blue)'}}/> Import Transactions</div>
          <button className="modal-close" onClick={onClose}><X size={15}/></button>
        </div>
        <div className="modal-body">
          <div className={`drop-zone ${drag?'dragover':''}`}
            onDragOver={e=>{e.preventDefault();setDrag(true);}}
            onDragLeave={()=>setDrag(false)}
            onDrop={e=>{e.preventDefault();setDrag(false);setFile(e.dataTransfer.files[0]);}}
            onClick={()=>ref.current.click()}>
            <input ref={ref} type="file" accept=".csv,.qif,.ofx,.qfx" hidden onChange={e=>setFile(e.target.files[0])}/>
            <Upload size={32} style={{opacity:.35,marginBottom:'0.5rem'}}/>
            {file
              ? <><b style={{color:'var(--blue)'}}>{file.name}</b><small>Ready to import</small></>
              : <><b>Drag & drop or click to browse</b><small>CSV · QIF · OFX · QFX</small></>
            }
          </div>
        </div>
        <div className="modal-ftr">
          <button className="btn-sec" onClick={onClose}>Cancel</button>
          <button className="btn-pri" onClick={onClose} disabled={!file} style={{opacity:file?1:0.45}}>
            <Upload size={13}/> Import
          </button>
        </div>
      </div>
    </div>
  );
}
export default UploadModal;
