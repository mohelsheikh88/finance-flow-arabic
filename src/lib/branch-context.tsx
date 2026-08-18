import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export type DataScope =
  | { mode: "branch"; branchId: string; companyId: string }
  | { mode: "company"; companyId: string };

/**
 * The correct data-filtering scope for the branch the user is CURRENTLY
 * working in — the single shared rule every module (medical or otherwise)
 * must use when querying branch-scoped data:
 *
 *  - Normal branch (e.g. "الفيحاء"): only its own rows (`branch_id = X`).
 *  - The Head Office branch (`is_main = true`): every row across every
 *    branch of the same company — a consolidated, company-wide view.
 *
 * Usage:
 *   const scope = useDataScope();
 *   let q = supabase.from("patients").select("*");
 *   q = scope?.mode === "company" ? q.eq("company_id", scope.companyId) : q.eq("branch_id", scope?.branchId);
 */
export function useDataScope(): DataScope | undefined {
  const { branchId } = useBranch();

  const { data: activeBranch } = useQuery({
    queryKey: ["active-branch-scope", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, is_main, company_id")
        .eq("id", branchId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (!branchId || !activeBranch) return undefined;
  if (activeBranch.is_main) return { mode: "company", companyId: activeBranch.company_id };
  return { mode: "branch", branchId, companyId: activeBranch.company_id };
}
