import { useEffect, useMemo, useState } from 'react';
import { FiDownload, FiFolder } from 'react-icons/fi';
import { useUploadFileToFolderMutation } from '../api/google-drive/googleDriveWriteApi';
import type { FolderType } from '../api/firestore/types/shared';
import DriveFolderModal from './DriveFolderModal';

type ExportFormat = 'json' | 'csv';
type ExportScope = 'visible' | 'all';
type ExportDestination = 'download' | 'drive';

export type ExportRow = Record<string, unknown>;

export type ExportListContext = {
  type?: 'collection' | 'wishlist' | 'spare' | 'all' | 'unknown';
  collection?: {
    id?: string;
    name?: string;
  };
  wishlist?: {
    id?: string;
    name?: string;
  };
  isSparseList?: boolean;
  visibility?: 'public' | 'private' | 'mixed';
};

export type ExportJsonMetadata = {
  listContext?: ExportListContext;
  isFiltered?: boolean;
  appliedFilters?: Record<string, unknown>;
  pagination?: {
    page?: number;
    limit?: number | 'all' | null;
  };
};

type ExportListButtonProps = {
  entityLabel: string;
  visibleRows: ExportRow[];
  allRows?: ExportRow[];
  defaultBaseName: string;
  fieldOrder?: string[];
  fieldLabels?: Record<string, string>;
  jsonMetadata?: ExportJsonMetadata;
};

const getTodayDate = () => new Date().toISOString().slice(0, 10);

const sanitizeFilename = (value: string) => {
  const sanitized = value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-');
  return sanitized || 'export';
};

const toCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

const escapeCsv = (value: string) => {
  if (/[,"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const buildCsv = (rows: ExportRow[], fields: string[]) => {
  const header = fields.map(escapeCsv).join(',');
  const body = rows
    .map((row) =>
      fields.map((field) => escapeCsv(toCsvValue(row[field]))).join(',')
    )
    .join('\n');

  return `${header}\n${body}`;
};

function ExportListButton({
  entityLabel,
  visibleRows,
  allRows,
  defaultBaseName,
  fieldOrder = [],
  fieldLabels = {},
  jsonMetadata,
}: ExportListButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('json');
  const [scope, setScope] = useState<ExportScope>('visible');
  const [exportAllFields, setExportAllFields] = useState(true);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [destination, setDestination] = useState<ExportDestination>('download');
  const [selectedFolder, setSelectedFolder] = useState<FolderType | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [uploadFileToFolder, { isLoading: isUploadingToDrive }] =
    useUploadFileToFolderMutation();

  const allScopeRows = allRows || visibleRows;

  const availableFields = useMemo(() => {
    const keys = new Set<string>();
    [...visibleRows, ...allScopeRows].forEach((row) => {
      Object.keys(row).forEach((key) => keys.add(key));
    });

    const baseFields = Array.from(keys);
    const ordered = fieldOrder.filter((field) => keys.has(field));
    const remaining = baseFields
      .filter((field) => !ordered.includes(field))
      .sort((a, b) => a.localeCompare(b));

    return [...ordered, ...remaining];
  }, [allScopeRows, fieldOrder, visibleRows]);

  useEffect(() => {
    if (!isOpen) return;

    const defaultName = `${defaultBaseName}-${getTodayDate()}`;
    setFileName(defaultName);
    setExportAllFields(true);
    setSelectedFields(availableFields);
    setScope('visible');
    setFormat('json');
    setDestination('download');
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [availableFields, defaultBaseName, isOpen]);

  const toggleField = (field: string) => {
    setSelectedFields((previous) => {
      if (previous.includes(field)) {
        return previous.filter((item) => item !== field);
      }
      return [...previous, field];
    });
  };

  const handleDownload = (blob: Blob, nameWithExtension: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nameWithExtension;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const sourceRows = scope === 'visible' ? visibleRows : allScopeRows;
    if (sourceRows.length === 0) {
      setErrorMessage(`No ${entityLabel} available to export.`);
      return;
    }

    const fieldsToUse = exportAllFields ? availableFields : selectedFields;
    if (fieldsToUse.length === 0) {
      setErrorMessage('Choose at least one field to export.');
      return;
    }

    if (destination === 'drive' && !selectedFolder?.id) {
      setErrorMessage('Choose a Drive destination folder before exporting.');
      return;
    }

    const filteredRows = sourceRows.map((row) => {
      const nextRow: ExportRow = {};
      fieldsToUse.forEach((field) => {
        nextRow[field] = row[field];
      });
      return nextRow;
    });

    const extension = format === 'json' ? 'json' : 'csv';
    const safeFileName = sanitizeFilename(fileName);
    const nameWithExtension = `${safeFileName}.${extension}`;

    const hasAppliedFilters = Boolean(jsonMetadata?.isFiltered);
    const isFiltered = hasAppliedFilters || scope === 'visible';
    const appliedFilters = jsonMetadata?.appliedFilters || {};
    const content =
      format === 'json'
        ? JSON.stringify(
            {
              exportDate: new Date().toISOString(),
              entity: entityLabel,
              scope,
              rowCount: filteredRows.length,
              fullList: scope === 'all' && !hasAppliedFilters,
              filtered: isFiltered,
              listContext: {
                type: jsonMetadata?.listContext?.type || 'unknown',
                collection: jsonMetadata?.listContext?.collection,
                wishlist: jsonMetadata?.listContext?.wishlist,
                isSparseList: Boolean(jsonMetadata?.listContext?.isSparseList),
                visibility: jsonMetadata?.listContext?.visibility,
              },
              filters: isFiltered
                ? {
                    applied: appliedFilters,
                    pagination: {
                      page: jsonMetadata?.pagination?.page || 1,
                      limit:
                        jsonMetadata?.pagination?.limit !== undefined
                          ? jsonMetadata?.pagination?.limit
                          : null,
                    },
                  }
                : {
                    applied: {},
                  },
              selectedFields: fieldsToUse,
              rows: filteredRows,
            },
            null,
            2
          )
        : buildCsv(filteredRows, fieldsToUse);

    const mimeType =
      format === 'json' ? 'application/json' : 'text/csv;charset=utf-8';

    if (destination === 'download') {
      handleDownload(new Blob([content], { type: mimeType }), nameWithExtension);
      setSuccessMessage('Export downloaded.');
      return;
    }

    try {
      const file = new File([content], nameWithExtension, { type: mimeType });
      await uploadFileToFolder({
        folderId: selectedFolder?.id || 'root',
        file,
        fileName: nameWithExtension,
      }).unwrap();
      setSuccessMessage('Export saved to Drive.');
    } catch (error) {
      console.error('Drive export failed:', error);
      setErrorMessage('Unable to save export to Drive.');
    }
  };

  return (
    <>
      <button
        className="btn btn-xs"
        onClick={() => setIsOpen(true)}
        title={`Export ${entityLabel}`}
        aria-label={`Export ${entityLabel}`}
      >
        <FiDownload className="w-4 h-4" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[10040] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-base-300 bg-base-100 shadow-xl">
            <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
              <h3 className="text-lg font-semibold">Export {entityLabel}</h3>
              <button className="btn btn-sm btn-circle" onClick={() => setIsOpen(false)}>
                x
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="form-control">
                  <span className="label-text text-xs uppercase opacity-70">
                    Output format
                  </span>
                  <div className="join mt-1">
                    <button
                      type="button"
                      className={`btn btn-sm join-item ${format === 'json' ? 'btn-primary' : ''}`}
                      onClick={() => setFormat('json')}
                    >
                      JSON
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm join-item ${format === 'csv' ? 'btn-primary' : ''}`}
                      onClick={() => setFormat('csv')}
                    >
                      CSV
                    </button>
                  </div>
                </label>

                <label className="form-control">
                  <span className="label-text text-xs uppercase opacity-70">
                    Scope
                  </span>
                  <div className="join mt-1">
                    <button
                      type="button"
                      className={`btn btn-sm join-item ${scope === 'visible' ? 'btn-primary' : ''}`}
                      onClick={() => setScope('visible')}
                    >
                      Visible ({visibleRows.length})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm join-item ${scope === 'all' ? 'btn-primary' : ''}`}
                      onClick={() => setScope('all')}
                    >
                      Entire ({allScopeRows.length})
                    </button>
                  </div>
                </label>
              </div>

              <label className="form-control">
                <span className="label-text text-xs uppercase opacity-70">File name</span>
                <input
                  type="text"
                  className="input input-bordered mt-1"
                  value={fileName}
                  onChange={(event) => setFileName(event.target.value)}
                />
                <span className="label-text-alt mt-1 opacity-70">
                  Extension: .{format}
                </span>
              </label>

              <div className="rounded-lg border border-base-300 p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={exportAllFields}
                    onChange={(event) => setExportAllFields(event.target.checked)}
                  />
                  Export all fields
                </label>

                {!exportAllFields ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {availableFields.map((field) => (
                      <label key={field} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={selectedFields.includes(field)}
                          onChange={() => toggleField(field)}
                        />
                        {fieldLabels[field] || field}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-base-300 p-3 space-y-3">
                <span className="label-text text-xs uppercase opacity-70 block">
                  Destination
                </span>
                <div className="join">
                  <button
                    type="button"
                    className={`btn btn-sm join-item ${destination === 'download' ? 'btn-primary' : ''}`}
                    onClick={() => setDestination('download')}
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm join-item ${destination === 'drive' ? 'btn-primary' : ''}`}
                    onClick={() => setDestination('drive')}
                  >
                    Save to Drive
                  </button>
                </div>

                {destination === 'drive' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => setShowDrivePicker(true)}
                    >
                      <FiFolder className="h-4 w-4" />
                      Choose Drive Folder
                    </button>
                    <span className="text-sm opacity-80">
                      {selectedFolder?.name
                        ? `Selected: ${selectedFolder.name}`
                        : 'No folder selected'}
                    </span>
                  </div>
                ) : null}
              </div>

              {errorMessage ? <div className="alert alert-error py-2">{errorMessage}</div> : null}
              {successMessage ? (
                <div className="alert alert-success py-2">{successMessage}</div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-base-300 px-4 py-3">
              <button className="btn btn-sm" onClick={() => setIsOpen(false)}>
                Cancel
              </button>
              <button
                className={`btn btn-sm btn-primary ${isUploadingToDrive ? 'loading' : ''}`}
                onClick={() => {
                  void handleExport();
                }}
                disabled={isUploadingToDrive}
              >
                Export
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DriveFolderModal
        isOpen={showDrivePicker}
        onClose={() => setShowDrivePicker(false)}
        selectedFolder={selectedFolder}
        onSelectFolder={({ folder }) => {
          setSelectedFolder(folder);
        }}
      />
    </>
  );
}

export default ExportListButton;