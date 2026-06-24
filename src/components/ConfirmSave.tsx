import React, { createContext, useContext } from 'react';

const ConfirmSaveContext = createContext<any>(null);

export const ConfirmSaveProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ConfirmSaveContext.Provider value={{}}>
      {children}
    </ConfirmSaveContext.Provider>
  );
};

export const useConfirmSave = () => useContext(ConfirmSaveContext);
