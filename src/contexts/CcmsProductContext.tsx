'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

export type CcmsProduct = 'orbi' | 'lora';

const STORAGE_KEY = 'ccms_product';

interface CcmsProductContextValue {
  product: CcmsProduct;
  setProduct: (product: CcmsProduct) => void;
}

const CcmsProductContext = createContext<CcmsProductContextValue | null>(null);

function detectProduct(pathname: string): CcmsProduct {
  return pathname.startsWith('/lora') ? 'lora' : 'orbi';
}

export function CcmsProductProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [product, setProductState] = useState<CcmsProduct>('orbi');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as CcmsProduct | null;
    if (stored === 'orbi' || stored === 'lora') {
      setProductState(stored);
    } else {
      setProductState(detectProduct(pathname));
    }
  }, [pathname]);

  const setProduct = useCallback((next: CcmsProduct) => {
    setProductState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ product, setProduct }), [product, setProduct]);

  return (
    <CcmsProductContext.Provider value={value}>
      {children}
    </CcmsProductContext.Provider>
  );
}

export function useCcmsProduct() {
  const ctx = useContext(CcmsProductContext);
  if (!ctx) throw new Error('useCcmsProduct must be used within CcmsProductProvider');
  return ctx;
}
