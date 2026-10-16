import { Layout } from "@/components/layout";
import { useStore } from "@/lib/store";
import { BarChart3, TrendingUp, Fuel, Users, Share2, Layers3, LineChart } from "lucide-react";
import { useState } from "react";
import { createHtmlPdf } from "@/lib/pdf";

function escapeReport(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character));
}

export default function Analytics() {
  const { state } = useStore();
  const [filter, setFilter] = useState<"All" | string>("All");
  const [range, setRange] = useState<"Today" | "This Week" | "This Month">("Today");
  const month = new Date().toISOString().substring(0, 7);
  const today = new Date().toISOString().split("T")[0];
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const inRange = (date: string) => {
    if (range === "Today") return date === today;
    if (range === "This Week") return date >= weekStart.toISOString().split("T")[0] && date <= today;
    return date.startsWith(month);
  };

  const relevantLogs = state.logs.filter((log) => (filter === "All" || log.vehicleId === filter) && inRange(log.date));
  const relevantDays = state.fleetDays.filter((day) => (filter === "All" || day.vehicleId === filter) && inRange(day.date));
  const relevantFuel = state.fuelRecords.filter((fuel) => (filter === "All" || fuel.vehicleId === filter) && inRange(fuel.date));
  const totalRevenue = relevantLogs.reduce((sum, log) => sum + log.amount, 0) + relevantDays.reduce((sum, day) => sum + day.amount, 0);
  const totalFuel = relevantFuel.reduce((sum, fuel) => sum + fuel.cost, 0);
  const fuelLiters = relevantFuel.reduce((sum, fuel) => sum + fuel.quantity, 0) + relevantDays.reduce((sum, day) => sum + day.diesel, 0);
  const totalHours = relevantLogs.reduce((sum, log) => sum + log.hours, 0) + relevantDays.reduce((sum, day) => sum + day.hours, 0);
  const driverCost = relevantLogs.reduce((sum, log) => sum + (log.driverDailyRate ?? state.drivers.find((driver) => driver.id === log.driverId)?.dailyRate ?? 0), 0);
  const netProfit = totalRevenue - totalFuel - driverCost;
  const workingDays = new Set([...relevantLogs.map((log) => log.date), ...relevantDays.map((day) => day.date)]).size;
  const avgDay = workingDays ? Math.round(totalRevenue / workingDays) : 0;
  const totalExpenses = totalFuel + driverCost;
  const hasAnalyticsData = totalRevenue > 0 || totalExpenses > 0 || workingDays > 0;
  const ringTotal = totalRevenue + totalExpenses;
  const revenuePercent = ringTotal > 0 ? Math.min(100, Math.max(0, (totalRevenue / ringTotal) * 100)) : 0;
  const ringStyle = {
    background: hasAnalyticsData
      ? `conic-gradient(#34d399 0 ${revenuePercent}%, #fb7185 ${revenuePercent}% 100%)`
      : "conic-gradient(#253445 0 100%)",
  };
  const reportHtml = () => {
    const vehicleRows = state.vehicles.map((vehicle) => {
      const revenue = state.logs.filter((log) => log.vehicleId === vehicle.id && inRange(log.date)).reduce((sum, log) => sum + log.amount, 0) + state.fleetDays.filter((day) => day.vehicleId === vehicle.id && inRange(day.date)).reduce((sum, day) => sum + day.amount, 0);
      const fuel = relevantFuel.filter((record) => record.vehicleId === vehicle.id).reduce((sum, record) => sum + record.cost, 0);
      return `<tr><td>${escapeReport(vehicle.name)}</td><td>₹${revenue.toLocaleString("en-IN")}</td><td>₹${fuel.toLocaleString("en-IN")}</td><td>₹${(revenue - fuel).toLocaleString("en-IN")}</td></tr>`;
    }).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#eef1f4;font:14px Arial;color:#18202b}.sheet{width:794px;min-height:1123px;background:#fff;padding:36px}.brand{border-bottom:4px solid #f5b91d;padding-bottom:18px}.brand h1{margin:0;font-size:30px}.muted{color:#687386}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0}.kpi{border:1px solid #d7dde5;border-radius:10px;padding:14px}.kpi b{display:block;font-size:21px;margin-top:6px}.section{margin-top:22px}.section h2{font-size:17px;border-bottom:1px solid #d7dde5;padding-bottom:7px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d7dde5;padding:9px;text-align:left}th{background:#f4f6f8}td:not(:first-child),th:not(:first-child){text-align:right}</style></head><body><main class="sheet"><header class="brand"><h1>${escapeReport(state.settings.companyName || state.settings.businessName || "Fleetvix")} — Analytics Report</h1><p class="muted">${escapeReport(range)} • ${escapeReport(filter === "All" ? "All vehicles" : state.vehicles.find((vehicle) => vehicle.id === filter)?.name || filter)}</p></header><section class="kpis"><div class="kpi">Revenue<b>₹${totalRevenue.toLocaleString("en-IN")}</b></div><div class="kpi">Expenses<b>₹${totalExpenses.toLocaleString("en-IN")}</b></div><div class="kpi">Net Profit<b>₹${netProfit.toLocaleString("en-IN")}</b></div><div class="kpi">Fuel<b>${fuelLiters.toLocaleString("en-IN")} L</b></div><div class="kpi">Driver Cost<b>₹${driverCost.toLocaleString("en-IN")}</b></div><div class="kpi">Working Days<b>${workingDays}</b></div></section><section class="section"><h2>Vehicle Performance</h2><table><thead><tr><th>Vehicle</th><th>Revenue</th><th>Fuel</th><th>Contribution</th></tr></thead><tbody>${vehicleRows || "<tr><td colspan='4'>No vehicle data</td></tr>"}</tbody></table></section><section class="section"><h2>Report Details</h2><p>Logs: ${relevantLogs.length} • Fuel records: ${relevantFuel.length} • Driver expense: ₹${driverCost.toLocaleString("en-IN")} • Average per working day: ₹${avgDay.toLocaleString("en-IN")}</p></section></main></body></html>`;
  };
  const shareReport = async () => {
    const blob = await createHtmlPdf(reportHtml());
    const file = new File([blob], `fleetvix-analytics-${today}.pdf`, { type: "application/pdf" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ title: "Fleetvix Analytics Report", text: `${range} analytics report`, files: [file] });
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <header className="fm-page-header">
        <div><h1>Analytics</h1></div>
        <button type="button" onClick={() => void shareReport()} className="fm-primary-button !rounded-full !px-4 !py-2 text-sm"><Share2 size={16} /> Share Report</button>
      </header>
      <div className="fm-filter-row">
        {(["Today", "This Week", "This Month"] as const).map((item) => <button type="button" key={item} onClick={() => setRange(item)} className={`fm-filter-pill ${range === item ? "is-selected" : ""}`}>{item}</button>)}
      </div>
      <div className="px-4 py-3 bg-background">
         <button type="button" onClick={() => setFilter("All")} className={`fm-filter-pill !border !border-primary !bg-transparent !text-white ${filter === "All" ? "is-selected !bg-primary !text-white" : ""}`}><Layers3 size={15} /> All Vehicles</button>
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {state.vehicles.map((vehicle) => <button type="button" key={vehicle.id} onClick={() => setFilter(vehicle.id)} className={`fm-filter-pill ${filter === vehicle.id ? "is-selected" : ""}`}>{vehicle.name}</button>)}
        </div>
      </div>
      <main className="fm-page-content space-y-5">
        <section className="fm-card flex items-center gap-4 p-5">
           <div className="fm-ring shrink-0" style={ringStyle}><div className="fm-ring-content">{hasAnalyticsData ? <><strong className={netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}>₹{netProfit.toLocaleString("en-IN")}</strong><span>Net Profit</span></> : <span>No data</span>}</div></div>
          <div className="flex-1 space-y-4">
            <div><span className="flex items-center gap-2 text-xs text-muted-foreground"><i className="h-3 w-3 rounded-full bg-emerald-400" />Revenue</span><strong className="ml-5 block text-lg text-emerald-400">₹{totalRevenue.toLocaleString("en-IN")}</strong></div>
            <div><span className="flex items-center gap-2 text-xs text-muted-foreground"><i className="h-3 w-3 rounded-full bg-rose-400" />Expenses</span><strong className="ml-5 block text-lg text-rose-400">₹{(totalFuel + driverCost).toLocaleString("en-IN")}</strong></div>
             <div className={`rounded-xl border p-3 ${netProfit >= 0 ? "border-emerald-400/20 bg-emerald-400/10" : "border-rose-400/20 bg-rose-400/10"}`}><span className="text-xs text-muted-foreground">Net Profit</span><strong className={`block text-lg ${netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>₹{netProfit.toLocaleString("en-IN")}</strong></div>
          </div>
        </section>
        <section className="grid grid-cols-2 gap-3">
          <div className="fm-card p-4"><BarChart3 className="mb-3 text-primary" size={18} /><span className="text-xs font-black tracking-wider text-muted-foreground">Working Days</span><strong className="mt-1 block text-xl font-black text-primary">{workingDays}</strong></div>
          <div className="fm-card p-4"><Fuel className="mb-3 text-blue-400" size={18} /><span className="text-xs font-black tracking-wider text-muted-foreground">Fuel</span><strong className="mt-1 block text-xl font-black text-blue-400">{fuelLiters}L</strong><small className="text-muted-foreground">₹{totalFuel.toLocaleString("en-IN")}</small></div>
          <div className="fm-card p-4"><Users className="mb-3 text-violet-400" size={18} /><span className="text-xs font-black tracking-wider text-muted-foreground">Driver Cost</span><strong className="mt-1 block text-xl font-black text-violet-400">₹{driverCost.toLocaleString("en-IN")}</strong></div>
          <div className="fm-card p-4"><TrendingUp className="mb-3 text-emerald-400" size={18} /><span className="text-xs font-black tracking-wider text-muted-foreground">Avg/Day</span><strong className="mt-1 block text-xl font-black text-emerald-400">₹{avgDay.toLocaleString("en-IN")}</strong></div>
        </section>
        <section className="fm-card p-4 min-h-44">
          {workingDays === 0 ? <div className="flex h-36 flex-col items-center justify-center text-center"><LineChart className="mb-3 text-muted-foreground" size={44} /><h2 className="text-lg font-black">No Data</h2><p className="mt-2 text-sm text-muted-foreground">Add work logs to see analytics</p></div> : <>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black uppercase tracking-wider">Vehicle performance</h2><span className="text-xs text-muted-foreground">{month}</span></div>
          <div className="fm-stack">
            {state.vehicles.length === 0 ? <p className="fm-muted">Add a vehicle to see separate profit, fuel, and driver data.</p> : state.vehicles.map((vehicle) => {
              const vehicleRevenue = state.logs.filter((log) => log.vehicleId === vehicle.id && log.date.startsWith(month)).reduce((sum, log) => sum + log.amount, 0) + state.fleetDays.filter((day) => day.vehicleId === vehicle.id && day.date.startsWith(month)).reduce((sum, day) => sum + day.amount, 0);
              const vehicleFuel = state.fuelRecords.filter((fuel) => fuel.vehicleId === vehicle.id && fuel.date.startsWith(month)).reduce((sum, fuel) => sum + fuel.cost, 0);
               const vehicleDrivers = state.logs.filter((log) => log.vehicleId === vehicle.id && log.date.startsWith(month)).reduce((sum, log) => sum + (log.driverDailyRate ?? state.drivers.find((driver) => driver.id === log.driverId)?.dailyRate ?? 0), 0);
              return <div className="fm-list-row" key={vehicle.id}><div><strong>{vehicle.name}</strong><small>Revenue ₹{vehicleRevenue.toLocaleString("en-IN")} • Fuel ₹{vehicleFuel.toLocaleString("en-IN")}</small></div><div className="fm-list-value text-primary">₹{(vehicleRevenue - vehicleFuel - vehicleDrivers).toLocaleString("en-IN")}</div></div>;
            })}
          </div>
          </>}
        </section>
      </main>
    </Layout>
  );
}