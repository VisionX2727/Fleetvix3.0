import { Layout } from "@/components/layout";
import { useStore } from "@/lib/store";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, Clock3, IndianRupee, UserX } from "lucide-react";

export default function DriverPayments() {
  const { state } = useStore();
  const driver = state.drivers[0];
  const paidIds = new Set(state.driverPays.flatMap((payment) => payment.logIds || []));
  const pendingLogs = state.logs.filter((log) => !paidIds.has(log.id)).sort((a, b) => b.date.localeCompare(a.date));
  const driverRate = (log: typeof pendingLogs[number]) => log.driverDailyRate ?? driver?.dailyRate ?? 0;
  const workMeasure = (log: typeof pendingLogs[number]) => {
    const vehicle = state.vehicles.find((item) => item.id === log.vehicleId);
    return vehicle?.type === "Hywa" || vehicle?.type === "Tipper" ? `${log.trips || 0} trips` : `${log.hours || 0} hours`;
  };
  const pendingAmount = pendingLogs.reduce((sum, log) => sum + driverRate(log), 0);
  const paidAmount = state.driverPays.reduce((sum, payment) => sum + payment.amount, 0);
  const absentDates = (state.driverAbsentDates || []).filter((date) => date.startsWith(new Date().toISOString().slice(0, 7))).sort().reverse();

  return (
    <Layout>
      <div className="flex items-center gap-2 border-b border-border bg-[#1b2d3c] px-5 py-4">
        <Link href="/" className="text-muted-foreground"><ArrowLeft size={22} /></Link>
        <div><h1 className="text-2xl font-black">Payments</h1><p className="text-xs text-muted-foreground">Your pending and paid work</p></div>
      </div>
      <main className="fm-page-content space-y-5 pb-24">
        <div className="fm-overview-grid">
          <div className="fm-overview-stat"><Clock3 className="mx-auto mb-2 text-amber-300" size={22} /><strong>₹{pendingAmount.toLocaleString("en-IN")}</strong><span>Pending</span></div>
          <div className="fm-overview-stat"><CheckCircle2 className="mx-auto mb-2 text-emerald-400" size={22} /><strong>₹{paidAmount.toLocaleString("en-IN")}</strong><span>Paid</span></div>
        </div>
        <section>
          <div className="fm-section-heading"><h2>Pending</h2><span className="text-xs text-muted-foreground">{pendingLogs.length} entries</span></div>
           {pendingLogs.length ? <div className="space-y-2">{pendingLogs.map((log) => <div key={log.id} className="fm-list-row"><div><strong>{log.date} • {state.vehicles.find((vehicle) => vehicle.id === log.vehicleId)?.name || "Vehicle"}</strong><small>{log.description || "Work entry"} • {workMeasure(log)} • Vehicle work ₹{log.amount.toLocaleString("en-IN")}</small></div><div className="text-right"><div className="font-black text-amber-300">₹{driverRate(log).toLocaleString("en-IN")}</div><small>Earned</small></div></div>)}</div> : <div className="fm-card p-5 text-sm text-muted-foreground">No pending work.</div>}
        </section>
        <section>
          <div className="fm-section-heading"><h2>Paid History</h2></div>
          {state.driverPays.length || absentDates.length ? <div className="space-y-3">
             {state.driverPays.slice().reverse().map((payment) => {
              const paidDays = (payment.logIds || []).map((id) => state.logs.find((log) => log.id === id)?.date).filter((date): date is string => Boolean(date));
               const paidLogs = (payment.logIds || []).map((id) => state.logs.find((log) => log.id === id)).filter((log): log is NonNullable<typeof log> => Boolean(log));
               return <div key={payment.id} className="fm-card p-4"><div className="flex items-start justify-between gap-3"><div><strong>{payment.description || "Driver payment"}</strong><small className="mt-1 block">{payment.date} • {paidDays.length || payment.logIds?.length || 0} paid work day(s)</small></div><div className="font-black text-emerald-400">₹{payment.amount.toLocaleString("en-IN")}</div></div>{paidLogs.length > 0 && <div className="mt-3 space-y-2">{paidLogs.map((log) => <div key={log.id} className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-2 py-2 text-xs"><span>{log.date} • {state.vehicles.find((vehicle) => vehicle.id === log.vehicleId)?.name || "Vehicle"} • {workMeasure(log)}<br /><span className="text-muted-foreground">Vehicle work ₹{log.amount.toLocaleString("en-IN")}</span></span><strong className="text-emerald-300">Earned ₹{driverRate(log).toLocaleString("en-IN")}</strong></div>)}</div>}</div>;
            })}
            {absentDates.length > 0 && <div className="fm-card p-4"><div className="mb-2 flex items-center gap-2 font-black text-rose-300"><UserX size={16} />Absent days — no pay added</div><div className="flex flex-wrap gap-2">{absentDates.map((date) => <span key={date} className="rounded-lg bg-rose-500/10 px-2 py-1 text-xs font-bold text-rose-300">{date} • ₹0</span>)}</div></div>}
          </div> : <div className="fm-card p-5 text-sm text-muted-foreground">No paid history yet.</div>}
        </section>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground"><IndianRupee size={14} /> Payments are recorded by the owner.</div>
      </main>
    </Layout>
  );
}