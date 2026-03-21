import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

export function useConfirm() {
  const [state, setState] = useState({ open: false, message: '', onConfirm: null });

  const confirm = (message) => new Promise((resolve) => {
    setState({ open: true, message, onConfirm: (result) => {
      setState({ open: false, message: '', onConfirm: null });
      resolve(result);
    }});
  });

  const Dialog = () => state.open ? (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-sm text-[#c0c0c0] leading-relaxed">{state.message}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => state.onConfirm(false)}
            className="flex-1 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] text-[#888] text-sm font-medium hover:bg-white/[0.08] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => state.onConfirm(true)}
            className="flex-1 h-10 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, Dialog };
}
