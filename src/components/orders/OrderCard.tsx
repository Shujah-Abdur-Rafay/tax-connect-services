import React, { useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  Clock,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Calendar,
  User,
  Mail,
  Phone,
  FileText,
  CheckCircle2,
  PlayCircle,
  Send,
  XCircle,
  Loader2,
  CreditCard,
  ShieldCheck,
  ExternalLink,
  Lock,
  Undo2,
  AlertTriangle,
  Paperclip,
  Download,
  X,
  UploadCloud,
  Image as ImageIcon,
  FileSpreadsheet,
  FileArchive,
  File as FileIcon,
} from 'lucide-react';

import {
  ORDER_STATUS_META,
  type GigOrderRecord,
  type GigOrderStatus,
  type GigOrderDeliveryFile,
  type GigOrderSourceFile,
} from '@/services/gigOrdersService';
import {
  uploadGigDeliverable,
  deleteGigDeliverable,
  uploadGigSourceDoc,
  deleteGigSourceDoc,
} from '@/services/firebaseStorageService';
import { useToast } from '@/hooks/use-toast';

interface OrderCardProps {
  order: GigOrderRecord;
  perspective: 'pro' | 'client';
  onUpdateStatus: (
    orderId: string,
    status: GigOrderStatus,
    extra?: { deliveryMessage?: string; deliveryFiles?: GigOrderDeliveryFile[] }
  ) => Promise<void>;
  /** Pro-only: send the order to Stripe Checkout (transitions new → awaiting_payment). */
  onRequestPayment?: (orderId: string) => Promise<void>;
  /** Client-only: open the stored Stripe Checkout URL. */
  onPayNow?: (order: GigOrderRecord) => void;
  /**
   * Refund handler (used by both perspectives). Calls the refund-gig-order
   * edge function via gigOrdersService.refundGigOrder(...).
   */
  onRefund?: (orderId: string, reason: string) => Promise<void>;
  /**
   * Client-only: persist a batch of already-uploaded source documents
   * (W-2s, 1099s, etc.) to the order's source_files array. Implementations
   * typically call gigOrdersService.addOrderSourceFiles(...).
   */
  onAddSourceFiles?: (orderId: string, files: GigOrderSourceFile[]) => Promise<void>;
  /**
   * Client-only: remove one source document by storagePath. Implementations
   * typically call gigOrdersService.removeOrderSourceFile(...).
   */
  onRemoveSourceFile?: (orderId: string, storagePath: string) => Promise<void>;
}


const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const fmtDateOnly = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const daysUntil = (iso?: string | null): number | null => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const fmtBytes = (n: number): string => {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

const FileGlyph: React.FC<{ contentType: string; className?: string }> = ({
  contentType,
  className = 'h-4 w-4 text-violet-600 shrink-0',
}) => {
  if (contentType.startsWith('image/')) return <ImageIcon className={className} />;
  if (contentType === 'application/pdf') return <FileText className={className} />;
  if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType.includes('csv'))
    return <FileSpreadsheet className={className} />;
  if (contentType.includes('zip') || contentType.includes('compressed'))
    return <FileArchive className={className} />;
  return <FileIcon className={className} />;
};


const OrderCard: React.FC<OrderCardProps> = ({
  order,
  perspective,
  onUpdateStatus,
  onRequestPayment,
  onPayNow,
  onRefund,
  onAddSourceFiles,
  onRemoveSourceFile,
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceInputRef = useRef<HTMLInputElement | null>(null);

  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [deliveryMessage, setDeliveryMessage] = useState('');
  const [showDeliver, setShowDeliver] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [refundReason, setRefundReason] = useState('');

  // Files the pro has already uploaded for THIS delivery (not yet committed
  // to the Firestore order — that happens when they click Send delivery).
  const [pendingFiles, setPendingFiles] = useState<GigOrderDeliveryFile[]>([]);
  const [uploading, setUploading] = useState(false);

  // Source-document upload state (client-side only)
  const [uploadingSource, setUploadingSource] = useState(false);
  const [removingSourcePath, setRemovingSourcePath] = useState<string | null>(null);

  const meta = ORDER_STATUS_META[order.status];
  const due = daysUntil(order.delivery_due_at);
  const overdue =
    due !== null &&
    due < 0 &&
    !['completed', 'cancelled', 'awaiting_payment'].includes(order.status);
  const isPaid = order.payment_status === 'paid';
  const isRefunded = order.payment_status === 'refunded';
  const canDeliver = order.status === 'in_progress' && isPaid;
  const deliveredFiles = order.delivery_files || [];
  const sourceFiles = order.source_files || [];

  // The client may attach source documents while the order hasn't started yet.
  // (After payment clears + work begins, attachments are locked — they should
  // message the pro instead.)
  const clientCanAttachSources =
    perspective === 'client' &&
    !isRefunded &&
    ['new', 'awaiting_payment'].includes(order.status);

  // Refund eligibility — mirrors the service-side checks so we don't render
  // dead buttons.
  const proCanRefund =
    perspective === 'pro' &&
    !isRefunded &&
    ['awaiting_payment', 'in_progress', 'delivered'].includes(order.status);
  const clientCanRefund =
    perspective === 'client' && !isRefunded && order.status === 'delivered';

  const run = async (
    status: GigOrderStatus,
    extra?: { deliveryMessage?: string; deliveryFiles?: GigOrderDeliveryFile[] }
  ) => {
    setBusy(status);
    try {
      await onUpdateStatus(order.id, status, extra);
    } finally {
      setBusy(null);
      if (status === 'delivered') {
        setShowDeliver(false);
        setDeliveryMessage('');
        setPendingFiles([]);
      }
    }
  };

  const acceptAndRequestPayment = async () => {
    if (!onRequestPayment) return;
    setBusy('request_payment');
    try {
      await onRequestPayment(order.id);
    } finally {
      setBusy(null);
    }
  };

  const submitRefund = async () => {
    if (!onRefund) return;
    if (perspective === 'client' && !refundReason.trim()) {
      // Force clients to supply a reason; pros may refund without a reason.
      return;
    }
    setBusy('refund');
    try {
      await onRefund(order.id, refundReason.trim());
      setShowRefund(false);
      setRefundReason('');
    } finally {
      setBusy(null);
    }
  };

  // ── Deliverable uploads ─────────────────────────────────────────────────
  const handleFilesPicked = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    const files = Array.from(filesList);
    // Soft cap to avoid runaway uploads from a fat-fingered select-all.
    const MAX_PER_DELIVERY = 12;
    const MAX_BYTES = 25 * 1024 * 1024; // 25 MB per file

    if (pendingFiles.length + files.length > MAX_PER_DELIVERY) {
      toast({
        title: 'Too many files',
        description: `You can attach up to ${MAX_PER_DELIVERY} files per delivery.`,
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        if (file.size > MAX_BYTES) {
          toast({
            title: `"${file.name}" is too large`,
            description: `Max 25 MB per file. This one is ${fmtBytes(file.size)}.`,
            variant: 'destructive',
          });
          continue;
        }
        try {
          const uploaded = await uploadGigDeliverable(order.id, file);
          setPendingFiles((prev) => [...prev, uploaded]);
        } catch (e: any) {
          toast({
            title: `Upload failed: ${file.name}`,
            description: e?.message || 'Firebase Storage rejected the upload.',
            variant: 'destructive',
          });
        }
      }
    } finally {
      setUploading(false);
      // Reset the input so picking the same file twice still fires onChange.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePendingFile = async (idx: number) => {
    const f = pendingFiles[idx];
    if (!f) return;
    // Best-effort cleanup; if it fails we still drop it from the staging list.
    try {
      await deleteGigDeliverable(f.storagePath);
    } catch {
      /* ignore */
    }
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const sendDelivery = () => {
    if (uploading) return;
    run('delivered', {
      deliveryMessage,
      deliveryFiles: pendingFiles,
    });
  };

  // ── Source-document uploads (client side) ───────────────────────────────
  const handleSourceFilesPicked = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    if (!onAddSourceFiles) return;
    const files = Array.from(filesList);

    const MAX_PER_BATCH = 12;
    const MAX_BYTES = 25 * 1024 * 1024; // 25 MB per file (matches Storage rule)
    const MAX_TOTAL = 24;               // soft cap of 24 files per order

    if (files.length > MAX_PER_BATCH) {
      toast({
        title: 'Too many files at once',
        description: `Please attach up to ${MAX_PER_BATCH} files per batch.`,
        variant: 'destructive',
      });
      return;
    }
    if (sourceFiles.length + files.length > MAX_TOTAL) {
      toast({
        title: 'Source-doc limit reached',
        description: `This order already has ${sourceFiles.length} source documents — max ${MAX_TOTAL}.`,
        variant: 'destructive',
      });
      return;
    }

    setUploadingSource(true);
    const uploaded: GigOrderSourceFile[] = [];
    try {
      for (const file of files) {
        if (file.size > MAX_BYTES) {
          toast({
            title: `"${file.name}" is too large`,
            description: `Max 25 MB per file. This one is ${fmtBytes(file.size)}.`,
            variant: 'destructive',
          });
          continue;
        }
        try {
          const meta = await uploadGigSourceDoc(order.id, file);
          uploaded.push(meta);
        } catch (e: any) {
          toast({
            title: `Upload failed: ${file.name}`,
            description: e?.message || 'Firebase Storage rejected the upload.',
            variant: 'destructive',
          });
        }
      }

      if (uploaded.length > 0) {
        try {
          await onAddSourceFiles(order.id, uploaded);
          toast({
            title: 'Documents attached',
            description: `${uploaded.length} file${uploaded.length === 1 ? '' : 's'} sent to your pro.`,
          });
        } catch (e: any) {
          // Firestore commit failed — clean up the orphaned Storage objects so
          // we don't leak files the pro can technically still read.
          await Promise.all(
            uploaded.map((u) => deleteGigSourceDoc(u.storagePath).catch(() => undefined))
          );
          toast({
            title: 'Could not attach documents',
            description: e?.message || 'Please try again.',
            variant: 'destructive',
          });
        }
      }
    } finally {
      setUploadingSource(false);
      if (sourceInputRef.current) sourceInputRef.current.value = '';
    }
  };

  const handleRemoveSourceFile = async (storagePath: string) => {
    if (!onRemoveSourceFile) return;
    setRemovingSourcePath(storagePath);
    try {
      await onRemoveSourceFile(order.id, storagePath);
      // Best-effort Storage cleanup; if it fails (e.g. file already gone) we
      // still kept the Firestore array in sync, so we don't surface the error.
      deleteGigSourceDoc(storagePath).catch(() => undefined);
    } catch (e: any) {
      toast({
        title: 'Could not remove file',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRemovingSourcePath(null);
    }
  };


  return (
    <Card className={`overflow-hidden ${isRefunded ? 'border-red-200' : ''}`}>
      <div className="flex flex-col gap-4 p-4 md:flex-row">
        {/* Cover */}
        <div className="relative h-28 w-full overflow-hidden rounded-lg bg-gray-100 md:h-20 md:w-32">
          {order.gig_image ? (
            <img
              src={order.gig_image}
              alt={order.gig_title}
              className={`h-full w-full object-cover ${isRefunded ? 'opacity-60 grayscale' : ''}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
              No image
            </div>
          )}
          {isRefunded && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-900/30 text-[10px] font-semibold uppercase tracking-wider text-white">
              Refunded
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
            <Badge variant="outline" className="text-xs">{order.tier.name}</Badge>

            {/* Refunded takes priority over Paid */}
            {isRefunded ? (
              <Badge
                variant="outline"
                className="bg-red-100 text-red-700 border-red-200 text-xs inline-flex items-center gap-1"
              >
                <Undo2 className="h-3 w-3" /> Refunded · ${order.refund_amount ?? order.price}
              </Badge>
            ) : (
              isPaid && (
                <Badge
                  variant="outline"
                  className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs inline-flex items-center gap-1"
                >
                  <ShieldCheck className="h-3 w-3" /> Paid · ${order.price}
                </Badge>
              )
            )}

            {order.status === 'awaiting_payment' && !isPaid && !isRefunded && (
              <Badge
                variant="outline"
                className="bg-orange-50 text-orange-700 border-orange-200 text-xs inline-flex items-center gap-1"
              >
                <CreditCard className="h-3 w-3" /> Payment pending
              </Badge>
            )}

            {deliveredFiles.length > 0 && (
              <Badge
                variant="outline"
                className="bg-violet-50 text-violet-700 border-violet-200 text-xs inline-flex items-center gap-1"
              >
                <Paperclip className="h-3 w-3" /> {deliveredFiles.length} file
                {deliveredFiles.length === 1 ? '' : 's'}
              </Badge>
            )}

            {sourceFiles.length > 0 && (
              <Badge
                variant="outline"
                className="bg-sky-50 text-sky-700 border-sky-200 text-xs inline-flex items-center gap-1"
                title="Source documents attached by the client"
              >
                <Paperclip className="h-3 w-3" /> {sourceFiles.length} source doc
                {sourceFiles.length === 1 ? '' : 's'}
              </Badge>
            )}


            {overdue && !isRefunded && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                Overdue
              </Badge>
            )}
            <span className="text-[10px] uppercase tracking-wide text-gray-400">
              #{order.id.slice(0, 8)}
            </span>
          </div>
          <h3 className="line-clamp-1 font-semibold text-gray-900">{order.gig_title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> ${order.price}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Due {fmtDateOnly(order.delivery_due_at)}
              {due !== null && !['completed', 'cancelled', 'awaiting_payment'].includes(order.status) && (
                <span className={overdue ? 'text-red-600 font-medium' : 'text-gray-500'}>
                  ({overdue ? `${Math.abs(due)}d late` : `${due}d left`})
                </span>
              )}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> Placed {fmtDate(order.created_at)}
            </span>
            {isPaid && !isRefunded && order.paid_at && (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <ShieldCheck className="h-3 w-3" /> Paid {fmtDate(order.paid_at)}
              </span>
            )}
            {isRefunded && order.refunded_at && (
              <span className="inline-flex items-center gap-1 text-red-700">
                <Undo2 className="h-3 w-3" /> Refunded {fmtDate(order.refunded_at)}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm">
            {perspective === 'pro' ? (
              <span className="inline-flex items-center gap-1 text-gray-700">
                <User className="h-3 w-3" /> {order.client_name || 'Client'} ·{' '}
                <span className="text-gray-500">{order.client_email}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-gray-700">
                <User className="h-3 w-3" /> {order.pro_name || 'Tax Pro'}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Pro: Accept new order → creates Stripe Checkout, transitions to awaiting_payment */}
          {!isRefunded && perspective === 'pro' && order.status === 'new' && (
            <Button
              size="sm"
              onClick={acceptAndRequestPayment}
              disabled={busy === 'request_payment' || !onRequestPayment}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {busy === 'request_payment' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <PlayCircle className="mr-1 h-3 w-3" /> Accept &amp; request payment
                </>
              )}
            </Button>
          )}

          {/* Pro: Awaiting payment — informational pill */}
          {!isRefunded && perspective === 'pro' && order.status === 'awaiting_payment' && (
            <Button
              size="sm"
              variant="outline"
              disabled
              className="text-orange-700 border-orange-200 bg-orange-50"
            >
              <Lock className="mr-1 h-3 w-3" /> Awaiting client payment
            </Button>
          )}

          {/* Client: Pay now (opens Stripe Checkout) */}
          {!isRefunded &&
            perspective === 'client' &&
            order.status === 'awaiting_payment' &&
            order.checkout_url && (
              <Button
                size="sm"
                onClick={() => onPayNow?.(order)}
                disabled={!!busy}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <CreditCard className="mr-1 h-3 w-3" /> Pay ${order.price}
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            )}

          {/* Pro: Deliver (only when paid + in_progress) */}
          {!isRefunded && perspective === 'pro' && order.status === 'in_progress' && (
            <Button
              size="sm"
              onClick={() => canDeliver && setShowDeliver((v) => !v)}
              disabled={!!busy || !canDeliver}
              title={!canDeliver ? 'Payment must clear before you can deliver' : undefined}
              className={
                canDeliver
                  ? 'bg-violet-600 hover:bg-violet-700'
                  : 'bg-gray-300 text-gray-600 cursor-not-allowed hover:bg-gray-300'
              }
            >
              {canDeliver ? (
                <>
                  <Send className="mr-1 h-3 w-3" /> Deliver
                </>
              ) : (
                <>
                  <Lock className="mr-1 h-3 w-3" /> Locked until paid
                </>
              )}
            </Button>
          )}

          {/* Client: Accept delivery */}
          {!isRefunded && perspective === 'client' && order.status === 'delivered' && (
            <Button
              size="sm"
              onClick={() => run('completed')}
              disabled={!!busy}
              className="bg-green-600 hover:bg-green-700"
            >
              {busy === 'completed' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Accept delivery
                </>
              )}
            </Button>
          )}

          {/* Client: Request refund (delivered only) */}
          {clientCanRefund && onRefund && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRefund((v) => !v)}
              disabled={!!busy}
              className="text-red-700 border-red-200 hover:bg-red-50"
            >
              <Undo2 className="mr-1 h-3 w-3" /> Request refund
            </Button>
          )}

          {/* Pro: Refund client (awaiting_payment / in_progress / delivered) */}
          {proCanRefund && onRefund && isPaid && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRefund((v) => !v)}
              disabled={!!busy}
              className="text-red-700 border-red-200 hover:bg-red-50"
            >
              <Undo2 className="mr-1 h-3 w-3" /> Refund client
            </Button>
          )}

          {/* Cancel buttons — only when no money has moved (client never paid). */}
          {!isRefunded &&
            !isPaid &&
            ((perspective === 'pro' &&
              ['new', 'awaiting_payment'].includes(order.status)) ||
              (perspective === 'client' &&
                ['new', 'awaiting_payment'].includes(order.status))) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm('Cancel this order? This cannot be undone.')) run('cancelled');
                }}
                disabled={!!busy}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <XCircle className="mr-1 h-3 w-3" /> Cancel
              </Button>
            )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <>
                <ChevronUp className="mr-1 h-3 w-3" /> Hide
              </>
            ) : (
              <>
                <ChevronDown className="mr-1 h-3 w-3" /> Details
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Refunded summary strip */}
      {isRefunded && (
        <div className="border-t bg-red-50/70 px-4 py-2 text-xs text-red-800">
          <div className="flex flex-wrap items-center gap-2">
            <Undo2 className="h-3 w-3 text-red-600" />
            <strong>${order.refund_amount ?? order.price}</strong> refunded to client
            {order.refund_initiated_by && (
              <span className="text-red-700">
                · initiated by {order.refund_initiated_by === 'pro' ? 'the pro' : 'the client'}
              </span>
            )}
            {order.stripe_refund_id && (
              <span className="font-mono text-[10px] text-red-700/80">
                · {order.stripe_refund_id}
              </span>
            )}
          </div>
          {order.refund_reason && (
            <div className="mt-1 text-red-700">“{order.refund_reason}”</div>
          )}
        </div>
      )}

      {/* Payment-pending hint strip */}
      {!isRefunded && order.status === 'awaiting_payment' && !isPaid && (
        <div className="border-t bg-orange-50/60 px-4 py-2 text-xs text-orange-800">
          {perspective === 'client' ? (
            <span className="inline-flex items-center gap-1">
              <CreditCard className="h-3 w-3" />
              Pay <strong className="px-1">${order.price}</strong> securely with Stripe to start work.
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Work begins as soon as the client completes Stripe checkout.
            </span>
          )}
        </div>
      )}

      {/* Deliver form (with file attachments) */}
      {showDeliver && perspective === 'pro' && canDeliver && (
        <div className="border-t bg-violet-50/40 p-4">
          <p className="mb-2 text-sm font-medium text-gray-700">Delivery message to client</p>
          <Textarea
            value={deliveryMessage}
            onChange={(e) => setDeliveryMessage(e.target.value)}
            placeholder="Hi! Your return is ready — please review the attached documents and accept the delivery."
            rows={3}
          />

          {/* File picker */}
          <div className="mt-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-600">
              Attach deliverables
            </p>
            <p className="mb-2 text-[11px] text-gray-500">
              Completed tax return, signed Form 8879, supporting schedules, etc.
              Only you and the client can download these files (Storage rule
              enforced).
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFilesPicked(e.target.files)}
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.heic,.csv,.xls,.xlsx,.doc,.docx,.txt,.zip,application/pdf,image/*"
            />
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="border-violet-300 text-violet-800 hover:bg-violet-100"
            >
              {uploading ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <UploadCloud className="mr-1 h-3 w-3" />
              )}
              {uploading ? 'Uploading…' : 'Choose files'}
            </Button>

            {/* Staged file list */}
            {pendingFiles.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {pendingFiles.map((f, i) => (
                  <li
                    key={f.storagePath}
                    className="flex items-center justify-between gap-2 rounded-md border border-violet-200 bg-white px-2 py-1.5 text-xs"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FileGlyph contentType={f.contentType} className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                      <span className="min-w-0 truncate font-medium text-gray-900">
                        {f.name}
                      </span>
                      <span className="shrink-0 text-gray-500">{fmtBytes(f.size)}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => removePendingFile(i)}
                      className="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Remove file"
                      disabled={uploading}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {uploading && (
              <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-violet-700">
                <Loader2 className="h-3 w-3 animate-spin" /> Uploading to secure storage…
              </p>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={sendDelivery}
              disabled={busy === 'delivered' || uploading}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {busy === 'delivered' ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Send className="mr-1 h-3 w-3" />
              )}
              Send delivery{pendingFiles.length > 0 ? ` (${pendingFiles.length} file${pendingFiles.length === 1 ? '' : 's'})` : ''}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                // Note: we don't auto-delete pendingFiles from Storage on
                // close because the pro might re-open and still want them.
                setShowDeliver(false);
              }}
              disabled={uploading || busy === 'delivered'}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Refund form */}
      {showRefund && onRefund && (proCanRefund || clientCanRefund) && (
        <div className="border-t border-red-200 bg-red-50/50 p-4">
          <div className="mb-2 flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-900">
                {perspective === 'pro'
                  ? `Refund $${order.price} back to ${order.client_name || 'the client'}?`
                  : `Request a refund of $${order.price}?`}
              </p>
              <p className="mt-0.5 text-xs text-red-700">
                {perspective === 'pro'
                  ? 'This sends the full payment back via Stripe and cancels the order. Stripe refunds can take 5–10 business days to appear on the client’s card.'
                  : 'Your pro and Stripe will process the refund. Please tell us what went wrong so we can improve.'}
              </p>
            </div>
          </div>
          <Textarea
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder={
              perspective === 'pro'
                ? 'Optional internal note (e.g. "scope changed, refunded in good faith")'
                : 'Tell the pro what went wrong (required)'
            }
            rows={3}
            className="bg-white"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={submitRefund}
              disabled={
                busy === 'refund' ||
                (perspective === 'client' && !refundReason.trim())
              }
              className="bg-red-600 hover:bg-red-700"
            >
              {busy === 'refund' ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Undo2 className="mr-1 h-3 w-3" />
              )}
              {perspective === 'pro' ? 'Confirm refund' : 'Submit refund request'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowRefund(false);
                setRefundReason('');
              }}
              disabled={busy === 'refund'}
            >
              Never mind
            </Button>
            {perspective === 'client' && !refundReason.trim() && (
              <span className="self-center text-[11px] text-red-700">
                Reason required
              </span>
            )}
          </div>
        </div>
      )}

      {/* Expanded details */}
      <Collapsible open={expanded}>
        <CollapsibleContent>
          <div className="border-t bg-gray-50/60 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Package
                </p>
                <div className="rounded-md border bg-white p-3 text-sm">
                  <div className="font-medium">
                    {order.tier.name} — ${order.tier.price}
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    {order.tier.deliveryDays}d delivery · {order.tier.revisions} revisions
                  </div>
                  {order.stripe_payment_intent_id && (
                    <div className="mt-2 text-[10px] text-gray-500 font-mono break-all">
                      PI: {order.stripe_payment_intent_id}
                    </div>
                  )}
                  {order.stripe_refund_id && (
                    <div className="mt-1 text-[10px] text-red-600 font-mono break-all">
                      RF: {order.stripe_refund_id}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {perspective === 'pro' ? 'Client contact' : 'Tax pro'}
                </p>
                <div className="rounded-md border bg-white p-3 text-sm space-y-1">
                  {perspective === 'pro' ? (
                    <>
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-gray-400" />
                        {order.client_name || 'Client'}
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="h-3 w-3 text-gray-400" />
                        {order.client_email || '—'}
                      </div>
                      {order.client_phone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="h-3 w-3 text-gray-400" />
                          {order.client_phone}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-gray-400" />
                        {order.pro_name || 'Tax Pro'}
                      </div>
                      <div className="text-gray-600 text-xs">{meta.description}</div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Project brief
              </p>
              <div className="rounded-md border bg-white p-3 text-sm">
                <ul className="space-y-1 text-gray-700">
                  <li>
                    <strong>Filing status:</strong> {order.brief?.filingStatus || '—'}
                  </li>
                  <li>
                    <strong>Dependents:</strong> {order.brief?.dependents ?? 0}
                  </li>
                  <li>
                    <strong>State(s):</strong> {order.brief?.states || '—'}
                  </li>
                  <li>
                    <strong>Income sources:</strong>{' '}
                    {(order.brief?.incomeSources || []).join(', ') || '—'}
                  </li>
                  <li>
                    <strong>Prior-year return:</strong>{' '}
                    {order.brief?.hasPriorYearReturn || '—'}
                  </li>
                  <li>
                    <strong>Urgency:</strong> {order.brief?.urgency || 'normal'}
                  </li>
                  {order.brief?.notes && (
                    <li className="pt-1">
                      <strong>Notes:</strong>{' '}
                      <span className="text-gray-600">{order.brief.notes}</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {/* Source documents (client-uploaded W-2s, 1099s, prior-year, etc.) */}
            {(sourceFiles.length > 0 || clientCanAttachSources) && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Source documents
                  {sourceFiles.length > 0 && (
                    <span className="ml-2 text-[10px] font-normal normal-case text-gray-400">
                      ({sourceFiles.length} attached)
                    </span>
                  )}
                </p>
                <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-gray-800">
                  {clientCanAttachSources && onAddSourceFiles && (
                    <>
                      <p className="mb-2 text-[11px] text-sky-800">
                        Attach W-2s, 1099s, your prior-year return, receipts — anything your pro needs to prepare your return. Only you and your pro can download these files (Storage rule enforced).
                      </p>
                      <input
                        ref={sourceInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => handleSourceFilesPicked(e.target.files)}
                        accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.heic,.csv,.xls,.xlsx,.doc,.docx,.txt,.zip,application/pdf,image/*"
                      />
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => sourceInputRef.current?.click()}
                        disabled={uploadingSource}
                        className="border-sky-300 text-sky-800 hover:bg-sky-100"
                      >
                        {uploadingSource ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <UploadCloud className="mr-1 h-3 w-3" />
                        )}
                        {uploadingSource ? 'Uploading…' : 'Attach documents'}
                      </Button>
                      {uploadingSource && (
                        <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-sky-700">
                          <Loader2 className="h-3 w-3 animate-spin" /> Uploading to secure storage…
                        </p>
                      )}
                    </>
                  )}

                  {sourceFiles.length > 0 && (
                    <>
                      {clientCanAttachSources && (
                        <div className="my-3 border-t border-sky-200" />
                      )}
                      <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-sky-800">
                        <Paperclip className="h-3 w-3" /> Attached by client ({sourceFiles.length})
                      </p>
                      <ul className="space-y-1.5">
                        {sourceFiles.map((f) => {
                          const removing = removingSourcePath === f.storagePath;
                          return (
                            <li
                              key={f.storagePath}
                              className="flex items-center justify-between gap-2 rounded-md border border-sky-200 bg-white px-2.5 py-1.5"
                            >
                              <span className="flex min-w-0 items-center gap-2 text-xs">
                                <FileGlyph contentType={f.contentType} className="h-4 w-4 text-sky-600 shrink-0" />
                                <span className="min-w-0 truncate font-medium text-gray-900">
                                  {f.name}
                                </span>
                                <span className="shrink-0 text-gray-500">{fmtBytes(f.size)}</span>
                              </span>

                              <span className="flex shrink-0 items-center gap-1">
                                <a
                                  href={f.downloadURL}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={f.name}
                                  className="inline-flex items-center gap-1 rounded-md border border-sky-300 bg-sky-100 px-2 py-1 text-[11px] font-medium text-sky-800 hover:bg-sky-200"
                                >
                                  <Download className="h-3 w-3" /> Download
                                </a>
                                {clientCanAttachSources && onRemoveSourceFile && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSourceFile(f.storagePath)}
                                    disabled={removing}
                                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                    title="Remove file"
                                  >
                                    {removing ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <X className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="mt-2 text-[10px] text-sky-700/80">
                        Only you and your {perspective === 'pro' ? 'client' : 'pro'} can access these files. Links are signed by Firebase Storage.
                      </p>
                    </>
                  )}

                  {sourceFiles.length === 0 && !clientCanAttachSources && perspective === 'pro' && (
                    <p className="text-[11px] text-sky-700">
                      No source documents attached by the client yet.
                    </p>
                  )}
                </div>
              </div>
            )}


            {(order.delivery_message || deliveredFiles.length > 0) && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Delivery
                </p>
                <div className="rounded-md border border-violet-200 bg-violet-50 p-3 text-sm text-gray-800">
                  {order.delivery_message && (
                    <p className="mb-3 leading-relaxed">
                      <FileText className="mr-1 inline h-3 w-3 text-violet-600" />
                      {order.delivery_message}
                    </p>
                  )}

                  {deliveredFiles.length > 0 && (
                    <>
                      <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-violet-800">
                        <Paperclip className="h-3 w-3" /> Attached files ({deliveredFiles.length})
                      </p>
                      <ul className="space-y-1.5">
                        {deliveredFiles.map((f) => (
                          <li
                            key={f.storagePath}
                            className="flex items-center justify-between gap-2 rounded-md border border-violet-200 bg-white px-2.5 py-1.5"
                          >
                            <span className="flex min-w-0 items-center gap-2 text-xs">
                              <FileGlyph contentType={f.contentType} className="h-4 w-4 text-violet-600 shrink-0" />
                              <span className="min-w-0 truncate font-medium text-gray-900">
                                {f.name}
                              </span>
                              <span className="shrink-0 text-gray-500">
                                {fmtBytes(f.size)}
                              </span>
                            </span>

                            <a
                              href={f.downloadURL}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={f.name}
                              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-300 bg-violet-100 px-2 py-1 text-[11px] font-medium text-violet-800 hover:bg-violet-200"
                            >
                              <Download className="h-3 w-3" /> Download
                            </a>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[10px] text-violet-700/80">
                        Only you and your {perspective === 'pro' ? 'client' : 'pro'} can access these
                        files. Links are signed by Firebase Storage.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {isRefunded && order.refund_reason && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Refund reason
                </p>
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <Undo2 className="mr-1 inline h-3 w-3 text-red-600" />
                  {order.refund_reason}
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-500 sm:grid-cols-6">
              <div>
                <p className="text-gray-400">Placed</p>
                <p className="text-gray-700">{fmtDate(order.created_at)}</p>
              </div>
              <div>
                <p className="text-gray-400">Paid</p>
                <p className="text-gray-700">{fmtDate(order.paid_at)}</p>
              </div>
              <div>
                <p className="text-gray-400">Due</p>
                <p className="text-gray-700">{fmtDateOnly(order.delivery_due_at)}</p>
              </div>
              <div>
                <p className="text-gray-400">Delivered</p>
                <p className="text-gray-700">{fmtDate(order.delivered_at)}</p>
              </div>
              <div>
                <p className="text-gray-400">Completed</p>
                <p className="text-gray-700">{fmtDate(order.completed_at)}</p>
              </div>
              <div>
                <p className="text-gray-400">Refunded</p>
                <p className={isRefunded ? 'text-red-700 font-medium' : 'text-gray-700'}>
                  {fmtDate(order.refunded_at)}
                </p>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default OrderCard;
