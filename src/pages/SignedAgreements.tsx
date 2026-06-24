import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ArrowLeft,
  FileSignature,
  Loader2,
  Printer,
  Search,
  ShieldAlert,
} from 'lucide-react';

/**
 * Shape of a document inside the `signed_agreements` collection. Mirrors the
 * SignedAgreement type written by TaxProfessionalOnboarding when an applicant
 * signs the Terms & Conditions.
 */
interface SignedAgreementDoc {
  id: string;
  agreementVersion: string;
  agreementTitle: string;
  agreementBody: string;
  signerName: string;
  signerEmail: string;
  signerInitials: string;
  signatureImage: string;
  esignConsent: boolean;
  readConfirmed: boolean;
  signedAt: string;
  clientIp: string | null;
  userAgent: string;
  firebase_uid?: string | null;
  applicant_email?: string;
  applicant_name?: string;
  created_at?: Timestamp | null;
}

function tsToDate(t: any): Date | null {
  if (!t) return null;
  if (t instanceof Timestamp) return t.toDate();
  if (typeof t === 'string') {
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d;
  }
  if (t?.seconds) return new Date(t.seconds * 1000);
  return null;
}

function fmt(d: Date | null): string {
  if (!d) return '—';
  try {
    return d.toLocaleString();
  } catch {
    return '—';
  }
}

/**
 * Build a self-contained, court-ready HTML representation of the signed
 * agreement and open it in a new window so the admin can use the browser's
 * native "Save as PDF" via window.print(). Keeping it in a popup lets the
 * page styling be tightly controlled (no app chrome, no Tailwind utilities
 * fighting with @page rules) and gives a clean printable artifact.
 */
function openPrintableAgreement(a: SignedAgreementDoc) {
  const signedDate = tsToDate(a.signedAt);
  const createdDate = tsToDate(a.created_at);
  const esc = (s: string) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(a.agreementTitle)} — ${esc(a.signerName)} — ${esc(a.agreementVersion)}</title>
  <style>
    @page { size: Letter; margin: 0.75in; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: 'Times New Roman', Georgia, serif;
      color: #111;
      background: #fff;
      font-size: 12pt;
      line-height: 1.5;
    }
    .doc { max-width: 7.5in; margin: 0 auto; padding: 24px; }
    .header {
      border-bottom: 2px solid #111;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    .header h1 {
      font-size: 18pt;
      margin: 0 0 4px 0;
    }
    .header .meta {
      font-size: 10pt;
      color: #444;
    }
    .section { margin-bottom: 18px; }
    .section h2 {
      font-size: 13pt;
      margin: 0 0 6px 0;
      border-bottom: 1px solid #999;
      padding-bottom: 4px;
    }
    .audit {
      border: 1px solid #999;
      padding: 10px 14px;
      background: #f6f6f6;
      font-size: 10.5pt;
    }
    .audit table { width: 100%; border-collapse: collapse; }
    .audit td {
      padding: 2px 8px;
      vertical-align: top;
    }
    .audit td.k {
      font-weight: bold;
      width: 28%;
      white-space: nowrap;
    }
    .agreement-body {
      white-space: pre-wrap;
      font-family: 'Courier New', monospace;
      font-size: 10.5pt;
      line-height: 1.55;
      border: 1px solid #ccc;
      padding: 14px;
      background: #fafafa;
    }
    .signature-block {
      margin-top: 18px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    .sig-box {
      border: 1px solid #555;
      padding: 10px;
      background: #fff;
    }
    .sig-box .label {
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #555;
      margin-bottom: 6px;
    }
    .sig-box img {
      max-width: 100%;
      max-height: 120px;
      display: block;
      background: #fff;
    }
    .sig-box .typed {
      font-family: 'Brush Script MT', cursive;
      font-size: 22pt;
      padding: 12px 0;
    }
    .footer {
      margin-top: 28px;
      font-size: 9pt;
      color: #555;
      border-top: 1px solid #999;
      padding-top: 8px;
      text-align: center;
    }
    .toolbar {
      position: sticky;
      top: 0;
      background: #1e3a8a;
      color: #fff;
      padding: 10px 16px;
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
    }
    .toolbar button {
      background: #fff;
      color: #1e3a8a;
      border: 0;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
    }
    .toolbar .info { font-size: 11pt; }
    @media print {
      .toolbar { display: none !important; }
      body { background: #fff; }
      .agreement-body { background: #fff; border-color: #888; }
      .audit { background: #fff; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="info">Court-ready printable agreement — use your browser's print dialog and choose "Save as PDF".</div>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="doc">
    <div class="header">
      <h1>${esc(a.agreementTitle)}</h1>
      <div class="meta">
        Version <strong>${esc(a.agreementVersion)}</strong> &middot;
        Document ID: ${esc(a.id)}
      </div>
    </div>

    <div class="section">
      <h2>Signer Identification &amp; Audit Record</h2>
      <div class="audit">
        <table>
          <tr><td class="k">Signer Name</td><td>${esc(a.signerName)}</td></tr>
          <tr><td class="k">Signer Email</td><td>${esc(a.signerEmail)}</td></tr>
          <tr><td class="k">Signer Initials</td><td>${esc(a.signerInitials)}</td></tr>
          <tr><td class="k">Firebase UID</td><td>${esc(a.firebase_uid || '—')}</td></tr>
          <tr><td class="k">Signed At (UTC ISO)</td><td>${esc(a.signedAt)}</td></tr>
          <tr><td class="k">Signed At (local)</td><td>${esc(fmt(signedDate))}</td></tr>
          <tr><td class="k">Recorded At</td><td>${esc(fmt(createdDate))}</td></tr>
          <tr><td class="k">IP Address</td><td>${esc(a.clientIp || 'not captured')}</td></tr>
          <tr><td class="k">User Agent</td><td style="word-break:break-all">${esc(a.userAgent || '—')}</td></tr>
          <tr><td class="k">ESIGN Consent</td><td>${a.esignConsent ? 'YES — 15 U.S.C. §7001' : 'NO'}</td></tr>
          <tr><td class="k">Read &amp; Understood</td><td>${a.readConfirmed ? 'YES — confirmed after scrolling full agreement' : 'NO'}</td></tr>
        </table>
      </div>
    </div>

    <div class="section">
      <h2>Full Agreement Text (snapshot at time of signing)</h2>
      <div class="agreement-body">${esc(a.agreementBody)}</div>
    </div>

    <div class="section">
      <h2>Electronic Signature</h2>
      <div class="signature-block">
        <div class="sig-box">
          <div class="label">Drawn Signature</div>
          ${
            a.signatureImage
              ? `<img src="${a.signatureImage}" alt="Drawn signature of ${esc(a.signerName)}" />`
              : '<div style="color:#999">No drawn signature captured.</div>'
          }
          <div style="margin-top:8px;font-size:9pt;color:#555">
            Signed by: <strong>${esc(a.signerName)}</strong><br/>
            On: ${esc(fmt(signedDate))}
          </div>
        </div>
        <div class="sig-box">
          <div class="label">Typed Name &amp; Initials</div>
          <div class="typed">${esc(a.signerName)}</div>
          <div style="font-size:10pt;color:#555">
            Initials: <strong>${esc(a.signerInitials)}</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      This document is a system-generated printable copy of an electronically signed agreement.
      Original record retained in the Refund Connect Firestore <code>signed_agreements</code> collection
      under document ID <strong>${esc(a.id)}</strong>. Pursuant to the ESIGN Act (15 U.S.C. §7001),
      this electronic signature has the same legal effect as a handwritten signature.
    </div>
  </div>
  <script>
    // Auto-focus so keyboard shortcut Ctrl/Cmd+P works immediately.
    window.focus();
  </script>
</body>
</html>`;

  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1100');
  if (!w) {
    alert('Please allow pop-ups for this site to open the printable agreement.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export default function SignedAgreements() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<SignedAgreementDoc[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SignedAgreementDoc | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate('/');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    setListLoading(true);
    setLoadError(null);

    // Subscribe newest-first. Fallback: if the collection has no `created_at`
    // server timestamp yet on older docs, signedAt (an ISO string) will still
    // sort lexically in descending order, so we order on that.
    const q = query(
      collection(db, 'signed_agreements'),
      orderBy('signedAt', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: SignedAgreementDoc[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            agreementVersion: data.agreementVersion || '—',
            agreementTitle: data.agreementTitle || 'Signed Agreement',
            agreementBody: data.agreementBody || '',
            signerName: data.signerName || data.applicant_name || '—',
            signerEmail: data.signerEmail || data.applicant_email || '—',
            signerInitials: data.signerInitials || '',
            signatureImage: data.signatureImage || '',
            esignConsent: !!data.esignConsent,
            readConfirmed: !!data.readConfirmed,
            signedAt: data.signedAt || '',
            clientIp: data.clientIp ?? null,
            userAgent: data.userAgent || '',
            firebase_uid: data.firebase_uid || null,
            applicant_email: data.applicant_email,
            applicant_name: data.applicant_name,
            created_at: data.created_at || null,
          };
        });
        setItems(rows);
        setListLoading(false);
      },
      (err) => {
        console.error('Failed to load signed_agreements:', err);
        setLoadError(err?.message || 'Could not load signed agreements.');
        setListLoading(false);
      },
    );
    return () => unsub();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((a) => {
      const haystack = [
        a.signerName,
        a.signerEmail,
        a.agreementVersion,
        a.agreementTitle,
        a.clientIp || '',
        a.id,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(s);
    });
  }, [items, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to view signed agreements. This page is
            restricted to administrators.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/admin"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Admin
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <FileSignature className="h-7 w-7 text-blue-600" />
                Signed Agreements
                <Badge variant="secondary" className="text-sm">
                  {items.length}
                </Badge>
              </h1>
              <p className="text-gray-600 mt-1">
                Every electronically signed Terms &amp; Conditions agreement,
                with full audit metadata. Click any row to view the full
                contract and produce a court-ready PDF copy.
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search name, email, version, IP…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Body */}
        {loadError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load signed agreements</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : listLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileSignature className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {items.length === 0
                  ? 'No signed agreements yet. They will appear here as soon as a tax professional signs the onboarding Terms & Conditions.'
                  : 'No agreements match your search.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-gray-700">
                    <th className="px-4 py-3 font-semibold">Signer</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Version</th>
                    <th className="px-4 py-3 font-semibold">Signed At</th>
                    <th className="px-4 py-3 font-semibold">IP Address</th>
                    <th className="px-4 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => {
                    const signedDate = tsToDate(a.signedAt);
                    return (
                      <tr
                        key={a.id}
                        onClick={() => setSelected(a)}
                        className="border-b last:border-0 hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {a.signerName}
                          </div>
                          <div className="text-xs text-gray-500">
                            Initials: {a.signerInitials || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {a.signerEmail}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="font-mono text-xs">
                            {a.agreementVersion}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {fmt(signedDate)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">
                          {a.clientIp || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(a);
                            }}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-blue-600" />
                  {selected.agreementTitle}
                </DialogTitle>
                <DialogDescription>
                  Version{' '}
                  <span className="font-mono">{selected.agreementVersion}</span>{' '}
                  &middot; Document ID:{' '}
                  <span className="font-mono">{selected.id}</span>
                </DialogDescription>
              </DialogHeader>

              {/* Audit grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <div>
                  <span className="font-semibold text-gray-700">Signer:</span>{' '}
                  {selected.signerName}
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Email:</span>{' '}
                  {selected.signerEmail}
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Initials:</span>{' '}
                  {selected.signerInitials || '—'}
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Firebase UID:</span>{' '}
                  <span className="font-mono text-xs">
                    {selected.firebase_uid || '—'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Signed at:</span>{' '}
                  {fmt(tsToDate(selected.signedAt))}
                </div>
                <div>
                  <span className="font-semibold text-gray-700">IP address:</span>{' '}
                  <span className="font-mono">
                    {selected.clientIp || 'not captured'}
                  </span>
                </div>
                <div className="md:col-span-2 break-all">
                  <span className="font-semibold text-gray-700">User agent:</span>{' '}
                  <span className="text-xs text-gray-600">
                    {selected.userAgent || '—'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">ESIGN consent:</span>{' '}
                  {selected.esignConsent ? (
                    <Badge className="bg-green-100 text-green-800">
                      Yes — 15 U.S.C. §7001
                    </Badge>
                  ) : (
                    <Badge variant="destructive">No</Badge>
                  )}
                </div>
                <div>
                  <span className="font-semibold text-gray-700">
                    Read &amp; understood:
                  </span>{' '}
                  {selected.readConfirmed ? (
                    <Badge className="bg-green-100 text-green-800">Yes</Badge>
                  ) : (
                    <Badge variant="destructive">No</Badge>
                  )}
                </div>
              </div>

              {/* Full agreement body */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Full Agreement Text (snapshot at time of signing)
                </h3>
                <div className="h-72 overflow-y-auto border rounded-lg p-4 bg-gray-50 text-xs whitespace-pre-wrap font-mono leading-relaxed">
                  {selected.agreementBody || '(no agreement body stored)'}
                </div>
              </div>

              {/* Signature image */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Drawn Signature
                </h3>
                {selected.signatureImage ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-white inline-block max-w-full">
                    <img
                      src={selected.signatureImage}
                      alt={`Signature of ${selected.signerName}`}
                      className="max-h-40 max-w-full"
                    />
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">
                    No drawn signature image captured for this record.
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => openPrintableAgreement(selected)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Download as PDF
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
