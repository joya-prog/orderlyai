import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  BookOpen,
  Pencil,
  Trash2,
  Download,
  Link,
  FileText,
  AlignLeft,
  Upload,
  Loader2,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import type { KbCollection, KbSource } from "@shared/schema";

type CollectionWithCount = KbCollection & { sourceCount: number };

type QueuedSource =
  | { type: "url"; url: string; name: string }
  | { type: "pdf"; file: File }
  | { type: "text"; name: string; content: string };

type AddSubForm = null | "url" | "pdf" | "text";

export default function KnowledgeBase() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const [subForm, setSubForm] = useState<AddSubForm>(null);
  const [collectionName, setCollectionName] = useState("");
  const [queuedSources, setQueuedSources] = useState<QueuedSource[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: collections = [], isLoading: collectionsLoading } = useQuery<CollectionWithCount[]>({
    queryKey: ["/api/kb"],
  });

  const selected = collections.find((c) => c.id === selectedId) ?? (collections.length > 0 ? collections[0] : null);
  const effectiveId = selected?.id ?? null;

  const { data: sources = [], isLoading: sourcesLoading } = useQuery<KbSource[]>({
    queryKey: ["/api/kb", effectiveId, "sources"],
    enabled: !!effectiveId,
  });

  const createCollectionMutation = useMutation({
    mutationFn: async (name: string) =>
      apiRequest<KbCollection>("POST", "/api/kb", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kb"] });
    },
  });

  const renameCollectionMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      apiRequest<KbCollection>("PATCH", `/api/kb/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kb"] });
      setIsEditingName(false);
      toast({ title: "Renamed", description: "Collection renamed successfully." });
    },
  });

  const deleteCollectionMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/kb/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kb"] });
      setSelectedId(null);
      toast({ title: "Deleted", description: "Collection deleted." });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async ({ collectionId, sourceId }: { collectionId: string; sourceId: string }) =>
      apiRequest("DELETE", `/api/kb/${collectionId}/sources/${sourceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kb", effectiveId, "sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kb"] });
    },
  });

  const resetDialog = () => {
    setIsAddDialogOpen(false);
    setCollectionName("");
    setQueuedSources([]);
    setSubForm(null);
    setUrlInput("");
    setTextTitle("");
    setTextContent("");
    setAddPopoverOpen(false);
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    setQueuedSources((prev) => [...prev, { type: "url", url: urlInput.trim(), name: urlInput.trim() }]);
    setUrlInput("");
    setSubForm(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQueuedSources((prev) => [...prev, { type: "pdf", file }]);
    setSubForm(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddText = () => {
    if (!textTitle.trim() || !textContent.trim()) return;
    setQueuedSources((prev) => [...prev, { type: "text", name: textTitle.trim(), content: textContent.trim() }]);
    setTextTitle("");
    setTextContent("");
    setSubForm(null);
  };

  const handleSave = async () => {
    if (!collectionName.trim()) {
      toast({ title: "Name required", description: "Please enter a name for the knowledge base.", variant: "destructive" });
      return;
    }
    try {
      const col = await createCollectionMutation.mutateAsync(collectionName.trim());
      for (const src of queuedSources) {
        if (src.type === "url") {
          await apiRequest("POST", `/api/kb/${col.id}/sources`, { type: "url", url: src.url });
        } else if (src.type === "pdf") {
          const fd = new FormData();
          fd.append("type", "pdf");
          fd.append("file", src.file);
          const resp = await fetch(`/api/kb/${col.id}/sources`, {
            method: "POST",
            body: fd,
            credentials: "include",
          });
          if (!resp.ok) throw new Error("PDF upload failed");
        } else if (src.type === "text") {
          await apiRequest("POST", `/api/kb/${col.id}/sources`, { type: "text", name: src.name, content: src.content });
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/kb"] });
      setSelectedId(col.id);
      resetDialog();
      toast({ title: "Created", description: "Knowledge base created successfully." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to create knowledge base.", variant: "destructive" });
    }
  };

  const handleStartRename = () => {
    if (!selected) return;
    setEditNameValue(selected.name);
    setIsEditingName(true);
  };

  const handleConfirmRename = () => {
    if (!selected || !editNameValue.trim()) return;
    renameCollectionMutation.mutate({ id: selected.id, name: editNameValue.trim() });
  };

  const handleCopyId = () => {
    if (!selected) return;
    navigator.clipboard.writeText(selected.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    return `${Math.round(bytes / 1024)} K`;
  };

  const formatDate = (d: Date | string | null | undefined) => {
    if (!d) return "";
    const date = new Date(d as string);
    return (
      date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }) +
      " " +
      date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
    );
  };

  const isSaving = createCollectionMutation.isPending;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="w-64 border-r flex flex-col flex-shrink-0 bg-background">
        <div className="flex items-center justify-between px-4 py-3 border-b gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Knowledge Base</span>
          </div>
          <Button
            size="icon"
            variant="default"
            data-testid="button-add-kb"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {collectionsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : collections.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">No knowledge bases yet</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAddDialogOpen(true)}
                data-testid="button-create-first-kb"
              >
                <Plus className="w-3 h-3 mr-1" /> Create one
              </Button>
            </div>
          ) : (
            <div className="py-1">
              {collections.map((col) => {
                const isActive = effectiveId === col.id;
                return (
                  <button
                    key={col.id}
                    data-testid={`item-kb-${col.id}`}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors hover-elevate ${
                      isActive
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-foreground"
                    }`}
                    onClick={() => setSelectedId(col.id)}
                  >
                    <BookOpen className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    <span className="truncate">{col.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <BookOpen className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-lg font-medium text-muted-foreground">No knowledge base selected</p>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              data-testid="button-create-kb-empty"
            >
              <Plus className="w-4 h-4 mr-2" /> Create your first knowledge base
            </Button>
          </div>
        ) : (
          <>
            {/* Right panel header */}
            <div className="px-6 py-4 border-b flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                {isEditingName ? (
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Input
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      className="text-xl font-bold max-w-xs"
                      data-testid="input-rename-kb"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); handleConfirmRename(); }
                        if (e.key === "Escape") setIsEditingName(false);
                      }}
                      onBlur={(e) => {
                        if (!e.relatedTarget || !(e.relatedTarget as HTMLElement).dataset?.testid?.startsWith("button-confirm")) {
                          handleConfirmRename();
                        }
                      }}
                      autoFocus
                    />
                    <Button
                      size="default"
                      onClick={handleConfirmRename}
                      disabled={renameCollectionMutation.isPending}
                      data-testid="button-confirm-rename"
                    >
                      {renameCollectionMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                    </Button>
                    <Button size="default" variant="ghost" onClick={() => setIsEditingName(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <h1 className="text-xl font-bold text-foreground truncate">{selected.name}</h1>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    ID: {selected.id.slice(0, 10)}...
                  </span>
                  <button
                    onClick={handleCopyId}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-copy-id"
                  >
                    {copiedId ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    Created: {formatDate(selected.createdAt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="default"
                  variant="default"
                  onClick={handleStartRename}
                  data-testid="button-edit-kb"
                >
                  <Pencil className="w-4 h-4 mr-1.5" /> Edit
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => deleteCollectionMutation.mutate(selected.id)}
                  disabled={deleteCollectionMutation.isPending}
                  data-testid="button-delete-kb"
                >
                  {deleteCollectionMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Sources list */}
            <ScrollArea className="flex-1 px-6 py-4">
              {sourcesLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : sources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <FileText className="w-10 h-10 text-muted-foreground/30" />
                  <p className="text-base font-medium text-muted-foreground">No sources yet</p>
                  <p className="text-sm text-muted-foreground">Add PDFs, web pages, or text articles to this knowledge base.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {sources.map((src) => (
                    <SourceRow
                      key={src.id}
                      source={src}
                      onDelete={() =>
                        deleteSourceMutation.mutate({
                          collectionId: selected.id,
                          sourceId: src.id,
                        })
                      }
                      deleting={deleteSourceMutation.isPending}
                      formatFileSize={formatFileSize}
                    />
                  ))}
                </div>
              )}

              <div className="mt-6">
                <AddSourceInline
                  collectionId={effectiveId!}
                  onAdded={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/kb", effectiveId, "sources"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/kb"] });
                  }}
                />
              </div>
            </ScrollArea>
          </>
        )}
      </div>

      {/* Add KB Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => { if (!open) resetDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Knowledge Base</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Knowledge Base Name</label>
              <Input
                placeholder="Enter name..."
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                data-testid="input-kb-name"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Documents</label>

              {/* Queued items */}
              {queuedSources.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-1">
                  {queuedSources.map((src, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
                      {src.type === "url" && <Link className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                      {src.type === "pdf" && <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />}
                      {src.type === "text" && <AlignLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                      <span className="text-sm truncate flex-1">
                        {src.type === "url" ? src.url : src.type === "pdf" ? src.file.name : src.name}
                      </span>
                      <button
                        onClick={() => setQueuedSources((prev) => prev.filter((_, j) => j !== i))}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        data-testid={`button-remove-queued-${i}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Sub-forms */}
              {subForm === "url" && (
                <div className="flex gap-2 flex-wrap">
                  <Input
                    placeholder="https://..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    data-testid="input-url"
                    className="flex-1 min-w-0"
                    onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
                  />
                  <Button size="default" onClick={handleAddUrl} data-testid="button-confirm-url">
                    Confirm
                  </Button>
                  <Button size="default" variant="ghost" onClick={() => setSubForm(null)}>
                    Cancel
                  </Button>
                </div>
              )}

              {subForm === "text" && (
                <div className="flex flex-col gap-2 border rounded-md p-3">
                  <Input
                    placeholder="Article Title"
                    value={textTitle}
                    onChange={(e) => setTextTitle(e.target.value)}
                    data-testid="input-text-title"
                  />
                  <Textarea
                    placeholder="Content..."
                    rows={5}
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    data-testid="input-text-content"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button size="default" variant="ghost" onClick={() => setSubForm(null)}>
                      Cancel
                    </Button>
                    <Button size="default" onClick={handleAddText} data-testid="button-add-article">
                      Add Article
                    </Button>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-file"
              />

              {subForm !== "url" && subForm !== "text" && (
                <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="default"
                      className="w-fit"
                      data-testid="button-add-source"
                    >
                      <Plus className="w-4 h-4 mr-1.5" /> Add
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-1" align="start">
                    <button
                      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-md hover-elevate text-left"
                      data-testid="option-add-url"
                      onClick={() => { setSubForm("url"); setAddPopoverOpen(false); }}
                    >
                      <div className="mt-0.5 w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0">
                        <Link className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Add Web Pages</p>
                        <p className="text-xs text-muted-foreground">Crawl and sync your website</p>
                      </div>
                    </button>
                    <button
                      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-md hover-elevate text-left"
                      data-testid="option-upload-files"
                      onClick={() => { setAddPopoverOpen(false); setTimeout(() => fileInputRef.current?.click(), 50); }}
                    >
                      <div className="mt-0.5 w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Upload Files</p>
                        <p className="text-xs text-muted-foreground">File size should be less than 100MB</p>
                      </div>
                    </button>
                    <button
                      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-md hover-elevate text-left"
                      data-testid="option-add-text"
                      onClick={() => { setSubForm("text"); setAddPopoverOpen(false); }}
                    >
                      <div className="mt-0.5 w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0">
                        <AlignLeft className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Add Text</p>
                        <p className="text-xs text-muted-foreground">Add articles manually</p>
                      </div>
                    </button>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetDialog} data-testid="button-cancel-kb">
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                data-testid="button-save-kb"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SourceRow({
  source,
  onDelete,
  deleting,
  formatFileSize,
}: {
  source: KbSource;
  onDelete: () => void;
  deleting: boolean;
  formatFileSize: (b: number | null | undefined) => string;
}) {
  return (
    <div
      className="group flex items-center gap-3 border rounded-md px-4 py-3 bg-background hover-elevate"
      data-testid={`row-source-${source.id}`}
    >
      <div className="flex-shrink-0">
        {source.type === "pdf" && (
          <div className="w-9 h-9 bg-red-100 dark:bg-red-900/30 rounded-md flex flex-col items-center justify-center">
            <span className="text-[9px] font-bold text-red-600 dark:text-red-400 leading-none">PDF</span>
          </div>
        )}
        {source.type === "url" && <Link className="w-5 h-5 text-primary" />}
        {source.type === "text" && <AlignLeft className="w-5 h-5 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{source.name}</p>
        {source.type === "pdf" && source.fileSizeBytes && (
          <p className="text-xs text-muted-foreground">{formatFileSize(source.fileSizeBytes)}</p>
        )}
        {source.type === "url" && source.url && (
          <p className="text-xs text-muted-foreground truncate">{source.url}</p>
        )}
      </div>
      <div className="flex items-center gap-1 invisible group-hover:visible">
        {source.type === "url" && source.url && (
          <Button
            size="icon"
            variant="ghost"
            asChild
            data-testid={`button-open-source-${source.id}`}
          >
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        )}
        
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          disabled={deleting}
          data-testid={`button-delete-source-${source.id}`}
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

function AddSourceInline({
  collectionId,
  onAdded,
}: {
  collectionId: string;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [subForm, setSubForm] = useState<AddSubForm>(null);
  const [urlInput, setUrlInput] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addSource = async (payload: any, form?: FormData) => {
    setIsLoading(true);
    try {
      if (form) {
        const resp = await fetch(`/api/kb/${collectionId}/sources`, {
          method: "POST",
          body: form,
          credentials: "include",
        });
        if (!resp.ok) throw new Error("Upload failed");
      } else {
        await apiRequest("POST", `/api/kb/${collectionId}/sources`, payload);
      }
      onAdded();
      setSubForm(null);
      setUrlInput("");
      setTextTitle("");
      setTextContent("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to add source.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    addSource({ type: "url", url: urlInput.trim() });
  };

  const handleAddText = () => {
    if (!textTitle.trim() || !textContent.trim()) return;
    addSource({ type: "text", name: textTitle.trim(), content: textContent.trim() });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("type", "pdf");
    fd.append("file", file);
    addSource(null, fd);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div>
      {subForm === "url" && (
        <div className="flex gap-2 mb-3 flex-wrap">
          <Input
            placeholder="https://..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            data-testid="input-inline-url"
            className="flex-1 min-w-0"
            onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
          />
          <Button size="default" onClick={handleAddUrl} disabled={isLoading} data-testid="button-inline-confirm-url">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
          </Button>
          <Button size="default" variant="ghost" onClick={() => setSubForm(null)}>Cancel</Button>
        </div>
      )}

      {subForm === "text" && (
        <div className="flex flex-col gap-2 border rounded-md p-3 mb-3">
          <Input
            placeholder="Article Title"
            value={textTitle}
            onChange={(e) => setTextTitle(e.target.value)}
            data-testid="input-inline-text-title"
          />
          <Textarea
            placeholder="Content..."
            rows={4}
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            data-testid="input-inline-text-content"
          />
          <div className="flex gap-2 justify-end">
            <Button size="default" variant="ghost" onClick={() => setSubForm(null)}>Cancel</Button>
            <Button size="default" onClick={handleAddText} disabled={isLoading} data-testid="button-inline-add-article">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Article"}
            </Button>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} data-testid="input-inline-file" />

      {subForm === null && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="default" data-testid="button-add-source-inline">
              <Plus className="w-4 h-4 mr-1.5" /> Add source
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-1" align="start">
            <button
              className="w-full flex items-start gap-3 px-3 py-2.5 rounded-md hover-elevate text-left"
              data-testid="option-inline-add-url"
              onClick={() => { setSubForm("url"); setPopoverOpen(false); }}
            >
              <div className="mt-0.5 w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0">
                <Link className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-sm font-medium">Add Web Pages</p>
                <p className="text-xs text-muted-foreground">Crawl and sync your website</p>
              </div>
            </button>
            <button
              className="w-full flex items-start gap-3 px-3 py-2.5 rounded-md hover-elevate text-left"
              data-testid="option-inline-upload-files"
              onClick={() => { setPopoverOpen(false); setTimeout(() => fileInputRef.current?.click(), 50); }}
            >
              <div className="mt-0.5 w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0">
                <Upload className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-sm font-medium">Upload Files</p>
                <p className="text-xs text-muted-foreground">File size should be less than 100MB</p>
              </div>
            </button>
            <button
              className="w-full flex items-start gap-3 px-3 py-2.5 rounded-md hover-elevate text-left"
              data-testid="option-inline-add-text"
              onClick={() => { setSubForm("text"); setPopoverOpen(false); }}
            >
              <div className="mt-0.5 w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0">
                <AlignLeft className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-sm font-medium">Add Text</p>
                <p className="text-xs text-muted-foreground">Add articles manually</p>
              </div>
            </button>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
