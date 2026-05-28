import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Ctx = {
  companyId: string | null;
  branchId: string | null;
  setCompanyId: (id: string | null) => void;
  setBranchId: (id: string | null) => void;
};

const BranchContext = createContext<Ctx | null>(null);

export function BranchProvider({ children }: { children: ReactNode }) {
  const [companyId, setCompanyIdState] = useState<string | null>(null);
  const [branchId, setBranchIdState] = useState<string | null>(null);

  useEffect(() => {
    try {
      setCompanyIdState(window.localStorage.getItem("active_company_id"));
      setBranchIdState(window.localStorage.getItem("active_branch_id"));
    } catch {}
  }, []);

  const setCompanyId = (id: string | null) => {
    setCompanyIdState(id);
    try {
      if (id) window.localStorage.setItem("active_company_id", id);
      else window.localStorage.removeItem("active_company_id");
    } catch {}
  };

  const setBranchId = (id: string | null) => {
    setBranchIdState(id);
    try {
      if (id) window.localStorage.setItem("active_branch_id", id);
      else window.localStorage.removeItem("active_branch_id");
    } catch {}
  };

  return (
    <BranchContext.Provider value={{ companyId, branchId, setCompanyId, setBranchId }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useBranch must be used inside BranchProvider");
  return ctx;
}
