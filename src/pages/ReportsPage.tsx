import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useStorage } from "../hooks/useStorage";
import { useTransactions } from "../hooks/useTransactions";
import { useCategories } from "../hooks/useCategories";
import { useParentBudgets } from "../hooks/useParentBudgets";
import { useAccounts } from "../hooks/useAccounts";
import { formatCurrency } from "../utils/currency";
import { addMonths, formatMonthYear, formatDate, getCurrentMonth } from "../utils/date";
import MonthPicker from "../components/ui/MonthPicker";
import type { ParentBudget, Account } from "../types";

const CHART_COLORS = [
  "#6366f1", "#8b5cf6", "#f97316", "#10b981",
  "#ef4444", "#eab308", "#14b8a6", "#ec4899",
];

/** Human-readable period string for a budget. */
function budgetPeriod(b: ParentBudget): string {
  const type = b.budgetType ?? "custom";
  if (type === "monthly" && b.month) return formatMonthYear(b.month);
  if (b.startDate && b.endDate)
    return `${formatDate(b.startDate)} – ${formatDate(b.endDate)}`;
  return "";
}

export default function ReportsPage() {
  const { settings } = useStorage();
  const { transactions } = useTransactions();
  const { categories } = useCategories();
  const { accounts } = useAccounts();
  const { parentBudgets, allocations } = useParentBudgets();
  const [month, setMonth] = useState(getCurrentMonth());
  const [selectedReportId, setSelectedReportId] = useState<string>("overview");

  const catMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const fmt = (n: number) =>
    formatCurrency(n, settings.currencySymbol, settings.locale);

  const currencyFmt = (
    n: number | string | readonly (number | string)[] | undefined,
  ) => {
    const numeric = Array.isArray(n) ? Number(n[0] ?? 0) : Number(n ?? 0);
    return fmt(numeric);
  };

  // Filter budgets by selected month for the dropdown selector
  const filteredBudgetsForMonth = useMemo(() => {
    return parentBudgets.filter((b) => {
      const type = b.budgetType ?? "custom";
      if (type === "monthly") return b.month === month;
      if (b.startDate && b.endDate) {
        const monthStart = `${month}-01`;
        const [y, m] = month.split("-").map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;
        return b.startDate <= monthEnd && b.endDate >= monthStart;
      }
      return true;
    });
  }, [parentBudgets, month]);

  // Determine selected report target (Overview vs Account vs Budget)
  const selectedAccountId = selectedReportId.startsWith("account:") ? selectedReportId.slice(8) : null;
  const selectedBudgetId = selectedReportId.startsWith("budget:") ? selectedReportId.slice(7) : (selectedReportId === "overview" ? "overview" : null);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const selectedBudget = filteredBudgetsForMonth.find(b => b.id === selectedBudgetId);

  // ── Overview charts controls ──────────────────────────────────────────────
  const [chartMonths, setChartMonths] = useState<number>(6);
  const [chartDimension, setChartDimension] = useState<'all' | 'account' | 'category' | 'merchant'>('all');
  const [chartFilterValue, setChartFilterValue] = useState<string>('');

  const merchantsList = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.merchant?.trim()) {
        const name = tx.merchant.trim();
        map.set(name, (map.get(name) ?? 0) + 1);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [transactions]);

  const chartData = useMemo(() => {
    const months: Array<{ month: string; income: number; expense: number }> = [];
    for (let i = chartMonths - 1; i >= 0; i--) {
      const cursor = addMonths(month, -i);
      let monthTxs = transactions.filter((tx) => tx.date.startsWith(cursor));

      if (chartDimension === 'account' && chartFilterValue) {
        monthTxs = monthTxs.filter(
          tx => tx.accountId === chartFilterValue || tx.toAccountId === chartFilterValue
        );
      } else if (chartDimension === 'category' && chartFilterValue) {
        monthTxs = monthTxs.filter(tx => tx.categoryId === chartFilterValue);
      } else if (chartDimension === 'merchant' && chartFilterValue) {
        monthTxs = monthTxs.filter(tx => tx.merchant?.trim() === chartFilterValue);
      }

      months.push({
        month: formatMonthYear(cursor),
        income: monthTxs.filter(tx => tx.type === "income").reduce((s, tx) => s + tx.amount, 0),
        expense: monthTxs.filter(tx => tx.type === "expense").reduce((s, tx) => s + tx.amount, 0),
      });
    }
    return months;
  }, [transactions, month, chartMonths, chartDimension, chartFilterValue]);

  const chartFilterLabel = useMemo(() => {
    if (chartDimension === 'account') {
      const acc = accounts.find(a => a.id === chartFilterValue);
      return acc ? `${acc.name} Account` : 'Selected Account';
    }
    if (chartDimension === 'category') {
      const cat = catMap.get(chartFilterValue);
      return cat ? `${cat.name} Category` : 'Selected Category';
    }
    if (chartDimension === 'merchant') {
      return chartFilterValue ? `Merchant: ${chartFilterValue}` : 'Selected Merchant';
    }
    return 'All Spending & Income';
  }, [chartDimension, chartFilterValue, accounts, catMap]);

  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const tx of transactions) {
      if (!tx.date.startsWith(month) || tx.type !== "expense" || !tx.categoryId) continue;
      totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + tx.amount);
    }
    return Array.from(totals.entries())
      .map(([categoryId, amount]) => ({
        name: catMap.get(categoryId)?.name ?? "Unknown",
        value: amount,
        color: catMap.get(categoryId)?.color ?? "#64748b",
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, month, catMap]);

  const overviewReport = useMemo(() => {
    const monthTxs = transactions.filter(
      tx => tx.date.startsWith(month),
    );
    const incomeTxs = monthTxs.filter(tx => tx.type === "income");
    const expenseTxs = monthTxs.filter(tx => tx.type === "expense");

    const totalIncome = incomeTxs.reduce((s, tx) => s + tx.amount, 0);
    const totalExpense = expenseTxs.reduce((s, tx) => s + tx.amount, 0);
    const netSavings = totalIncome - totalExpense;

    const byCategory = new Map<
      string,
      { total: number; merchants: Map<string, number> }
    >();

    for (const tx of expenseTxs) {
      const catId = tx.categoryId ?? "__uncat__";
      if (!byCategory.has(catId)) byCategory.set(catId, { total: 0, merchants: new Map() });
      const entry = byCategory.get(catId)!;
      entry.total += tx.amount;
      const merchant = tx.merchant?.trim() || "Unknown";
      entry.merchants.set(merchant, (entry.merchants.get(merchant) ?? 0) + tx.amount);
    }

    const rows = Array.from(byCategory.keys())
      .map(catId => ({
        catId,
        category: catMap.get(catId),
        allocated: 0,
        spent: byCategory.get(catId)?.total ?? 0,
        merchants: Array.from(byCategory.get(catId)!.merchants.entries())
          .sort((a, b) => b[1] - a[1]),
      }))
      .sort((a, b) => b.spent - a.spent);

    return { totalIncome, totalExpense, netSavings, rows };
  }, [transactions, month, catMap]);

  // ── Account-specific analytics report ────────────────────────────────────

  const accountReport = useMemo(() => {
    if (!selectedAccount) return null;

    const accountTxs = transactions.filter(
      tx => (tx.accountId === selectedAccount.id || tx.toAccountId === selectedAccount.id) && tx.date.startsWith(month),
    );

    let totalInflow = 0;
    let totalOutflow = 0;

    const byCategory = new Map<string, { total: number; merchants: Map<string, number> }>();

    for (const tx of accountTxs) {
      if (tx.type === "income" && tx.accountId === selectedAccount.id) {
        totalInflow += tx.amount;
      } else if (tx.type === "expense" && tx.accountId === selectedAccount.id) {
        totalOutflow += tx.amount;
        const catId = tx.categoryId ?? "__uncat__";
        if (!byCategory.has(catId)) byCategory.set(catId, { total: 0, merchants: new Map() });
        const entry = byCategory.get(catId)!;
        entry.total += tx.amount;
        const merchant = tx.merchant?.trim() || "Unknown";
        entry.merchants.set(merchant, (entry.merchants.get(merchant) ?? 0) + tx.amount);
      } else if (tx.type === "transfer") {
        if (tx.toAccountId === selectedAccount.id) totalInflow += tx.amount;
        if (tx.accountId === selectedAccount.id) totalOutflow += tx.amount;
      }
    }

    const rows = Array.from(byCategory.keys())
      .map(catId => ({
        catId,
        category: catMap.get(catId),
        allocated: 0,
        spent: byCategory.get(catId)?.total ?? 0,
        merchants: Array.from(byCategory.get(catId)!.merchants.entries())
          .sort((a, b) => b[1] - a[1]),
      }))
      .sort((a, b) => b.spent - a.spent);

    return {
      totalInflow,
      totalOutflow,
      netMovement: totalInflow - totalOutflow,
      rows,
      accountTxs,
    };
  }, [selectedAccount, transactions, month, catMap]);

  // ── Budget-specific report ───────────────────────────────────────────────

  const budgetReport = useMemo(() => {
    if (!selectedBudget) return null;

    const budgetTxs = transactions.filter(
      tx => tx.budgetId === selectedBudget.id && tx.type === "expense" && tx.date.startsWith(month),
    );
    const totalSpent = budgetTxs.reduce((s, tx) => s + tx.amount, 0);

    // Group by category: total + merchant breakdown
    const byCategory = new Map<
      string,
      { total: number; merchants: Map<string, number> }
    >();

    for (const tx of budgetTxs) {
      const catId = tx.categoryId ?? "__uncat__";
      if (!byCategory.has(catId)) byCategory.set(catId, { total: 0, merchants: new Map() });
      const entry = byCategory.get(catId)!;
      entry.total += tx.amount;
      const merchant = tx.merchant?.trim() || "Unknown";
      entry.merchants.set(merchant, (entry.merchants.get(merchant) ?? 0) + tx.amount);
    }

    // Merge with allocations for this budget
    const budgetAllocs = allocations.filter(a => a.budgetId === selectedBudget.id);
    const allocMap = new Map(budgetAllocs.map(a => [a.categoryId, a.amount]));

    // Build sorted rows (allocated categories first, then any unallocated spend)
    const allCatIds = new Set([
      ...budgetAllocs.map(a => a.categoryId),
      ...byCategory.keys(),
    ]);

    const rows = Array.from(allCatIds)
      .map(catId => ({
        catId,
        category: catMap.get(catId),
        allocated: allocMap.get(catId) ?? 0,
        spent: byCategory.get(catId)?.total ?? 0,
        merchants: byCategory.get(catId)
          ? Array.from(byCategory.get(catId)!.merchants.entries())
            .sort((a, b) => b[1] - a[1])
          : [],
      }))
      .sort((a, b) => b.spent - a.spent);

    return { totalSpent, rows };
  }, [selectedBudget, transactions, allocations, catMap, month]);

  const isEmpty = transactions.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
      </div>

      {/* Month Selector */}
      <MonthPicker month={month} onChange={setMonth} />

      {/* Report / Account / Budget Selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3">
        <label htmlFor="report-select" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
          View Report / Analytics For
        </label>
        <select
          id="report-select"
          value={selectedReportId}
          onChange={e => setSelectedReportId(e.target.value)}
          className="w-full bg-transparent text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
        >
          <option value="overview">📊 Overview ({formatMonthYear(month)})</option>
          {accounts.length > 0 && (
            <optgroup label="Account Analytics">
              {accounts.map(acc => (
                <option key={acc.id} value={`account:${acc.id}`}>
                  {acc.type === "credit_card" ? "💳" : "🏦"} {acc.name}
                </option>
              ))}
            </optgroup>
          )}
          {filteredBudgetsForMonth.length > 0 && (
            <optgroup label="Budget Reports">
              {filteredBudgetsForMonth.map(b => (
                <option key={b.id} value={`budget:${b.id}`}>
                  🎯 {b.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {isEmpty ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center">
          <span className="text-4xl" aria-hidden="true">📊</span>
          <p className="mt-3 font-semibold text-slate-700 dark:text-slate-300">No data yet</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Add transactions to unlock trends and analytics.
          </p>
        </div>
      ) : selectedAccount && accountReport ? (
        /* ── Account-wise analytics report ── */
        <AccountAnalyticsReport
          account={selectedAccount}
          report={accountReport}
          fmt={fmt}
        />
      ) : selectedBudget && budgetReport ? (
        /* ── Budget detail report ── */
        <BudgetDetailReport
          budget={selectedBudget}
          report={budgetReport}
          fmt={fmt}
        />
      ) : (
        /* ── Overview mode ── */
        <div className="space-y-4">
          {/* Monthly Income & Expense Summary Card */}
          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3" aria-label="Monthly overview summary">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Monthly Summary — {formatMonthYear(month)}
            </h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 border border-emerald-100 dark:border-emerald-900/30">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Income</p>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  +{fmt(overviewReport.totalIncome)}
                </p>
              </div>
              <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-3 border border-rose-100 dark:border-rose-900/30">
                <p className="text-xs font-medium text-rose-700 dark:text-rose-300">Expense</p>
                <p className="text-base font-bold text-rose-600 dark:text-rose-400 mt-1">
                  -{fmt(overviewReport.totalExpense)}
                </p>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 border border-indigo-100 dark:border-indigo-900/30">
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Net</p>
                <p className={`text-base font-bold mt-1 ${overviewReport.netSavings >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {overviewReport.netSavings >= 0 ? "+" : ""}{fmt(overviewReport.netSavings)}
                </p>
              </div>
            </div>
          </section>
          {/* Category-wise breakdown for the month — FIRST item in overview */}
          <section aria-label="Monthly category breakdown">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Spending by Category ({formatMonthYear(month)})
            </h2>
            {overviewReport.rows.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center">
                <span className="text-3xl" aria-hidden="true">🧾</span>
                <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">No expenses this month</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Add expense transactions for {formatMonthYear(month)} to see a category breakdown.
                </p>
              </div>
            ) : (
              <CategoryRowsList rows={overviewReport.rows} fmt={fmt} />
            )}
          </section>

          {/* Interactive Trend Chart Controls */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3" aria-label="Chart controls">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Trend Chart Filters</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Showing data for: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{chartFilterLabel}</span> ({chartMonths} Months)
                </p>
              </div>

              {/* Months Range Selector */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 text-xs">
                {[3, 6, 12].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setChartMonths(m)}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors ${chartMonths === m
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                  >
                    {m}M
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Controls Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label htmlFor="chart-dimension" className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                  Filter Dimension
                </label>
                <select
                  id="chart-dimension"
                  value={chartDimension}
                  onChange={e => {
                    const dim = e.target.value as any;
                    setChartDimension(dim);
                    if (dim === "all") setChartFilterValue("");
                    else if (dim === "account" && accounts.length > 0) setChartFilterValue(accounts[0].id);
                    else if (dim === "category" && categories.length > 0) setChartFilterValue(categories[0].id);
                    else if (dim === "merchant" && merchantsList.length > 0) setChartFilterValue(merchantsList[0]);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">🌐 All Transactions (Overall)</option>
                  <option value="account">🏦 By Account</option>
                  <option value="category">📦 By Category</option>
                  <option value="merchant">🏪 By Merchant</option>
                </select>
              </div>

              {chartDimension !== "all" && (
                <div>
                  <label htmlFor="chart-value" className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                    Select {chartDimension.charAt(0).toUpperCase() + chartDimension.slice(1)}
                  </label>
                  {chartDimension === "account" && (
                    <select
                      id="chart-value"
                      value={chartFilterValue}
                      onChange={e => setChartFilterValue(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.type === "credit_card" ? "💳" : "🏦"} {acc.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {chartDimension === "category" && (
                    <select
                      id="chart-value"
                      value={chartFilterValue}
                      onChange={e => setChartFilterValue(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon || "📦"} {cat.name} ({cat.type})
                        </option>
                      ))}
                    </select>
                  )}
                  {chartDimension === "merchant" && (
                    <SearchableMerchantSelect
                      merchants={merchantsList}
                      value={chartFilterValue}
                      onChange={setChartFilterValue}
                    />
                  )}
                </div>
              )}
            </div>
          </section>

          <ChartCard title={`Income vs Expense Trend — ${chartFilterLabel} (Last ${chartMonths} Months)`}>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.25} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => currencyFmt(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} name="Income" />
                  <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={3} dot={{ r: 3 }} name="Expense" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title={`Monthly Spending Bar Breakdown — ${chartFilterLabel} (Last ${chartMonths} Months)`}>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.25} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => currencyFmt(value)} />
                    <Legend />
                    <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} name="Income" />
                    <Bar dataKey="expense" fill="#ef4444" radius={[6, 6, 0, 0]} name="Expense" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title={`Category breakdown — ${formatMonthYear(month)}`}>
              {categoryBreakdown.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">No expenses this month</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={2}>
                        {categoryBreakdown.map((entry, index) => (
                          <Cell key={`${entry.name}-${index}`} fill={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => currencyFmt(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>

          </div>
        </div>
      )}
    </div>
  );
}

// ── Account Analytics Sub-Component ──────────────────────────────────────────

function AccountAnalyticsReport({
  account,
  report,
  fmt,
}: {
  account: Account
  report: {
    totalInflow: number
    totalOutflow: number
    netMovement: number
    rows: ReportRow[]
  }
  fmt: (n: number) => string
}) {
  return (
    <div className="space-y-5">
      {/* Account summary header card */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{account.type === 'credit_card' ? '💳' : '🏦'}</span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{account.name}</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize mt-0.5">{account.type.replace('_', ' ')} Account</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Current Balance</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{fmt(account.balance)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-2.5">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Inflow</p>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">+{fmt(report.totalInflow)}</p>
          </div>
          <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-2.5">
            <p className="text-xs font-medium text-rose-700 dark:text-rose-300">Outflow</p>
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400 mt-0.5">-{fmt(report.totalOutflow)}</p>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-2.5">
            <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Net Change</p>
            <p className={`text-sm font-bold mt-0.5 ${report.netMovement >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {report.netMovement >= 0 ? '+' : ''}{fmt(report.netMovement)}
            </p>
          </div>
        </div>
      </section>

      {/* Account category breakdown */}
      {report.rows.length > 0 && (
        <section aria-label="Account category breakdown">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Spending by Category
          </h3>
          <CategoryRowsList rows={report.rows} fmt={fmt} />
        </section>
      )}
    </div>
  )
}

// ── Budget detail sub-component ──────────────────────────────────────────────

interface ReportRow {
  catId: string
  category: { name: string; icon?: string } | undefined
  allocated: number
  spent: number
  merchants: [string, number][]
}

function BudgetDetailReport({
  budget,
  report,
  fmt,
}: {
  budget: ParentBudget
  report: { totalSpent: number; rows: ReportRow[] }
  fmt: (n: number) => string
}) {
  const { totalSpent, rows } = report;
  const remaining = budget.totalAmount - totalSpent;
  const pct = budget.totalAmount > 0
    ? Math.min((totalSpent / budget.totalAmount) * 100, 100)
    : 0;
  const over = totalSpent > budget.totalAmount;

  const period = budgetPeriod(budget);

  return (
    <div className="space-y-4">
      {/* Budget summary card */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 py-4 space-y-3"
        aria-label={`${budget.name} summary`}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{budget.name}</h2>
            {period && (
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {period}
              </span>
            )}
          </div>
          {budget.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{budget.description}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Budget</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{fmt(budget.totalAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Spent</p>
            <p className={`text-sm font-bold ${over ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
              {fmt(totalSpent)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Remaining</p>
            <p className={`text-sm font-bold ${over ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {fmt(Math.abs(remaining))}
            </p>
          </div>
        </div>

        <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${over ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${Math.round(pct)}% of budget used`}
          />
        </div>
      </section>

      {/* Category breakdown with merchant drill-down */}
      {rows.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center">
          <span className="text-3xl" aria-hidden="true">🧾</span>
          <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">No transactions yet</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Add transactions and assign them to this budget to see a breakdown.
          </p>
        </div>
      ) : (
        <section aria-label="Category breakdown">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Spending by Category
          </h3>
          <CategoryRowsList rows={rows} fmt={fmt} />
        </section>
      )}
    </div>
  );
}

// ── Reusable Category Breakdown Rows with Merchant Drill-down ─────────────────

function CategoryRowsList({
  rows,
  fmt,
}: {
  rows: ReportRow[]
  fmt: (n: number) => string
}) {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [expandedAllMerchants, setExpandedAllMerchants] = useState<Set<string>>(new Set());

  function toggleCat(catId: string) {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(catId) ? next.delete(catId) : next.add(catId);
      return next;
    });
  }

  function toggleShowAllMerchants(catId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setExpandedAllMerchants(prev => {
      const next = new Set(prev);
      next.has(catId) ? next.delete(catId) : next.add(catId);
      return next;
    });
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
      {rows.map(row => {
        const isExpanded = expandedCats.has(row.catId);
        const showAllMerchants = expandedAllMerchants.has(row.catId);
        const pctCat = row.allocated > 0
          ? Math.min((row.spent / row.allocated) * 100, 100)
          : 0;
        const overCat = row.allocated > 0 && row.spent > row.allocated;

        const displayedMerchants = showAllMerchants ? row.merchants : row.merchants.slice(0, 5);
        const remainingMerchantsCount = row.merchants.length - 5;

        return (
          <div key={row.catId}>
            {/* Category row */}
            <button
              type="button"
              onClick={() => row.merchants.length > 0 && toggleCat(row.catId)}
              aria-expanded={isExpanded}
              className={`w-full px-5 py-4 text-left transition-colors ${row.merchants.length > 0 ? "hover:bg-slate-50 dark:hover:bg-slate-800/50" : ""
                }`}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl shrink-0" aria-hidden="true">
                    {row.category?.icon ?? "📦"}
                  </span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {row.category?.name ?? "Uncategorised"}
                  </span>
                  {overCat && (
                    <span className="shrink-0 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-1.5 py-0.5 rounded-full">
                      OVER
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className={`text-sm font-semibold ${overCat ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
                      {fmt(row.spent)}
                    </span>
                    {row.allocated > 0 && (
                      <span className="text-xs text-slate-400 dark:text-slate-500"> / {fmt(row.allocated)}</span>
                    )}
                  </div>
                  {row.merchants.length > 0 && (
                    <svg
                      width={14}
                      height={14}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      aria-hidden="true"
                      className={`text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  )}
                </div>
              </div>
              {row.allocated > 0 && (
                <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${overCat ? "bg-rose-500" : pctCat >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${pctCat}%` }}
                    role="progressbar"
                    aria-valuenow={Math.round(pctCat)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${Math.round(pctCat)}% used`}
                  />
                </div>
              )}
            </button>

            {/* Merchant drill-down */}
            {isExpanded && (
              <div className="bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {displayedMerchants.map(([merchant, amount]) => (
                    <li key={merchant} className="flex items-center justify-between px-6 py-2.5">
                      <span className="text-sm text-slate-700 dark:text-slate-300">{merchant}</span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{fmt(amount)}</span>
                    </li>
                  ))}
                  {!showAllMerchants && remainingMerchantsCount > 0 && (
                    <li>
                      <button
                        type="button"
                        onClick={(e) => toggleShowAllMerchants(row.catId, e)}
                        className="w-full flex items-center justify-between px-6 py-2.5 text-left text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors"
                      >
                        <span>+ {remainingMerchantsCount} more merchant{remainingMerchantsCount > 1 ? 's' : ''}</span>
                        <span>
                          Show all ({fmt(row.merchants.slice(5).reduce((s, [, a]) => s + a, 0))})
                        </span>
                      </button>
                    </li>
                  )}
                  {showAllMerchants && row.merchants.length > 5 && (
                    <li>
                      <button
                        type="button"
                        onClick={(e) => toggleShowAllMerchants(row.catId, e)}
                        className="w-full px-6 py-2 text-center text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                      >
                        Show top 5 only
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Shared ChartCard ─────────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{title}</h2>
      {children}
    </section>
  );
}

// ── Searchable Merchant Select Component ─────────────────────────────────────

function SearchableMerchantSelect({
  merchants,
  value,
  onChange,
}: {
  merchants: string[]
  value: string
  onChange: (val: string) => void
}) {
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)

  const filtered = useMemo(() => {
    if (!query.trim()) return merchants
    const q = query.toLowerCase()
    return merchants.filter(m => m.toLowerCase().includes(q))
  }, [merchants, query])

  const selectedDisplay = value || (merchants.length > 0 ? merchants[0] : "")

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input
          type="text"
          value={isOpen ? query : selectedDisplay}
          onFocus={() => {
            setQuery("")
            setIsOpen(true)
          }}
          onChange={e => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          placeholder="Search merchant name..."
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-8 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <span className="absolute left-2.5 text-slate-400 text-xs" aria-hidden="true">🔍</span>
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("")
              setQuery("")
            }}
            className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1"
            title="Clear merchant filter"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg divide-y divide-slate-100 dark:divide-slate-700/50">
            {filtered.length === 0 ? (
              <div className="p-3 text-xs text-slate-400 text-center">
                No matching merchants found
              </div>
            ) : (
              filtered.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    onChange(m)
                    setQuery("")
                    setIsOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center justify-between ${
                    value === m
                      ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                      : "hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <span className="truncate">🏪 {m}</span>
                  {value === m && <span className="text-indigo-600 dark:text-indigo-400 font-bold">✓</span>}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}