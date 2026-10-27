"use client";

import { createContext, useContext, useState } from "react";

/** Lets the decision panel know the administrator is mid-edit, so nobody approves stale, unsaved data. */
const Ctx = createContext<{ editing: boolean; setEditing: (v: boolean) => void }>({ editing: false, setEditing: () => {} });
export const useEditGuard = () => useContext(Ctx);

export function EditGuard({ children }: { children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  return <Ctx.Provider value={{ editing, setEditing }}>{children}</Ctx.Provider>;
}
