import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type ConfirmOptions = {
  title?: string;
  summary?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type ConfirmContextType = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmSaveContext = createContext<ConfirmContextType>(async () => true);

export const ConfirmSaveProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({});
  const [resolver, setResolver] = useState<(value: boolean) => void>(() => {});

  const confirmSave = (opts: ConfirmOptions) => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolver(() => (value: boolean) => resolve(value));
    });
  };

  const handleConfirm = () => {
    setOpen(false);
    resolver(true);
  };

  const handleCancel = () => {
    setOpen(false);
    resolver(false);
  };

  return (
    <ConfirmSaveContext.Provider value={confirmSave}>
      {children}
      <Dialog open={open} onOpenChange={(val) => { if (!val) handleCancel(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{options.title || "Confirm"}</DialogTitle>
            <DialogDescription>{options.summary}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              {options.cancelLabel || "Cancel"}
            </Button>
            <Button onClick={handleConfirm}>
              {options.confirmLabel || "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmSaveContext.Provider>
  );
};

export const useConfirmSave = () => useContext(ConfirmSaveContext);
