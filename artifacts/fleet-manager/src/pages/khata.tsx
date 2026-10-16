import { Layout } from "@/components/layout";
import { useStore, Customer, LedgerEntry } from "@/lib/store";
import { useRef, useState } from "react";
import {
  Plus, Users, Phone, Download, Share2, ReceiptText, Search, Trash2,
  ArrowLeft, QrCode, CirclePlus, CheckCircle2, Clock3,
} from "lucide-react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createInvoiceHtml, InvoiceData } from "@/lib/invoice";
import { createInvoicePdf } from "@/lib/pdf";

const today = () => new Date().toISOString().split("T")[0];

export default function Khata() {
  const { state, dispatch } = useStore();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [invoicePreview, setInvoicePreview] = useState("");
  const [receiptActionsOpen, setReceiptActionsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [khataTab, setKhataTab] = useState<"work" | "payments" | "bunched">("work");
  const [customerSection, setCustomerSection] = useState<"active" | "completed" | "bunched">("active");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchStart, setBatchStart] = useState("");
  const [batchEnd, setBatchEnd] = useState("");
  const [batchMessage, setBatchMessage] = useState("");
  const batchPressTimer = useRef<number | null>(null);
  const suppressBatchClick = useRef(false);
  const [customerData, setCustomerData] = useState<Partial<Customer>>({ name: "", phone: "", company: "" });
  const [ledgerData, setLedgerData] = useState<Partial<LedgerEntry>>({
    date: today(), type: "Payment", amount: 0, description: "", paymentMode: "Cash",
  });

  const selected = state.customers.find((customer) => customer.id === selectedCustomer) || null;
  const selectedBatch = state.khataBatches.find((batch) => batch.id === selectedBatchId) || null;

  const getCustomerCharges = (customerId: string, batchId?: string) =>
    state.ledgers
      .filter((entry) => entry.customerId === customerId && entry.type === "Charge" && (batchId ? entry.batchId === batchId : !entry.batchId))
      .sort((a, b) => b.date.localeCompare(a.date));

  const getCustomerPayments = (customerId: string, batchId?: string) =>
    state.ledgers
      .filter((entry) => entry.customerId === customerId && entry.type === "Payment" && (batchId ? entry.batchId === batchId : !entry.batchId))
      .sort((a, b) => b.date.localeCompare(a.date));

  const getBatchPayments = (customerId: string, batchId?: string) =>
    getCustomerPayments(customerId, batchId);

  const getCustomerSubtotal = (customerId: string, batchId?: string) =>
    getCustomerCharges(customerId, batchId).reduce((sum, entry) => sum + entry.amount, 0);

  const getCustomerGst = (customer: Customer, batchId?: string) => {
    const batch = batchId ? state.khataBatches.find((item) => item.id === batchId) : undefined;
    const addGst = batch ? batch.addGst : customer.addGst;
    return addGst && state.settings.gstPercentage
      ? Math.round(getCustomerSubtotal(customer.id, batchId) * (state.settings.gstPercentage / 100) * 100) / 100
      : 0;
  };

  const getBatchTotal = (customer: Customer, batchId: string) =>
    getCustomerSubtotal(customer.id, batchId) + getCustomerGst(customer, batchId);

  const getChargeAmount = (entry: LedgerEntry, customer: Customer) =>
    Math.round(entry.amount * (customer.addGst && state.settings.gstPercentage ? 1 + state.settings.gstPercentage / 100 : 1) * 100) / 100;

  const getCustomerBalance = (customer: Customer) =>
    getCustomerSubtotal(customer.id) + getCustomerGst(customer)
      - getCustomerPayments(customer.id).reduce((sum, entry) => sum + entry.amount, 0);

  const getReceived = (customerId: string) =>
    getCustomerPayments(customerId).reduce((sum, entry) => sum + entry.amount, 0);

  const closeDetail = () => {
    setSelectedCustomer(null);
    setSelectedBatchId(null);
    setQrDataUrl("");
    setInvoicePreview("");
    setQrOpen(false);
    setReceiptActionsOpen(false);
    setSelectedBatchIds([]);
  };

  const openBatch = (batchId: string) => {
    const batch = state.khataBatches.find((item) => item.id === batchId);
    if (!batch) return;
    setSelectedCustomer(batch.customerId);
    setSelectedBatchId(batch.id);
    setKhataTab("work");
  };

  const toggleBatchSelection = (batchId: string) => {
    setSelectedBatchIds((current) => current.includes(batchId) ? current.filter((id) => id !== batchId) : [...current, batchId]);
  };

  const startBatchPress = (batchId: string) => {
    suppressBatchClick.current = false;
    if (batchPressTimer.current) window.clearTimeout(batchPressTimer.current);
    batchPressTimer.current = window.setTimeout(() => {
      suppressBatchClick.current = true;
      navigator.vibrate?.(50);
      toggleBatchSelection(batchId);
    }, 450);
  };

  const endBatchPress = () => {
    if (batchPressTimer.current) window.clearTimeout(batchPressTimer.current);
    batchPressTimer.current = null;
  };

  const unbundleSelected = () => {
    if (!selectedBatchIds.length) return;
    if (!window.confirm(`Unbundle ${selectedBatchIds.length} group(s)? Their logs, payments and customer details will stay safe.`)) return;
    selectedBatchIds.forEach((batchId) => dispatch({ type: "DELETE_KHATA_BATCH", payload: batchId }));
    setSelectedBatchIds([]);
  };

  const deleteSelectedBunchLogs = () => {
    if (!selectedBatchIds.length) return;
    const selectedBatches = state.khataBatches.filter((batch) => selectedBatchIds.includes(batch.id));
    const ledgerIds = selectedBatches.flatMap((batch) => batch.ledgerIds);
    const logIds = state.ledgers.filter((entry) => ledgerIds.includes(entry.id) && entry.logId).map((entry) => entry.logId as string);
    if (!window.confirm(`Delete ${ledgerIds.length} bundled work log(s)? This removes the linked vehicle logs too.`)) return;
    logIds.forEach((logId) => dispatch({ type: "DELETE_LOG", payload: logId }));
    state.ledgers.filter((entry) => ledgerIds.includes(entry.id) && !entry.logId).forEach((entry) => dispatch({ type: "DELETE_LEDGER", payload: entry.id }));
    setSelectedBatchIds([]);
  };

  const createBatch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !batchStart || !batchEnd || batchStart > batchEnd) {
      setBatchMessage("Choose a valid start and end date.");
      return;
    }
    const ledgerIds = state.ledgers
      .filter((entry) => entry.customerId === selected.id && entry.type === "Charge" && !entry.batchId && entry.date >= batchStart && entry.date <= batchEnd)
      .map((entry) => entry.id);
    if (!ledgerIds.length) {
      setBatchMessage("No unbunched work entries were found in this date range.");
      return;
    }
    dispatch({ type: "ADD_KHATA_BATCH", payload: { customerId: selected.id, startDate: batchStart, endDate: batchEnd, ledgerIds } });
    setBatchOpen(false);
    setBatchMessage("");
    setBatchStart("");
    setBatchEnd("");
  };

  const deleteCustomer = (customer: Customer) => {
    if (!window.confirm(`Delete ${customer.name} and all of its Khata work and payment records?`)) return;
    dispatch({ type: "DELETE_CUSTOMER", payload: customer.id });
    if (selectedCustomer === customer.id) closeDetail();
  };

  const handleCustomerSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    dispatch({ type: "ADD_CUSTOMER", payload: customerData });
    setIsAddOpen(false);
    setCustomerData({ name: "", phone: "", company: "" });
  };

  const openPayment = () => {
    if (!selected) return;
    setLedgerData({ date: today(), type: "Payment", amount: 0, description: "", paymentMode: "Cash", batchId: selectedBatchId || undefined });
    setIsPaymentOpen(true);
  };

  const handleLedgerSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !ledgerData.amount || ledgerData.amount <= 0) return;
    dispatch({
      type: "ADD_LEDGER",
      payload: { ...ledgerData, type: "Payment", customerId: selected.id, amount: Number(ledgerData.amount) },
    });
    setIsPaymentOpen(false);
    setLedgerData({ date: today(), type: "Payment", amount: 0, description: "", paymentMode: "Cash", batchId: selectedBatchId || undefined });
  };

  const setPaymentMode = (paymentMode: string) => setLedgerData((current) => ({ ...current, paymentMode }));

  const generatePaymentQr = async (customer: Customer, batchId = selectedBatchId) => {
    const batchSubtotal = batchId ? getCustomerSubtotal(customer.id, batchId) + getCustomerGst(customer, batchId) : getCustomerBalance(customer);
    const received = batchId ? getBatchPayments(customer.id, batchId).reduce((sum, payment) => sum + payment.amount, 0) : getReceived(customer.id);
    const amount = batchId ? Math.max(0, batchSubtotal - received) : batchSubtotal;
    const upi = state.settings.upiId || "fleet-owner@upi";
    const amountPart = amount > 0 ? `&am=${amount}` : "";
    const companyName = state.settings.companyName || state.settings.businessName || "Fleetvix";
    const payload = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(companyName)}${amountPart}&cu=INR`;
    try {
      const dataUrl = await QRCode.toDataURL(payload, { width: 280, margin: 2, errorCorrectionLevel: "M" });
      setQrDataUrl(dataUrl);
      setQrOpen(true);
    } catch (error) {
      console.error("Could not generate payment QR", error);
    }
  };

  const getInvoiceData = (customer: Customer, batchId = selectedBatchId): InvoiceData => {
    const charges = getCustomerCharges(customer.id, batchId || undefined);
    const payments = getBatchPayments(customer.id, batchId || undefined);
    const dates = charges.map((entry) => entry.date).sort();
    const subtotal = getCustomerSubtotal(customer.id, batchId || undefined);
    const gstAmount = getCustomerGst(customer, batchId || undefined);
    const total = subtotal + gstAmount;
    const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const balanceDue = Math.max(0, total - paidAmount);
    return {
      invoiceId: `RC-${today()}-${customer.phone.replace(/\D/g, "").slice(-4) || customer.id.slice(-4).toUpperCase()}`,
      issuedAt: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      issuedTime: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
       businessName: state.settings.companyName || state.settings.businessName || "Fleetvix",
      companyName: state.settings.companyName || state.settings.businessName || "Fleetvix",
      ownerName: state.settings.ownerName || "",
      phone: state.settings.phone || "",
      email: state.settings.email || "",
      address: state.settings.address || "",
      bankName: state.settings.bankName || "",
      gstNumber: state.settings.gstNumber || "",
      upiId: state.settings.upiId || "",
      logoUrl: state.settings.logoUrl,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerCompany: customer.company || "",
      customerAddress: customer.address || "",
      workStart: dates[0] || today(),
      workEnd: dates[dates.length - 1] || today(),
      serviceLocation: customer.address || "",
      lines: charges.map((entry) => {
        const relatedLog = state.logs.find((log) => log.id === entry.logId);
        const vehicle = relatedLog ? state.vehicles.find((item) => item.id === relatedLog.vehicleId) : undefined;
        const duration = relatedLog
          ? vehicle?.type === "Hywa" || vehicle?.type === "Tipper"
            ? `Trips: ${relatedLog.trips || 0} • Diesel: ${relatedLog.diesel || 0} L`
            : relatedLog.hours ? `Work Duration: ${relatedLog.hours} hours` : undefined
          : undefined;
        return {
          date: entry.date,
          description: `${vehicle?.name ? `${vehicle.name} - ` : ""}${entry.description || customer.address || customer.company || "Work entry"}`,
          amount: entry.amount,
          duration,
        };
      }),
      payments: payments.map((payment) => ({
        date: payment.date,
        amount: payment.amount,
        paymentMode: payment.paymentMode,
        description: payment.description,
      })),
      total,
      subtotal,
      gstPercentage: state.settings.gstPercentage || 0,
      gstAmount,
       addGst: Boolean((batchId ? state.khataBatches.find((batch) => batch.id === batchId)?.addGst : customer.addGst) && state.settings.gstPercentage),
      paidAmount,
      balanceDue,
       status: (batchId ? state.khataBatches.find((batch) => batch.id === batchId)?.paymentStatus : customer.paymentStatus) === "Paid"
         ? "PAID"
         : (batchId ? state.khataBatches.find((batch) => batch.id === batchId)?.paymentStatus : customer.paymentStatus) === "Delay"
           ? "DELAY"
           : "PENDING",
       paymentDate: (batchId ? state.khataBatches.find((batch) => batch.id === batchId)?.paymentDate : customer.paymentDate) || payments[0]?.date,
      paymentReference: payments[0]?.description,
      paymentMode: payments[0]?.paymentMode || "—",
       delayStartDate: batchId ? state.khataBatches.find((batch) => batch.id === batchId)?.delayStartDate : customer.delayStartDate,
       delayEndDate: batchId ? state.khataBatches.find((batch) => batch.id === batchId)?.delayEndDate : customer.delayEndDate,
    };
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const anchor = document.createElement("a");
    const url = URL.createObjectURL(blob);
    anchor.href = url;
    anchor.download = name;
    anchor.rel = "noopener";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadReceipt = async (customer: Customer, batchId = selectedBatchId) => {
    const suffix = batchId ? `-bunch-${batchId.slice(-6)}` : "";
    const name = `${customer.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "customer"}${suffix}-receipt.pdf`;
    downloadBlob(await createInvoicePdf(getInvoiceData(customer, batchId)), name);
  };

  const shareReceipt = async (customer: Customer, batchId = selectedBatchId) => {
    const fileName = `${customer.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "customer"}${batchId ? `-bunch-${batchId.slice(-6)}` : ""}-receipt.pdf`;
    const file = new File([await createInvoicePdf(getInvoiceData(customer, batchId))], fileName, { type: "application/pdf" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try {
        await navigator.share({ title: "Receipt", text: `Receipt for ${customer.name}`, files: [file] });
        return;
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") return;
      }
    }
    await downloadReceipt(customer);
  };

  const printReceipt = (customer: Customer, batchId = selectedBatchId) => setInvoicePreview(createInvoiceHtml(getInvoiceData(customer, batchId || undefined)));

  const openPrintWindow = () => {
    if (!invoicePreview) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(invoicePreview.replace("</body>", `<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},250)})</script></body>`));
    printWindow.document.close();
  };

  const downloadQr = async (customer: Customer) => {
    if (!qrDataUrl) return;
    const response = await fetch(qrDataUrl);
    downloadBlob(await response.blob(), `${customer.name}-payment-qr.png`);
  };

  const shareQr = async (customer: Customer) => {
    if (!qrDataUrl) return;
    const response = await fetch(qrDataUrl);
    const file = new File([await response.blob()], `${customer.name}-payment-qr.png`, { type: "image/png" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ title: `${state.settings.businessName} payment QR`, text: `Payment request for ${customer.name}`, files: [file] });
    } else {
      await downloadQr(customer);
    }
  };

  if (selected) {
    const charges = getCustomerCharges(selected.id, selectedBatchId || undefined);
    const payments = getBatchPayments(selected.id, selectedBatchId || undefined);
    const subtotal = getCustomerSubtotal(selected.id, selectedBatchId || undefined);
    const total = subtotal + getCustomerGst(selected, selectedBatchId || undefined);
    const balance = Math.max(0, total - payments.reduce((sum, payment) => sum + payment.amount, 0));
    const paid = selectedBatch ? selectedBatch.paymentStatus === "Paid" : selected.paymentStatus === "Paid";
    const delayed = selectedBatch ? selectedBatch.paymentStatus === "Delay" : selected.paymentStatus === "Delay";
    return (
      <Layout>
        <div className="fm-page-header">
          <button type="button" onClick={closeDetail} className="flex items-center gap-3 text-left">
            <ArrowLeft size={24} />
            <span><h1 className="!text-2xl">{selected.name}</h1><p>{selected.phone}{selectedBatch ? ` • ${selectedBatch.startDate} to ${selectedBatch.endDate}` : ""}</p></span>
          </button>
          <div className="flex items-center gap-2">
            <button type="button" className="fm-icon-button bg-rose-500/15 text-rose-300" onClick={() => deleteCustomer(selected)} aria-label={`Delete ${selected.name}`}><Trash2 size={19} /></button>
            <button type="button" className="fm-icon-button bg-[#183660] text-white" onClick={() => void shareReceipt(selected, selectedBatchId || undefined)} aria-label="Share receipt"><Share2 size={20} /></button>
          </div>
        </div>
        <div className="px-5 py-5 pb-24 space-y-4">
          <section className="fm-card p-4">
             <div className="grid grid-cols-3 gap-2 text-center">
               <div><div className="break-all text-lg font-black leading-tight text-primary">₹{(subtotal + getCustomerGst(selected, selectedBatchId || undefined)).toLocaleString("en-IN")}</div><div className="text-xs text-muted-foreground">{selectedBatch ? "Bunch Total" : "Total Work"}</div></div>
               <div><div className="break-all text-lg font-black leading-tight text-emerald-400">₹{payments.reduce((sum, payment) => sum + payment.amount, 0).toLocaleString("en-IN")}</div><div className="text-xs text-muted-foreground">Received</div></div>
              <div><div className="break-all text-lg font-black leading-tight text-rose-400">₹{balance.toLocaleString("en-IN")}</div><div className="text-xs text-muted-foreground">Outstanding</div></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
               <button type="button" onClick={() => selectedBatch ? dispatch({ type: "UPDATE_KHATA_BATCH", payload: { id: selectedBatch.id, paymentStatus: paid ? undefined : "Paid", paymentDate: paid ? undefined : today() } }) : dispatch({ type: "UPDATE_CUSTOMER", payload: { id: selected.id, paymentStatus: paid ? undefined : "Paid", paymentDate: paid ? undefined : today() } })} className={`rounded-2xl p-3 font-bold transition-colors ${paid ? "bg-emerald-500 text-white" : "border border-emerald-400 bg-transparent text-emerald-400"}`}><CheckCircle2 className="inline mr-1" size={18} /> Paid</button>
               <button type="button" onClick={() => selectedBatch ? dispatch({ type: "UPDATE_KHATA_BATCH", payload: { id: selectedBatch.id, paymentStatus: delayed ? undefined : "Delay", delayStartDate: delayed ? undefined : today(), delayEndDate: delayed ? undefined : today() } }) : dispatch({ type: "UPDATE_CUSTOMER", payload: { id: selected.id, paymentStatus: delayed ? undefined : "Delay", delayStartDate: delayed ? undefined : today(), delayEndDate: delayed ? undefined : today() } })} className={`rounded-2xl p-3 font-bold ${delayed ? "bg-amber-500/20 text-amber-300" : "border border-amber-400/50 bg-transparent text-amber-300"}`}><Clock3 className="inline mr-1" size={18} /> Delay</button>
            </div>
          </section>

           {delayed && <section className="fm-card grid grid-cols-2 gap-3 p-4">
             <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Delay from<input type="date" value={(selectedBatch ? selectedBatch.delayStartDate : selected.delayStartDate) || ""} onChange={(event) => selectedBatch ? dispatch({ type: "UPDATE_KHATA_BATCH", payload: { id: selectedBatch.id, delayStartDate: event.target.value } }) : dispatch({ type: "UPDATE_CUSTOMER", payload: { id: selected.id, delayStartDate: event.target.value } })} className="mt-1 w-full rounded-xl bg-muted p-3 text-sm font-semibold text-foreground outline-none" /></label>
             <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Delay until<input type="date" value={(selectedBatch ? selectedBatch.delayEndDate : selected.delayEndDate) || ""} onChange={(event) => selectedBatch ? dispatch({ type: "UPDATE_KHATA_BATCH", payload: { id: selectedBatch.id, delayEndDate: event.target.value } }) : dispatch({ type: "UPDATE_CUSTOMER", payload: { id: selected.id, delayEndDate: event.target.value } })} className="mt-1 w-full rounded-xl bg-muted p-3 text-sm font-semibold text-foreground outline-none" /></label>
          </section>}

             {state.settings.gstPercentage ? (
             <button type="button" onClick={() => selectedBatch
               ? dispatch({ type: "UPDATE_KHATA_BATCH", payload: { id: selectedBatch.id, addGst: !selectedBatch.addGst } })
               : dispatch({ type: "UPDATE_CUSTOMER", payload: { id: selected.id, addGst: !selected.addGst } })}
               className={`w-full rounded-xl border p-3 text-left text-sm font-bold ${((selectedBatch ? selectedBatch.addGst : selected.addGst) ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-border bg-card text-muted-foreground")}`}>
               <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded border border-current">{(selectedBatch ? selectedBatch.addGst : selected.addGst) ? "✓" : ""}</span>
                Add GST ({state.settings.gstPercentage}%) {(selectedBatch ? selectedBatch.addGst : selected.addGst) ? `• ₹${getCustomerGst(selected, selectedBatchId || undefined).toLocaleString("en-IN")} added` : ""}
            </button>
          ) : null}

          <div className="grid grid-cols-3 gap-3">
             <button type="button" onClick={() => void generatePaymentQr(selected, selectedBatchId)} className="rounded-2xl bg-primary p-3 text-sm font-bold text-primary-foreground"><QrCode className="mx-auto mb-1" size={19} />Pay QR</button>
            <button type="button" onClick={openPayment} className="rounded-2xl bg-blue-500 p-3 text-sm font-bold text-white"><CirclePlus className="mx-auto mb-1" size={19} />Payment</button>
             <button type="button" onClick={() => setReceiptActionsOpen(true)} className="rounded-2xl bg-violet-500 p-3 text-sm font-bold text-white"><ReceiptText className="mx-auto mb-1" size={19} />Receipt</button>
          </div>

          <div className="grid grid-cols-3 border-b border-border">
            <button type="button" onClick={() => { setSelectedBatchId(null); setKhataTab("work"); }} className={`py-3 text-sm font-bold ${khataTab === "work" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>Work ({charges.length})</button>
            <button type="button" onClick={() => setKhataTab("payments")} className={`py-3 text-sm font-bold ${khataTab === "payments" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>Payments ({payments.length})</button>
            <button type="button" onClick={() => setKhataTab("bunched")} className={`py-3 text-sm font-bold ${khataTab === "bunched" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>Bunched ({state.khataBatches.filter((batch) => batch.customerId === selected.id).length})</button>
          </div>

           {selectedBatch && <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm"><strong className="block text-primary">Bunched logs</strong><span className="text-muted-foreground">{selectedBatch.startDate} → {selectedBatch.endDate} • {charges.length} logs. Tap Work to view these bundled entries.</span></div>}
           {khataTab === "work" ? (
              <>{!selectedBatch && <button type="button" onClick={() => { setBatchStart(charges.at(-1)?.date || ""); setBatchEnd(charges[0]?.date || ""); setBatchMessage(""); setBatchOpen(true); }} disabled={charges.length === 0} className="w-full rounded-2xl border border-amber-400/60 bg-[#3a2200] p-4 text-sm font-black text-amber-200 shadow-sm">Bundle these logs by date range</button>}{charges.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No work entries yet.</p> :
              <div className="space-y-3">{charges.map((entry) => {
                const vehicle = state.vehicles.find((item) => item.id === entry.vehicleId);
                const relatedLog = entry.logId ? state.logs.find((log) => log.id === entry.logId) : undefined;
                const isTripBased = vehicle?.type === "Hywa" || vehicle?.type === "Tipper";
                const measure = isTripBased ? `${relatedLog?.trips || 0} trips` : `${relatedLog?.hours || 0} hours`;
                return <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                  <div><div className="font-bold">{entry.description || "Work entry"}</div><div className="mt-1 text-xs text-muted-foreground">{entry.date} • {vehicle?.name || "Vehicle"} • {measure}</div></div>
                  <div className="flex items-center gap-3"><span className="font-black text-primary">₹{getChargeAmount(entry, selected).toLocaleString("en-IN")}</span><button type="button" aria-label="Delete work entry" onClick={() => { if (window.confirm("Delete this Khata work entry?")) entry.logId ? dispatch({ type: "DELETE_LOG", payload: entry.logId }) : dispatch({ type: "DELETE_LEDGER", payload: entry.id }); }} className="text-rose-300"><Trash2 size={16} /></button></div>
                </div>;
                })}</div>}</>
           ) : khataTab === "bunched" ? (
             <div className="space-y-3">
                {selectedBatchIds.length > 0 && <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/40 bg-[#1b2d3c] p-3 shadow-xl"><strong>{selectedBatchIds.length} bunch selected</strong><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void Promise.all(selectedBatchIds.map((batchId) => { const batch = state.khataBatches.find((item) => item.id === batchId); const customer = batch ? state.customers.find((item) => item.id === batch.customerId) : undefined; return batch && customer ? downloadReceipt(customer, batch.id) : Promise.resolve(); }))} className="rounded-lg bg-primary px-3 py-2 text-xs font-black text-primary-foreground"><Download size={13} className="mr-1 inline" />Export PDF</button><button type="button" onClick={unbundleSelected} className="rounded-lg border border-amber-400/40 px-3 py-2 text-xs font-black text-amber-200">Unbundle</button><button type="button" onClick={deleteSelectedBunchLogs} className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-black text-rose-300"><Trash2 size={13} className="mr-1 inline" />Delete logs</button></div></div>}
               {state.khataBatches.filter((batch) => batch.customerId === selected.id).length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No bunched work yet.</p> : state.khataBatches.filter((batch) => batch.customerId === selected.id).map((batch) => {
               const total = getBatchTotal(selected, batch.id);
               const isSelected = selectedBatchIds.includes(batch.id);
               return <div key={batch.id} onPointerDown={() => startBatchPress(batch.id)} onPointerUp={endBatchPress} onPointerCancel={endBatchPress} onContextMenu={(event) => event.preventDefault()} className={`rounded-2xl border p-4 ${isSelected ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-card"}`}><button type="button" onClick={() => { if (suppressBatchClick.current) { suppressBatchClick.current = false; return; } if (selectedBatchIds.length > 0) toggleBatchSelection(batch.id); else openBatch(batch.id); }} className="w-full text-left"><div className="flex items-start justify-between gap-3"><div><div className="font-black">{selected.name}</div><div className="text-xs text-muted-foreground">{batch.startDate} → {batch.endDate} • {batch.ledgerIds.length} logs</div></div>{isSelected && <span className="rounded-full bg-primary px-2 py-1 text-[10px] font-black text-primary-foreground">Selected</span>}</div><div className="mt-1 font-black text-primary">₹{total.toLocaleString("en-IN")}</div></button></div>;
            })}</div>
          ) : (
            payments.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No payments received yet.</p> :
              <div className="space-y-3">{payments.map((entry) => <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                <div><div className="font-bold">{entry.paymentMode || "Payment"} • Payment</div><div className="mt-1 text-xs text-muted-foreground">{entry.date} • {entry.description || "Received"}</div></div>
                <div className="flex items-center gap-3"><span className="font-black text-emerald-400">₹{entry.amount.toLocaleString("en-IN")}</span><button type="button" aria-label="Delete payment" onClick={() => { if (window.confirm("Delete this payment?")) dispatch({ type: "DELETE_LEDGER", payload: entry.id }); }} className="text-rose-300"><Trash2 size={16} /></button></div>
              </div>)}</div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void downloadReceipt(selected, selectedBatchId || undefined)} className="rounded-xl border border-border p-3 text-sm font-bold"><Download className="mr-1 inline" size={15} />PDF</button>
            <button type="button" onClick={() => void shareReceipt(selected, selectedBatchId || undefined)} className="rounded-xl border border-border p-3 text-sm font-bold"><Share2 className="mr-1 inline" size={15} />Share PDF</button>
          </div>
          {invoicePreview && <div className="rounded-xl border border-border bg-white overflow-hidden"><iframe title="Receipt preview" srcDoc={invoicePreview} className="h-[520px] w-full border-0" /><button type="button" onClick={openPrintWindow} className="w-full bg-primary p-3 font-bold text-primary-foreground">Open preview &amp; print</button></div>}
        </div>
        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogContent className="w-[90vw] max-w-sm rounded-2xl text-center">
            <DialogHeader><DialogTitle className="text-xl font-black">Payment QR</DialogTitle></DialogHeader>
            {qrDataUrl && <><div className="mb-3 text-center text-lg font-black">{state.settings.companyName || state.settings.businessName || "Fleetvix"}</div><img src={qrDataUrl} alt="Payment QR" className="mx-auto h-64 w-64 rounded-xl bg-white p-2" /><p className="text-sm text-muted-foreground">Scan to pay {Math.max(0, balance) ? `₹${Math.max(0, balance).toLocaleString("en-IN")}` : "any amount"}</p><div className="mt-3 flex justify-center gap-5"><button type="button" onClick={() => void downloadQr(selected)} className="text-sm font-bold text-primary"><Download className="mr-1 inline" size={14} />Download QR</button><button type="button" onClick={() => void shareQr(selected)} className="text-sm font-bold text-primary"><Share2 className="mr-1 inline" size={14} />Share QR</button></div></>}
          </DialogContent>
        </Dialog>
        <Dialog open={receiptActionsOpen} onOpenChange={setReceiptActionsOpen}>
          <DialogContent className="w-[90vw] max-w-sm rounded-2xl">
            <DialogHeader><DialogTitle className="text-xl font-black">Receipt</DialogTitle></DialogHeader>
            <div className="grid gap-3 pt-3">
              <button type="button" onClick={() => { setReceiptActionsOpen(false); void shareReceipt(selected, selectedBatchId || undefined); }} className="rounded-xl bg-primary p-4 font-bold text-primary-foreground"><Share2 className="mr-2 inline" size={18} />Share PDF</button>
              <button type="button" onClick={() => { setReceiptActionsOpen(false); void downloadReceipt(selected, selectedBatchId || undefined); }} className="rounded-xl border border-border p-4 font-bold"><Download className="mr-2 inline" size={18} />Download PDF</button>
              <button type="button" onClick={() => { setReceiptActionsOpen(false); printReceipt(selected, selectedBatchId || undefined); }} className="rounded-xl border border-border p-4 font-bold"><ReceiptText className="mr-2 inline" size={18} />View Receipt</button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogContent className="w-full max-w-md rounded-t-[28px] border-border bg-card p-6 sm:rounded-2xl">
            <DialogHeader><DialogTitle className="text-2xl font-black">Add Payment Received</DialogTitle></DialogHeader>
            <form onSubmit={handleLedgerSubmit} className="space-y-5 pt-2">
              <input aria-label="Amount" type="number" min="1" required value={ledgerData.amount || ""} onChange={(event) => setLedgerData({ ...ledgerData, amount: Number(event.target.value) })} placeholder="Amount ₹" className="w-full rounded-2xl border-2 border-primary bg-background p-6 text-center text-3xl font-black outline-none placeholder:text-muted-foreground" />
              <div><div className="mb-2 text-sm font-semibold text-muted-foreground">Payment Method</div><div className="flex gap-2 overflow-x-auto">
                {["Cash", "UPI", "Bank", "Cheque"].map((mode) => <button type="button" key={mode} onClick={() => setPaymentMode(mode)} className={`rounded-full border px-4 py-3 text-sm font-bold whitespace-nowrap ${ledgerData.paymentMode === mode ? "border-primary text-primary" : "border-border bg-background text-muted-foreground"}`}>{mode}</button>)}
              </div></div>
              <input value={ledgerData.description || ""} onChange={(event) => setLedgerData({ ...ledgerData, description: event.target.value })} placeholder="Note (optional)" className="w-full rounded-xl border border-border bg-background p-4 text-base outline-none" />
              <div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => setIsPaymentOpen(false)} className="rounded-2xl bg-[#244a7a] p-4 text-lg font-bold text-white">Cancel</button><button type="submit" className="rounded-2xl bg-emerald-500 p-4 text-lg font-bold text-white">＋ Add</button></div>
            </form>
          </DialogContent>
        </Dialog>
      </Layout>
    );
  }

  const visibleCustomers = state.customers.filter((customer) => {
    const matchesSearch = `${customer.name} ${customer.company || ""} ${customer.phone} ${customer.address || ""}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && Boolean(customer.completed) === (customerSection === "completed");
  });
  return (
    <Layout>
      <div className="fm-page-header">
        <div><h1>Khata Book</h1></div>
        <button type="button" className="fm-icon-button fm-primary-icon" onClick={() => setIsAddOpen(true)} aria-label="Add customer"><Plus size={24} strokeWidth={3} /></button>
      </div>
       <div className="border-b border-border bg-[#1b2d3c] px-5 py-4">
         <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers..." className="w-full bg-transparent py-1 pl-9 text-lg outline-none placeholder:text-muted-foreground" /></div>
          <div className="mt-4 grid grid-cols-3 rounded-xl bg-background/40 p-1">
           <button type="button" onClick={() => setCustomerSection("active")} className={`rounded-lg p-2 text-sm font-bold ${customerSection === "active" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Active Customers ({state.customers.filter((customer) => !customer.completed).length})</button>
           <button type="button" onClick={() => setCustomerSection("completed")} className={`rounded-lg p-2 text-sm font-bold ${customerSection === "completed" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Work Complete ({state.customers.filter((customer) => customer.completed).length})</button>
            <button type="button" onClick={() => setCustomerSection("bunched")} className={`rounded-lg p-2 text-sm font-bold ${customerSection === "bunched" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Bunched ({state.khataBatches.length})</button>
         </div>
       </div>
      <div className="px-5 py-5 pb-24 space-y-4">
        <div className="rounded-2xl border border-primary/20 bg-[#3a2200] p-4 text-sm text-amber-200">ⓘ Tap a customer to open Khata.</div>
           {customerSection === "bunched" ? (state.khataBatches.length === 0 ? <div className="fm-empty-state min-h-48 rounded-2xl border border-border bg-card"><Users size={48} /><p>No bunched logs yet</p></div> : <div className="space-y-3">
             {selectedBatchIds.length > 0 && <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/40 bg-[#1b2d3c] p-3 shadow-xl"><strong>{selectedBatchIds.length} bunch selected</strong><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void Promise.all(selectedBatchIds.map((batchId) => { const batch = state.khataBatches.find((item) => item.id === batchId); const customer = batch ? state.customers.find((item) => item.id === batch.customerId) : undefined; return batch && customer ? downloadReceipt(customer, batch.id) : Promise.resolve(); }))} className="rounded-lg bg-primary px-3 py-2 text-xs font-black text-primary-foreground"><Download size={13} className="mr-1 inline" />Export PDF</button><button type="button" onClick={unbundleSelected} className="rounded-lg border border-amber-400/40 px-3 py-2 text-xs font-black text-amber-200">Unbundle</button><button type="button" onClick={deleteSelectedBunchLogs} className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-black text-rose-300"><Trash2 size={13} className="mr-1 inline" />Delete logs</button></div></div>}
              {state.khataBatches.map((batch) => { const customer = state.customers.find((item) => item.id === batch.customerId); if (!customer) return null; const total = getBatchTotal(customer, batch.id); const isSelected = selectedBatchIds.includes(batch.id); return <div key={batch.id} onPointerDown={() => startBatchPress(batch.id)} onPointerUp={endBatchPress} onPointerCancel={endBatchPress} onContextMenu={(event) => event.preventDefault()} className={`rounded-2xl border p-4 ${isSelected ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-card"}`}><button type="button" onClick={() => { if (suppressBatchClick.current) { suppressBatchClick.current = false; return; } if (selectedBatchIds.length > 0) toggleBatchSelection(batch.id); else openBatch(batch.id); }} className="w-full text-left"><div className="flex items-start justify-between gap-3"><div><div className="font-black">{customer.name}</div><div className="text-xs text-muted-foreground">{batch.startDate} → {batch.endDate} • {batch.ledgerIds.length} logs</div></div>{isSelected && <span className="rounded-full bg-primary px-2 py-1 text-[10px] font-black text-primary-foreground">Selected</span>}</div><div className="mt-1 font-black text-primary">₹{total.toLocaleString("en-IN")}</div></button></div>; })}
           </div>) :
          visibleCustomers.length === 0 ? <div className="fm-empty-state min-h-48 rounded-2xl border border-border bg-card"><Users size={48} /><p>{customerSection === "completed" ? "No completed customers yet" : "No customers yet"}</p></div> :
          visibleCustomers.map((customer) => {
            const total = getCustomerSubtotal(customer.id) + getCustomerGst(customer);
             return <div key={customer.id} onClick={() => { setSelectedCustomer(customer.id); setKhataTab("work"); }} className="w-full cursor-pointer rounded-2xl border border-[#244a7a] bg-card p-4 text-left transition-colors active:bg-secondary">
              <div className="grid grid-cols-[4rem_minmax(0,1fr)_5.5rem] items-center gap-3"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#454545] text-3xl font-black text-primary">{customer.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><h3 className="break-words text-base font-black leading-tight">{customer.name}</h3><div className="mt-1 flex min-w-0 items-center gap-1 truncate text-sm text-muted-foreground"><Phone size={14} className="shrink-0" />{customer.phone}</div>{customer.address && <div className="truncate text-sm text-muted-foreground">{customer.address}</div>}<div className="mt-1 text-sm text-muted-foreground">{getCustomerCharges(customer.id).length} work logs</div></div><div className="min-w-0 text-right"><div className="break-all text-base font-black leading-tight text-primary">₹{total.toLocaleString("en-IN")}</div><div className="text-[11px] leading-tight text-muted-foreground">Total Work</div><div className="mt-2 text-muted-foreground">›</div></div></div>
                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                 <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedCustomer(customer.id); setKhataTab("work"); }} className="rounded-xl bg-primary/15 p-2 text-sm font-bold text-primary">{customerSection === "completed" ? "Open history" : "Open Khata"}</button>
                 {customerSection === "completed"
                    ? <button type="button" onClick={(event) => { event.stopPropagation(); navigator.vibrate?.(50); dispatch({ type: "TOGGLE_CUSTOMER_COMPLETE", payload: customer.id }); }} className="rounded-xl bg-emerald-500 p-2 text-sm font-bold text-white">Active Customer</button>
                      : <button type="button" onClick={(event) => { event.stopPropagation(); navigator.vibrate?.(50); dispatch({ type: "TOGGLE_CUSTOMER_COMPLETE", payload: customer.id }); }} className="rounded-xl border border-amber-400/50 p-2 text-sm font-bold text-amber-300">Inactive Customer</button>}
                  <button type="button" onClick={(event) => { event.stopPropagation(); deleteCustomer(customer); }} className="flex items-center justify-center rounded-xl border border-rose-400/40 p-2 text-rose-300" aria-label={`Delete ${customer.name}`}><Trash2 size={18} /></button>
               </div>
             </div>;
          })}
      </div>
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[90vw] max-w-md rounded-2xl"><DialogHeader><DialogTitle className="text-xl font-bold">Add Customer</DialogTitle></DialogHeader>
          <form onSubmit={handleCustomerSubmit} className="space-y-4 pt-3">
            <input required value={customerData.name || ""} onChange={(event) => setCustomerData({ ...customerData, name: event.target.value })} placeholder="Customer name" className="w-full rounded-xl bg-muted p-4 font-semibold outline-none" />
            <input required type="tel" value={customerData.phone || ""} onChange={(event) => setCustomerData({ ...customerData, phone: event.target.value })} placeholder="Phone number" className="w-full rounded-xl bg-muted p-4 font-semibold outline-none" />
            <input value={customerData.company || ""} onChange={(event) => setCustomerData({ ...customerData, company: event.target.value })} placeholder="Company (optional)" className="w-full rounded-xl bg-muted p-4 font-semibold outline-none" />
            <textarea value={customerData.address || ""} onChange={(event) => setCustomerData({ ...customerData, address: event.target.value })} placeholder="Address / site location (optional)" className="min-h-20 w-full rounded-xl bg-muted p-4 font-semibold outline-none" />
            <button type="submit" className="w-full rounded-xl bg-foreground p-4 font-bold text-background">Save Customer</button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
         <DialogContent className="w-[90vw] max-w-md rounded-2xl"><DialogHeader><DialogTitle>Bundle customer logs</DialogTitle></DialogHeader><form onSubmit={createBatch} className="space-y-4 pt-3"><p className="text-sm text-muted-foreground">Charges in this range will be grouped under Bunched. Their payments, receipts, and customer details stay intact.</p><label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Start date<input required type="date" value={batchStart} onChange={(event) => { setBatchStart(event.target.value); setBatchMessage(""); }} className="mt-1 w-full rounded-xl bg-muted p-4 font-semibold" /></label><label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">End date<input required type="date" value={batchEnd} onChange={(event) => { setBatchEnd(event.target.value); setBatchMessage(""); }} className="mt-1 w-full rounded-xl bg-muted p-4 font-semibold" /></label>{batchMessage && <p className="rounded-xl bg-amber-500/10 p-3 text-sm font-semibold text-amber-200">{batchMessage}</p>}<button type="submit" className="w-full rounded-xl bg-primary p-4 font-black text-primary-foreground">Create Bunched Group</button></form></DialogContent>
      </Dialog>
    </Layout>
  );
}