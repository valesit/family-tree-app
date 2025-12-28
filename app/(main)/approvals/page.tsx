'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { ApprovalCard } from '@/components/approval/ApprovalCard';
import { Card, Button, Badge } from '@/components/ui';
import { PendingChangeWithDetails } from '@/types';
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  Loader2, 
  Inbox,
  FileCheck,
  FileX,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'mine'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    data: PendingChangeWithDetails[];
  }>(`/api/approvals?type=${activeTab}`, fetcher);

  const handleApprove = async (id: string, comment?: string) => {
    setProcessingId(id);
    try {
      const response = await fetch(`/api/approvals/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED', comment }),
      });
      
      if (response.ok) {
        mutate();
      }
    } catch (error) {
      console.error('Error approving:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string, comment?: string) => {
    setProcessingId(id);
    try {
      const response = await fetch(`/api/approvals/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED', comment }),
      });
      
      if (response.ok) {
        mutate();
      }
    } catch (error) {
      console.error('Error rejecting:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = data?.data?.filter(c => c.status === 'PENDING').length || 0;

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Approvals</h1>
          <p className="text-slate-600 mt-1">
            Review and approve changes to the family tree
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'pending'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Inbox className="w-4 h-4" />
            Pending Review
            {pendingCount > 0 && (
              <Badge variant="danger" size="sm">
                {pendingCount}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'mine'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            My Submissions
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : error ? (
          <Card className="text-center py-8">
            <XCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <p className="text-slate-600">Failed to load approvals</p>
            <Button onClick={() => mutate()} className="mt-4">
              Try Again
            </Button>
          </Card>
        ) : data?.data?.length === 0 ? (
          <Card className="text-center py-12">
            {activeTab === 'pending' ? (
              <>
                <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  All Caught Up!
                </h3>
                <p className="text-slate-600">
                  You have no pending approvals to review.
                </p>
              </>
            ) : (
              <>
                <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  No Submissions Yet
                </h3>
                <p className="text-slate-600">
                  Changes you submit for approval will appear here.
                </p>
              </>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            {data?.data?.map((change) => (
              <ApprovalCard
                key={change.id}
                change={change}
                onApprove={handleApprove}
                onReject={handleReject}
                isProcessing={processingId === change.id}
              />
            ))}
          </div>
        )}

        {/* Stats summary */}
        {data?.data && data.data.length > 0 && (
          <Card className="mt-8">
            <h3 className="font-semibold text-slate-900 mb-4">Summary</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-slate-900">
                  {data.data.filter(c => c.status === 'PENDING').length}
                </p>
                <p className="text-sm text-slate-600">Pending</p>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-slate-900">
                  {data.data.filter(c => c.status === 'APPROVED').length}
                </p>
                <p className="text-sm text-slate-600">Approved</p>
              </div>
              <div className="text-center p-4 bg-rose-50 rounded-lg">
                <XCircle className="w-6 h-6 text-rose-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-slate-900">
                  {data.data.filter(c => c.status === 'REJECTED').length}
                </p>
                <p className="text-sm text-slate-600">Rejected</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

