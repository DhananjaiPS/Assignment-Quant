'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Activity, CheckCircle2, ShieldAlert, Clock, Terminal, ChevronRight, RefreshCw } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';


const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function JobsPage() {
  const { data, error, mutate, isLoading } = useSWR('/api/jobs', fetcher, { refreshInterval: 5000 });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);


  // Poll selected job details (if one is selected and is running)
  const { data: selectedData } = useSWR(
    selectedJobId ? `/api/jobs/${selectedJobId}` : null,
    fetcher,
    {
      refreshInterval: (res: any) =>
        res?.job?.status === 'RUNNING' || res?.job?.status === 'PENDING' ? 1000 : 0,
    }
  );

  const jobs = data?.success ? data.jobs : [];
  const selectedJob = selectedData?.success ? selectedData.job : jobs.find((j: any) => j.id === selectedJobId);

  // Set initial selected job once jobs load
  if (jobs.length > 0 && selectedJobId === null) {
    setSelectedJobId(jobs[0].id);
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'status-pill-completed';
      case 'RUNNING':
        return 'status-pill-running';
      case 'PENDING':
        return 'status-pill-pending';
      case 'FAILED':
        return 'status-pill-failed';
      default:
        return 'status-pill-pending';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <Toaster position="top-right" />
      {/* Header */}

      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
            Operations Job Monitor
          </h1>
          <p className="text-slate-500 mt-1 font-semibold">
            Track real-time video attribute extractions, CSV imports, and price refreshes.
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="p-3 bg-white border border-slate-200 hover:border-blue-200 hover:text-blue-600 rounded-xl text-slate-600 transition-all flex items-center gap-2 text-xs font-semibold cursor-pointer shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
          Force Sync
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Jobs List */}
        <div className="lg:col-span-1 glass-panel p-6 rounded-2xl space-y-4 h-[600px] overflow-y-auto bg-white border border-slate-200">
          <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" /> Recent Operations
          </h2>

          {jobs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">No operations jobs registered.</div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job: any) => {
                const isActive = job.id === selectedJobId;
                const formattedDate = new Date(job.createdAt).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                      isActive
                        ? 'bg-blue-50/85 border-blue-200 text-blue-700 shadow-sm'
                        : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-250 text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-xs ${isActive ? 'text-blue-750 font-extrabold' : 'text-slate-700'}`}>{job.jobType.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold">
                        <Clock className="w-3 h-3" />
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`status-pill text-[9px] ${getStatusBadgeClass(job.status)}`}>
                        {job.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Selected Job Logs Console */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl flex flex-col h-[600px] justify-between bg-white border border-slate-200">
          {selectedJob ? (
            <div className="space-y-6 flex-1 flex flex-col justify-between">
              
              {/* Job Summary Pane */}
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Job Identifier</span>
                    <h3 className="font-mono text-sm text-blue-600 font-bold mt-0.5">{selectedJob.id}</h3>
                  </div>

                  <div className="flex items-center gap-4">
                    {selectedJob.status === 'FAILED' && (
                      <button
                        onClick={async () => {
                          if (retryingJobId) return;
                          setRetryingJobId(selectedJob.id);
                          const toastId = toast.loading('Initiating job retry...');
                          try {
                            const res = await fetch(`/api/jobs/${selectedJob.id}/retry`, {
                              method: 'POST',
                            });
                            const resData = await res.json();
                            if (!resData.success) throw new Error(resData.error || 'Failed to retry job.');
                            
                            toast.success('Job successfully queued for retry!', { id: toastId });
                            mutate();
                          } catch (err: any) {
                            toast.error(err.message || 'Failed to retry job.', { id: toastId });
                          } finally {
                            setRetryingJobId(null);
                          }
                        }}
                        disabled={retryingJobId !== null}
                        className="px-3 py-1.5 bg-red-650 hover:bg-red-700 text-white rounded-xl text-[10px] font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer disabled:opacity-70"
                      >
                        <RefreshCw className={`w-3 h-3 ${retryingJobId === selectedJob.id ? 'animate-spin' : ''}`} />
                        Retry Job
                      </button>
                    )}
                    <div>
                      <div className="text-[10px] text-slate-450 uppercase tracking-wider text-right font-bold">Job Progress</div>
                      <div className="font-extrabold text-slate-800 text-sm text-right mt-0.5">{selectedJob.progress}%</div>
                    </div>
                    <span className={`status-pill text-[10px] ${getStatusBadgeClass(selectedJob.status)}`}>
                      {selectedJob.status}
                    </span>
                  </div>

                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs">
                  <div>
                    <span className="text-slate-450 font-bold uppercase text-[9px] tracking-wider">Job Type</span>
                    <div className="font-bold text-slate-700 mt-0.5">{selectedJob.jobType}</div>
                  </div>
                  <div>
                    <span className="text-slate-450 font-bold uppercase text-[9px] tracking-wider">Started At</span>
                    <div className="font-bold text-slate-700 mt-0.5">
                      {selectedJob.startedAt 
                        ? new Date(selectedJob.startedAt).toLocaleTimeString() 
                        : 'Pending'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-450 font-bold uppercase text-[9px] tracking-wider">Duration</span>
                    <div className="font-bold text-slate-700 mt-0.5">
                      {selectedJob.completedAt && selectedJob.startedAt
                        ? `${Math.round((new Date(selectedJob.completedAt).getTime() - new Date(selectedJob.startedAt).getTime()) / 10) / 100}s`
                        : selectedJob.status === 'RUNNING'
                        ? 'Running...'
                        : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-450 font-bold uppercase text-[9px] tracking-wider">Retries</span>
                    <div className="font-bold text-slate-700 mt-0.5">{selectedJob.retryCount}</div>
                  </div>
                </div>
              </div>

              {/* Console Logs terminal */}
              <div className="flex-1 flex flex-col justify-end space-y-2 mt-4 font-semibold">
                <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-blue-600" /> Operational Console Outputs
                </span>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-[11px] h-80 overflow-y-auto text-slate-700 space-y-2.5 flex flex-col-reverse justify-end shadow-inner">
                  {selectedJob.logs && selectedJob.logs.length > 0 ? (
                    [...selectedJob.logs].reverse().map((log: any, idx: number) => (
                      <div key={log.id} className="flex gap-2.5 leading-relaxed animate-fade-in-up">
                        <span className="text-slate-400 font-medium">[{new Date(log.createdAt).toLocaleTimeString([], { hour12: false })}]</span>
                        <span className={idx === 0 && (selectedJob.status === 'RUNNING' || selectedJob.status === 'COMPLETED') ? 'text-blue-600 font-bold' : 'text-slate-600 font-medium'}>
                          {log.message}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400 italic font-normal">No logs populated for this sync job.</div>
                  )}

                  {selectedJob.errorMessage && (
                    <div className="flex gap-2.5 text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-lg text-[10px] font-semibold leading-relaxed">
                      <ShieldAlert className="w-4 h-4 flex-shrink-0 text-red-500" />
                      <span>{selectedJob.errorMessage}</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-24 text-slate-400 text-sm flex flex-col items-center justify-center space-y-2 font-semibold">
              <Terminal className="w-8 h-8 text-slate-350" />
              <span>Select an operation job on the left to review operational logs.</span>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
