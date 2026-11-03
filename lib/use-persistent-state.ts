"use client";

import { useEffect, useState } from "react";
import { readLocal, writeLocal } from "@/lib/client-api";

/**
 * Como useState, pero recuerda el valor en este navegador (localStorage).
 * Para vistas que el usuario elige y espera encontrar igual al volver: no se
 * pierden al cambiar de sección (el panel se desmonta) ni al recargar la página.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readLocal(key, initial));
  useEffect(() => writeLocal(key, value), [key, value]);
  return [value, setValue] as const;
}
