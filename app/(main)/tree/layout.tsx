import { ReactNode } from 'react';
import { TreeDataProvider } from '@/components/tree/TreeDataProvider';

export default function TreeLayout({ children }: { children: ReactNode }) {
  return <TreeDataProvider>{children}</TreeDataProvider>;
}
