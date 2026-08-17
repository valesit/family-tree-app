'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Modal } from '@/components/ui';
import { FileImage, FileText, Loader2, X } from 'lucide-react';
import type { TreeNode as TreeNodeType } from '@/types';
import { TreeNode, type TreeNodeExportFields } from './TreeNode';
import { TreeViewProvider } from './TreeViewContext';

interface ExportTreeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** The full tree currently rendered on the page. */
  tree: TreeNodeType | null;
  /** Live capture target — used when the user picks "Match what's on screen". */
  liveCanvasRef?: React.RefObject<HTMLElement | null>;
  /** Default family name suggested in the file name. */
  familyName?: string | null;
}

type ExportMode = 'match' | 'customize';
type Format = 'png' | 'pdf';

function flatNodes(tree: TreeNodeType | null): TreeNodeType[] {
  if (!tree) return [];
  const out: TreeNodeType[] = [];
  const walk = (n: TreeNodeType) => {
    out.push(n);
    (n.spouses ?? []).forEach((s) => out.push(s));
    if (n.spouse && !(n.spouses ?? []).some((s) => s.id === n.spouse!.id)) {
      out.push(n.spouse);
    }
    (n.children ?? []).forEach(walk);
  };
  walk(tree);
  // Dedupe by id, keep first occurrence.
  const seen = new Set<string>();
  return out.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
}

function findSubtree(tree: TreeNodeType | null, id: string): TreeNodeType | null {
  if (!tree) return null;
  if (tree.id === id) return tree;
  for (const c of tree.children ?? []) {
    const hit = findSubtree(c, id);
    if (hit) return hit;
  }
  return null;
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').toLowerCase() || 'family-tree';
}

export function ExportTreeDialog({
  isOpen,
  onClose,
  tree,
  liveCanvasRef,
  familyName,
}: ExportTreeDialogProps) {
  const [mode, setMode] = useState<ExportMode>('match');
  const [startWith, setStartWith] = useState<string>('');
  const [levels, setLevels] = useState<'all' | number>('all');
  const [fields, setFields] = useState<TreeNodeExportFields>({
    photo: true,
    dates: false,
    birthplace: false,
    occupation: false,
  });
  const [busyFormat, setBusyFormat] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Offscreen capture container (rendered into the same document via portal).
  const captureRef = useRef<HTMLDivElement>(null);
  const [portalReady, setPortalReady] = useState(false);

  const allPeople = useMemo(() => flatNodes(tree), [tree]);

  // Seed startWith with the current tree root when it loads / changes.
  useEffect(() => {
    if (tree && !startWith) {
      setStartWith(tree.id);
    }
  }, [tree, startWith]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setBusyFormat(null);
      setPortalReady(typeof document !== 'undefined');
    }
  }, [isOpen]);

  const handleDownload = async (format: Format) => {
    if (!tree) return;
    setError(null);
    setBusyFormat(format);
    try {
      const htmlToImage = await import('html-to-image');
      let dataUrl: string;

      if (mode === 'match') {
        const el = liveCanvasRef?.current;
        if (!el) throw new Error('Tree canvas is not available to capture.');
        dataUrl = await htmlToImage.toPng(el as HTMLElement, {
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          cacheBust: true,
        });
      } else {
        // Wait one tick for the offscreen render to commit.
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        const el = captureRef.current;
        if (!el) throw new Error('Export preview is not ready yet — try again.');
        dataUrl = await htmlToImage.toPng(el, {
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          cacheBust: true,
        });
      }

      const base = sanitizeFilename(`${familyName ?? 'family'}-tree`);
      if (format === 'png') {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${base}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const { default: JsPDF } = await import('jspdf');
        // Determine the image dimensions to choose orientation.
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Could not decode export image.'));
          img.src = dataUrl;
        });
        const orientation = img.width >= img.height ? 'landscape' : 'portrait';
        const pdf = new JsPDF({ orientation, unit: 'pt', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 24;
        const maxW = pageW - margin * 2;
        const maxH = pageH - margin * 2;
        const ratio = Math.min(maxW / img.width, maxH / img.height);
        const drawW = img.width * ratio;
        const drawH = img.height * ratio;
        const x = (pageW - drawW) / 2;
        const y = (pageH - drawH) / 2;
        pdf.addImage(dataUrl, 'PNG', x, y, drawW, drawH);
        pdf.save(`${base}.pdf`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusyFormat(null);
    }
  };

  const subtreeForCustom = useMemo(() => {
    if (mode !== 'customize') return null;
    if (!startWith) return tree;
    return findSubtree(tree, startWith);
  }, [mode, startWith, tree]);

  const maxLevels = levels === 'all' ? undefined : levels;

  const noop = () => undefined;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="md" title="Download Family Tree">
        <div className="space-y-5">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <fieldset className="space-y-2">
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="export-mode"
                value="match"
                checked={mode === 'match'}
                onChange={() => setMode('match')}
                className="mt-1"
              />
              <span>
                <span className="font-medium">Match export to what is on screen</span>
                <span className="block text-xs text-slate-500">
                  Captures the tree exactly as it currently appears in the canvas.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="export-mode"
                value="customize"
                checked={mode === 'customize'}
                onChange={() => setMode('customize')}
                className="mt-1"
              />
              <span>
                <span className="font-medium">Customize export</span>
                <span className="block text-xs text-slate-500">
                  Choose who to start with, how many generations, and which fields to include.
                </span>
              </span>
            </label>
          </fieldset>

          {mode === 'customize' && (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1" htmlFor="export-start-with">
                  Start with
                </label>
                <select
                  id="export-start-with"
                  value={startWith}
                  onChange={(e) => setStartWith(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500"
                >
                  {allPeople.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1" htmlFor="export-levels">
                  Levels to export
                </label>
                <select
                  id="export-levels"
                  value={typeof levels === 'number' ? String(levels) : 'all'}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLevels(v === 'all' ? 'all' : parseInt(v, 10));
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500"
                >
                  <option value="all">All generations</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'level' : 'levels'}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset>
                <legend className="block text-xs font-medium text-slate-700 mb-2">Include</legend>
                <div className="grid grid-cols-2 gap-2">
                  <CheckboxRow label="Name" checked disabled hint="Always included" />
                  <CheckboxRow
                    label="Photo"
                    checked={!!fields.photo}
                    onChange={(v) => setFields((f) => ({ ...f, photo: v }))}
                  />
                  <CheckboxRow
                    label="Dates"
                    checked={!!fields.dates}
                    onChange={(v) => setFields((f) => ({ ...f, dates: v }))}
                  />
                  <CheckboxRow
                    label="Occupation"
                    checked={!!fields.occupation}
                    onChange={(v) => setFields((f) => ({ ...f, occupation: v }))}
                  />
                </div>
              </fieldset>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => handleDownload('pdf')}
                disabled={busyFormat !== null || !tree}
                variant="outline"
              >
                {busyFormat === 'pdf' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <FileText className="mr-2 h-4 w-4" aria-hidden />
                )}
                Download PDF
              </Button>
              <Button
                type="button"
                onClick={() => handleDownload('png')}
                disabled={busyFormat !== null || !tree}
              >
                {busyFormat === 'png' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <FileImage className="mr-2 h-4 w-4" aria-hidden />
                )}
                Download PNG
              </Button>
            </div>
            <Button type="button" variant="ghost" onClick={onClose}>
              <X className="mr-1 h-4 w-4" aria-hidden />
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Offscreen capture container — used only for 'customize' mode. Mounted via portal
          so it's part of the same document but visually out of the way. */}
      {portalReady && isOpen && mode === 'customize' && subtreeForCustom &&
        createPortal(
          <div
            aria-hidden
            style={{
              position: 'fixed',
              left: -99999,
              top: 0,
              padding: 24,
              background: '#ffffff',
              pointerEvents: 'none',
            }}
          >
            <div ref={captureRef}>
              <TreeViewProvider>
                <TreeNode
                  node={subtreeForCustom}
                  onNodeClick={noop}
                  expandedNodes={new Set<string>()}
                  toggleExpanded={noop}
                  level={0}
                  isRoot
                  exportMode
                  exportFields={fields}
                  maxLevels={maxLevels}
                />
              </TreeViewProvider>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
  disabled = false,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-maroon-600 focus:ring-maroon-500 disabled:opacity-60"
      />
      <span>
        {label}
        {hint && <span className="ml-1 text-[10px] text-slate-400">({hint})</span>}
      </span>
    </label>
  );
}
