import React, { useEffect, useState } from "react";
import { Plus, Trash2, Check, X, Search, Edit2, Calendar, Users, Banknote, Download } from "lucide-react";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const apiBase = "https://workerfserver.onrender.com/api";

export default function WorkerTable() {
  const [workers, setWorkers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [addModal, setAddModal] = useState(false);
  const [newWorker, setNewWorker] = useState({ name: "", dailyRate: 1350 });
  const [editingRateId, setEditingRateId] = useState(null);
  const [editRate, setEditRate] = useState("");
  const [modalWorker, setModalWorker] = useState(null);
  const [modalDay, setModalDay] = useState("");
  const [modalSite, setModalSite] = useState("");
  const [detailsWorker, setDetailsWorker] = useState(null); // <-- new for popup

  async function fetchWorkers() {
    try {
      const res = await fetch(`${apiBase}/workers`);
      const data = await res.json();
      setWorkers(data);
    } catch (err) {
      console.error("Failed to fetch workers:", err);
    }
  }

  useEffect(() => {
    fetchWorkers();
  }, []);

  async function addWorker() {
    if (!newWorker.name.trim()) return alert("Enter worker name");
    const schedule = {
      S: newWorker.S || "",
      M: newWorker.M || "",
      T: newWorker.T || "",
      W: newWorker.W || "",
      Th: newWorker.Th || "",
      F: newWorker.F || "",
      St: newWorker.St || "",
    };
    try {
      await fetch(`${apiBase}/workers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWorker.name.trim(),
          dailyRate: Number(newWorker.dailyRate) || 1350,
          schedule,
        }),
      });
      setAddModal(false);
      setNewWorker({ name: "", dailyRate: 1350 });
      fetchWorkers();
    } catch (err) {
      console.error("Failed to add worker:", err);
    }
  }

  async function updateRate(id) {
    try {
      await fetch(`${apiBase}/workers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyRate: Number(editRate) }),
      });
      setEditingRateId(null);
      fetchWorkers();
    } catch (err) {
      console.error("Failed to update rate:", err);
    }
  }

  async function updateSite(id, day, site) {
    try {
      const worker = workers.find((w) => w._id === id);
      if (!worker) return;
      await fetch(`${apiBase}/workers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule: { ...worker.schedule, [day]: site },
        }),
      });
      setModalWorker(null);
      fetchWorkers();
    } catch (err) {
      console.error("Failed to update site:", err);
    }
  }

  async function deleteWorker(id) {
    if (window.confirm("Are you sure you want to delete this worker?")) {
      try {
        await fetch(`${apiBase}/workers/${id}`, { method: "DELETE" });
        fetchWorkers();
      } catch (err) {
        console.error("Failed to delete worker:", err);
      }
    }
  }

  // New function for resetting all worker sites ONLY
  async function resetWorkerSites() {
    if (!window.confirm("Reset all worker sites? This cannot be undone.")) return;
    try {
      await fetch(`${apiBase}/workers/reset-sites`, {
        method: "PUT"
      });
      fetchWorkers(); // Refresh data after reset
    } catch (err) {
      console.error("Failed to reset worker sites:", err);
      alert("Reset failed");
    }
  }

  const wageDetails = workers.map((w) => {
    const daysWorked = Object.values(w.schedule).filter((s) => s).length;
    return { name: w.name, days: daysWorked, wage: daysWorked * w.dailyRate };
  });
  const totalAmount = wageDetails.reduce((sum, w) => sum + w.wage, 0);

  const filteredWorkers = workers.filter((w) =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const dayNames = { S: "Sunday", M: "Monday", T: "Tuesday", W: "Wednesday", Th: "Thursday", F: "Friday", St: "Saturday" };

  function exportToExcel() {
    try {
      const workersSheetData = workers.map((w) => ({
        id: w._id,
        name: w.name,
        dailyRate: w.dailyRate,
        Sunday: w.schedule?.S || '',
        Monday: w.schedule?.M || '',
        Tuesday: w.schedule?.T || '',
        Wednesday: w.schedule?.W || '',
        Thursday: w.schedule?.Th || '',
        Friday: w.schedule?.F || '',
        Saturday: w.schedule?.St || '',
      }));

      const wageSheetData = wageDetails.map((d) => ({ name: d.name, days: d.days, totalWage: d.wage }));

      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(workersSheetData);
      const ws2 = XLSX.utils.json_to_sheet(wageSheetData);
      XLSX.utils.book_append_sheet(wb, ws1, 'Workers');
      XLSX.utils.book_append_sheet(wb, ws2, 'Wage Summary');

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `workers_export_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
      console.error('Export failed', err);
      alert('Failed to export Excel.');
    }
  }

  function exportWagesCSV() {
    try {
      const rows = [['Name', 'Days', 'Total Wage'], ...wageDetails.map(w => [w.name, w.days, w.wage])];
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `wage_summary_${new Date().toISOString().slice(0,10)}.csv`);
    } catch (err) {
      console.error('CSV export failed', err);
    }
  }

  // Calculate site breakdown when worker name clicked
  function getSiteDetails(worker) {
    const siteCount = {};
    Object.values(worker.schedule || {}).forEach((site) => {
      if (site) siteCount[site] = (siteCount[site] || 0) + 1;
    });

    const siteDetails = Object.entries(siteCount).map(([site, days]) => ({
      site,
      days,
      amount: days * worker.dailyRate,
    }));

    const total = siteDetails.reduce((sum, s) => sum + s.amount, 0);
    return { siteDetails, total };
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white flex items-center gap-3 mb-2">
                <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-3 rounded-2xl shadow-xl">
                  <Calendar className="text-white" size={36} />
                </div>
                Worker Tracker
              </h1>
              <p className="text-gray-300 text-sm sm:text-base">Manage your workforce efficiently</p>
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto">
              <button
                onClick={() => setAddModal(true)}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-2xl shadow-2xl hover:shadow-purple-500/50 hover:scale-105 transition-all duration-300 flex items-center justify-center gap-3 font-semibold text-lg"
              >
                <Plus size={20} strokeWidth={2.5} />
                Add Worker
              </button>

              {/* Reset Sites Button Added Here */}
              <button
                onClick={resetWorkerSites}
                className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-3 rounded-2xl shadow-2xl hover:shadow-orange-500/50 hover:scale-105 transition-all duration-300 flex items-center justify-center gap-3 font-semibold text-lg"
              >
                <Trash2 size={20} strokeWidth={2.5} />
                Reset Sites
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-indigo-600/20 to-indigo-700/20 backdrop-blur-lg border border-indigo-400/30 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-500/30 p-3 rounded-xl">
                  <Users className="text-indigo-300" size={28} />
                </div>
                <div>
                  <p className="text-indigo-200 text-sm font-medium">Total Workers</p>
                  <p className="text-white text-3xl font-bold">{workers.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/20 backdrop-blur-lg border border-purple-400/30 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="bg-purple-500/30 p-3 rounded-xl">
                  <Calendar className="text-purple-300" size={28} />
                </div>
                <div>
                  <p className="text-purple-200 text-sm font-medium">Active Sites</p>
                  <p className="text-white text-3xl font-bold">
                    {new Set(workers.flatMap(w => Object.values(w.schedule).filter(s => s))).size}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-600/20 to-green-700/20 backdrop-blur-lg border border-green-400/30 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="bg-green-500/30 p-3 rounded-xl">
                  <Banknote className="text-green-300" size={28} />
                </div>
                <div>
                  <p className="text-green-200 text-sm font-medium">Total Wages</p>
                  <p className="text-white text-3xl font-bold">₹{totalAmount.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-gray-400" size={22} />
            <input
              type="text"
              placeholder="Search workers by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-gray-800 border border-gray-600 rounded-2xl text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all shadow-xl"
            />
          </div>
        </div>
    {/* Desktop Table */}
<div className="hidden lg:block bg-gray-900/70 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-gray-700 mb-8">
  <div className="overflow-x-auto">
    <table className="min-w-full">
      <thead className="bg-gradient-to-r from-purple-700 to-indigo-700">
        <tr>
          <th className="px-6 py-5 text-left text-sm font-bold text-white uppercase tracking-wider">Name</th>
          {["S", "M", "T", "W", "Th", "F", "St"].map((day) => (
            <th key={day} className="px-4 5 text-center text-sm font-bold text-white uppercase">{day}</th>
          ))}
          <th className="px-6 5 text-center text-sm font-bold text-white uppercase">Daily Rate</th>
          <th className="px-6 5 text-center text-sm font-bold text-white uppercase">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-700/50">
        {filteredWorkers.map((w) => (
          <tr key={w._id} className="hover:bg-gray-800/50 transition-all duration-200">
            <td className="px-6 4 font-semibold text-white text-base">{w.name}</td>
            {["S", "M", "T", "W", "Th", "F", "St"].map((day) => (
              <td
                key={day}
                className="px-4 4 text-center cursor-pointer hover:bg-purple-700/20 transition-all rounded-xl"
                onClick={() => {
                  setModalWorker(w);
                  setModalDay(day);
                  setModalSite(w.schedule?.[day] || "");
                }}
              >
                {w.schedule?.[day] ? (
                  <span className="inline-flex items-center px-3 1.5 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white text-xs font-bold shadow-lg">
                    {w.schedule[day]}
                  </span>
                ) : (
                  <span className="text-gray-400 text-lg">-</span>
                )}
              </td>
            ))}
            <td className="px-6 4 text-center">
              {editingRateId === w._id ? (
                <div className="flex justify-center items-center gap-2">
                  <input
                    type="number"
                    value={editRate}
                    onChange={(e) => setEditRate(e.target.value)}
                    className="bg-gray-800 border border-gray-600 text-white rounded-xl px-4 2 w-28 text-center focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                  <button
                    onClick={() => updateRate(w._id)}
                    className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-xl transition-all shadow-lg"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={() => setEditingRateId(null)}
                    className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-xl transition-all shadow-lg"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingRateId(w._id);
                    setEditRate(w.dailyRate);
                  }}
                  className="inline-flex items-center gap-2 text-yellow-300 hover:text-yellow-200 font-bold text-base transition-all hover:scale-105"
                >
                  ₹{w.dailyRate}
                  <Edit2 size={16} />
                </button>
              )}
            </td>
            <td className="px-6 4 text-center">
              <button
                onClick={() => deleteWorker(w._id)}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/20 p-2.5 rounded-xl transition-all"
                title="Delete Worker"
              >
                <Trash2 size={20} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>

{/* Mobile Table */}
<div className="lg:hidden space-y-4 mb-8">
  {filteredWorkers.map((w) => (
    <div key={w._id} className="bg-gray-900/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-purple-700 to-indigo-700 px-5 py-4 flex justify-between items-center">
        <h3 className="text-white font-bold text-xl">{w.name}</h3>
        <button
          onClick={() => deleteWorker(w._id)}
          className="text-white hover:bg-white/20 p-2 rounded-xl transition-all"
        >
          <Trash2 size={20} />
        </button>
      </div>
      <div className="p-5">
        <div className="mb-5">
          <div className="text-sm text-gray-400 mb-2 font-medium">Daily Wage</div>
          {editingRateId === w._id ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={editRate}
                onChange={(e) => setEditRate(e.target.value)}
                className="bg-gray-800 border border-gray-600 text-white rounded-xl px-4 py-3 flex-1 focus:ring-2 focus:ring-purple-500 outline-none"
              />
              <button
                onClick={() => updateRate(w._id)}
                className="bg-green-500 hover:bg-green-600 text-white p-3 rounded-xl shadow-lg"
              >
                <Check size={20} />
              </button>
              <button
                onClick={() => setEditingRateId(null)}
                className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-xl shadow-lg"
              >
                <X size={20} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditingRateId(w._id);
                setEditRate(w.dailyRate);
              }}
              className="flex items-center gap-2 text-yellow-300 hover:text-yellow-200 font-bold text-xl"
            >
              ₹{w.dailyRate}
              <Edit2 size={18} />
            </button>
          )}
        </div>
        <div className="text-sm text-gray-400 mb-3 font-medium">Weekly Schedule</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {["S", "M", "T", "W", "Th", "F", "St"].map((day) => (
            <button
              key={day}
              onClick={() => {
                setModalWorker(w);
                setModalDay(day);
                setModalSite(w.schedule?.[day] || "");
              }}
              className="bg-gray-800/30 hover:bg-gray-800/50 border border-gray-700 rounded-xl p-3 transition-all"
            >
              <div className="text-xs font-bold text-gray-400 mb-1">{day}</div>
              <div className="text-sm font-bold text-white truncate">
                {w.schedule?.[day] || "-"}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  ))}
</div>

{/* Wage Summary */}
 <div className="bg-gray-900/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700 overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-5 flex items-center justify-between">
            <h3 className="text-2xl font-bold text-white flex items-center gap-3">💰 Wage Summary</h3>
            <div className="flex items-center gap-3">
              <button onClick={exportToExcel} className="inline-flex items-center gap-2 bg-gray-800/50 border border-gray-700 px-4 text-white py-2 rounded-xl hover:bg-gray-800/70 transition-all">
                <Download size={16} /> Export Excel
              </button>
              <button onClick={exportWagesCSV} className="inline-flex items-center gap-2 bg-gray-800/50 border border-gray-700 px-4 py-2 text-white rounded-xl hover:bg-gray-800/70 transition-all">
                CSV
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-800 border-b-2 border-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-400 uppercase">Name</th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-gray-400 uppercase">Days</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-400 uppercase">Total Wage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {wageDetails.map((w, i) => (
                    <tr key={i} className="hover:bg-gray-800/50 transition-all cursor-pointer"
                      onClick={() => setDetailsWorker(workers.find(x => x.name === w.name))}>
                      <td className="px-6 py-4 text-sm text-white font-medium">{w.name}</td>
                      <td className="px-6 py-4 text-sm text-center">
                        <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-700/50 text-indigo-300 font-bold border border-indigo-500/30">
                          {w.days}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-bold text-green-300 text-lg">
                        ₹{w.wage.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 pt-6 border-t-2 border-gray-700 flex justify-between items-center">
              <span className="text-xl font-bold text-gray-400">Total Amount:</span>
              <span className="text-3xl font-bold bg-gradient-to-r from-green-300 to-green-500 bg-clip-text text-transparent">
                ₹{totalAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Site Breakdown Modal */}
        {detailsWorker && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900/90 border border-purple-600/30 rounded-3xl shadow-2xl w-full max-w-md p-6">
              <h2 className="text-2xl font-bold text-white mb-4">
                {detailsWorker.name} - Site Breakdown
              </h2>

              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-700 rounded-xl">
                  <thead className="bg-gray-800 border-b border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-400 text-sm font-bold uppercase">Site</th>
                      <th className="px-4 py-3 text-center text-gray-400 text-sm font-bold uppercase">Days</th>
                      <th className="px-4 py-3 text-right text-gray-400 text-sm font-bold uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {getSiteDetails(detailsWorker).siteDetails.map((s, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 text-white text-sm font-medium">{s.site}</td>
                        <td className="px-4 py-3 text-center text-indigo-300 font-bold">{s.days}</td>
                        <td className="px-4 py-3 text-right text-green-300 font-bold">
                          ₹{s.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between">
                <span className="text-lg text-gray-400 font-bold">Total Amount:</span>
                <span className="text-2xl font-bold text-green-400">
                  ₹{getSiteDetails(detailsWorker).total.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setDetailsWorker(null)}
                  className="px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold hover:scale-105 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

{/* Chart Dashboard */}
<div className="bg-gray-900/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700 p-6 mb-8">
  <h3 className="text-2xl font-bold text-white mb-4">📊 Worker Statistics</h3>
  <ResponsiveContainer width="100%" height={300}>
    <BarChart data={wageDetails} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
      <XAxis dataKey="name" tick={{ fill: 'white' }} />
      <YAxis tick={{ fill: 'white' }} />
      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#fff' }} />
      <Legend wrapperStyle={{ color: 'white' }} />
      <Bar dataKey="days" fill="#8884d8" name="Days Worked" />
      <Bar dataKey="wage" fill="#82ca9d" name="Total Wage" />
    </BarChart>
  </ResponsiveContainer>
</div>

{/* Add Worker Modal */}
{addModal && (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
    <div className="bg-gray-900/80 border border-purple-600/30 rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
      <div className="sticky top-0 bg-gradient-to-r from-purple-700 to-indigo-700 px-6 py-5 rounded-t-3xl">
        <h2 className="text-2xl font-bold text-white">Add New Worker</h2>
      </div>
      <div className="p-6 space-y-5">
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2">Worker Name</label>
          <input
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none placeholder-gray-400"
            placeholder="Enter name"
            value={newWorker.name}
            onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2">Daily Wage (₹)</label>
         <input
  type="number"
  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none
             [&::-webkit-inner-spin-button]:appearance-none 
             [&::-webkit-outer-spin-button]:appearance-none 
             [appearance:textfield]"
  value={newWorker.dailyRate}
  onChange={(e) => setNewWorker({ ...newWorker, dailyRate: e.target.value })}
/>

        </div>
        {["S","M","T","W","Th","F","St"].map((day) => (
          <div key={day}>
            <label className="block text-sm font-bold text-gray-300 mb-2">{dayNames[day]} Site</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none placeholder-gray-400"
              placeholder="Site name (optional)"
              value={newWorker[day] || ""}
              onChange={(e) => setNewWorker({ ...newWorker, [day]: e.target.value })}
            />
          </div>
        ))}
        <div className="flex gap-3 pt-4">
          <button
            onClick={() => setAddModal(false)}
            className="flex-1 px-4 py-3 bg-gray-800 border-2 border-gray-700 text-white rounded-xl hover:bg-gray-700 transition-all font-bold"
          >
            Cancel
          </button>
          <button
            onClick={addWorker}
            className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 rounded-xl hover:shadow-2xl transition-all font-bold"
          >
            Save Worker
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{/* Edit Site Modal */}
{modalWorker && (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
    <div className="bg-gray-900/80 border border-purple-600/30 rounded-3xl shadow-2xl w-full max-w-md p-6">
      <h2 className="text-2xl font-bold text-white mb-4">
        Edit {dayNames[modalDay]} Site for {modalWorker.name}
      </h2>
      <input
        type="text"
        className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none mb-6"
        placeholder="Enter site name"
        value={modalSite}
        onChange={(e) => setModalSite(e.target.value)}
      />
      <div className="flex gap-3">
        <button
          onClick={() => setModalWorker(null)}
          className="flex-1 px-4 py-3 bg-gray-800 border-2 border-gray-700 text-white rounded-xl hover:bg-gray-700 transition-all font-bold"
        >
          Cancel
        </button>
        <button
          onClick={() => updateSite(modalWorker._id, modalDay, modalSite)}
          className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 rounded-xl hover:shadow-2xl transition-all font-bold"
        >
          Save Site
        </button>
      </div>
    </div>
  </div>
)}
      </div>
    </div>
  );
}
