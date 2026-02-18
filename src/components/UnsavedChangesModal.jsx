import { AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function UnsavedChangesModal({ onDiscard, onStay }) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-6 max-w-md w-full">
        <div className="flex items-start gap-3 mb-6">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-[#c0c0c0] font-bold text-lg mb-2">Unsaved changes</h3>
            <p className="text-[#888] text-sm">
              You have unsaved changes. Do you want to discard them?
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <Button
            onClick={onStay}
            variant="outline"
            className="bg-[#111] border-[#2a2a2a] text-[#888] hover:text-[#c0c0c0]"
          >
            Stay
          </Button>
          <Button
            onClick={onDiscard}
            className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50"
          >
            Discard
          </Button>
        </div>
      </div>
    </div>
  );
}